import { distanceToDegreesLat, distanceToDegreesLon } from "./utils/geo";
import md5 from "md5-file";
import cron from "node-cron";
import maxmind, { Reader, Response } from "maxmind";
import fs from "fs";
import https from "https";
import zlib from "zlib";
import config from "./config";
import { IncomingMessage } from "http";
import { Bbox } from "facilmap-types";

const url = "https://updates.maxmind.com/geoip/databases/GeoLite2-City/update?db_md5=";
const fname = `${__dirname}/../cache/GeoLite2-City.mmdb`;
const tmpfname = fname + ".tmp";

let currentMd5: string | null = null;
let db: Reader<Response> | null = null;

if(config.maxmindUserId && config.maxmindLicenseKey) {
	cron.schedule("0 3 * * *", download);

	load().catch((err) => {
		console.trace("Error loading maxmind database", err.stack || err);
	});
	download().catch((err) => {
		console.trace("Error downloading maxmind database", err.stack || err);
	});
}

async function load() {
	if(await fs.promises.access(fname).then(() => true).catch(() => false))
		db = await maxmind.open(fname);
	else
		db = null;


}

async function download() {
	console.log("Downloading maxmind database");

	if(!currentMd5) {
		if(await fs.promises.access(fname).then(() => true).catch(() => false))
			currentMd5 = await md5(fname);
	}

	const res = await new Promise<IncomingMessage>((resolve, reject) => {
		https.get(url + (currentMd5 || ""), {
			headers: {
				Authorization: `Basic ${Buffer.from(config.maxmindUserId + ':' + config.maxmindLicenseKey).toString('base64')}`
			}
		}, resolve).on("error", reject);
	});

	if(res.statusCode == 304) {
		console.log("Maxmind database is up to date, no update needed.");
		return;
	} else if(res.statusCode != 200)
		throw new Error(`Unexpected status code ${res.statusCode} when downloading maxmind database.`);

	const gunzip = zlib.createGunzip();
	res.pipe(gunzip);

	const file = fs.createWriteStream(tmpfname);
	gunzip.pipe(file);

	await new Promise((resolve, reject) => {
		file.on("finish", resolve);
		file.on("error", reject);
	});

	await fs.promises.rename(tmpfname, fname);
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
