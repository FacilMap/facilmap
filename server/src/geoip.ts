import { distanceToDegreesLat, distanceToDegreesLon } from "./utils/geo.js";
import md5 from "md5-file";
import { open, type Reader, type Response } from "maxmind";
import { createWriteStream } from "fs";
import { rename, stat } from "node:fs/promises";
import https from "https";
import zlib from "zlib";
import config from "./config.js";
import type { IncomingMessage } from "http";
import type { Bbox } from "facilmap-types";
import { fileURLToPath } from "url";
import { fileExists } from "./utils/utils";
import findCacheDir from "find-cache-dir";
import { utimes } from "fs/promises";

const geoliteUrl = "https://updates.maxmind.com/geoip/databases/GeoLite2-City/update?db_md5=";
const cacheDir = findCacheDir({ name: "facilmap-server", create: true })
	|| findCacheDir({ name: "facilmap-server", create: true, cwd: fileURLToPath(new URL('./', import.meta['url'])) })!;
const fname = `${cacheDir}/GeoLite2-City.mmdb`;
const tmpfname = `${fname}.tmp`;

let currentMd5: string | null = null;
let db: Reader<Response> | null = null;

if(config.maxmindUserId && config.maxmindLicenseKey) {
	load().catch((err) => {
		console.log("Error loading maxmind database", err);
	});
	checkDownload().catch((err) => {
		console.log("Error downloading maxmind database", err);
	});
	setInterval(() => {
		checkDownload().catch((err) => {
			console.log("Error downloading maxmind database", err);
		});
	}, 3600_000);
}

async function load() {
	if(await fileExists(fname))
		db = await open(fname);
	else
		db = null;
}

async function checkDownload() {
	const mtime = (await fileExists(fname)) ? (await stat(fname)).mtimeMs : -Infinity;
	if (Date.now() - mtime >= 86400_000) {
		await download();
	}
}

async function download() {
	console.log("Downloading maxmind database");

	if(!currentMd5) {
		if(await fileExists(fname))
			currentMd5 = await md5(fname);
	}

	const res = await new Promise<IncomingMessage>((resolve, reject) => {
		https.get(geoliteUrl + (currentMd5 || ""), {
			headers: {
				Authorization: `Basic ${Buffer.from(config.maxmindUserId + ':' + config.maxmindLicenseKey).toString('base64')}`
			}
		}, resolve).on("error", reject);
	});

	if(res.statusCode == 304) {
		console.log("Maxmind database is up to date, no update needed.");
		await utimes(fname, Date.now(), Date.now());
		return;
	} else if(res.statusCode != 200)
		throw new Error(`Unexpected status code ${res.statusCode} when downloading maxmind database.`);

	const gunzip = zlib.createGunzip();
	res.pipe(gunzip);

	const file = createWriteStream(tmpfname);
	gunzip.pipe(file);

	await new Promise((resolve, reject) => {
		file.on("finish", resolve);
		file.on("error", reject);
	});

	await rename(tmpfname, fname);
	currentMd5 = await md5(fname);

	await load();

	console.log("Maxmind database downloaded");
}

export async function geoipLookup(ip: string): Promise<Bbox | undefined> {
	if(!db)
		return undefined;

	const ret = db.get(ip);

	if(ret && 'location' in ret && ret.location) {
		const distLat = distanceToDegreesLat(ret.location.accuracy_radius);
		const distLon = distanceToDegreesLon(ret.location.accuracy_radius, ret.location.latitude);

		return {
			top: ret.location.latitude + distLat,
			right: ret.location.longitude + distLon,
			bottom: ret.location.latitude - distLat,
			left: ret.location.longitude - distLon
		};
	}
}
