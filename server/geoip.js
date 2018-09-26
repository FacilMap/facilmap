const promisify = require("promisify-node");
const md5 = require("md5-file/promise");
const cron = require("node-cron");
const maxmind = promisify("maxmind");
const fs = promisify("fs");
const https = require("https");
const zlib = require("zlib");

const config = require("../config");
const utils = require("./utils");

const url = "https://updates.maxmind.com/geoip/databases/GeoLite2-City/update?db_md5=";
const fname = `${__dirname}/cache/GeoLite2-City.mmdb`;
const tmpfname = fname + ".tmp";

let currentMd5 = null;
let db = null;

if(config.maxmind) {
	cron.schedule("0 3 * * *", download);

	load().catch((err) => {
		console.trace("Error loading maxmind database", err.stack || err);
	});
	download().catch((err) => {
		console.trace("Error downloading maxmind database", err.stack || err);
	});
}

async function load() {
	if(await fs.access(fname).then(() => true).catch(() => false))
		db = await maxmind.open(fname);
	else
		db = null;


}

async function download() {
	console.log("Downloading maxmind database");

	if(!currentMd5) {
		if(await fs.access(fname).then(() => true).catch(() => false))
			currentMd5 = await md5(fname);
	}

	let res = await new Promise((resolve, reject) => {
		https.get(url + (currentMd5 || ""), resolve).on("error", reject);
	});

	if(res.statusCode == 304) {
		console.log("Maxmind database is up to date, no update needed.");
		return;
	} else if(res.statusCode != 200)
		throw new Error(`Unexpected status code ${res.statusCode} when downloading maxmind database.`);

	let gunzip = zlib.createGunzip();
	res.pipe(gunzip);

	let file = fs.createWriteStream(tmpfname);
	gunzip.pipe(file);

	await new Promise((resolve, reject) => {
		file.on("finish", resolve);
		file.on("error", reject);
	});

	await fs.rename(tmpfname, fname);
	currentMd5 = await md5(fname);

	await load();

	console.log("Maxmind database downloaded");
}

const geoip = module.exports = {
	async lookup(ip) {
		if(!db)
			return null;

		let ret = db.get(ip);

		if(ret && ret.location) {
			let distLat = utils.distanceToDegreesLat(ret.location.accuracy_radius);
			let distLon = utils.distanceToDegreesLon(ret.location.accuracy_radius, ret.location.latitude);

			return {
				top: ret.location.latitude + distLat,
				right: ret.location.longitude + distLon,
				bottom: ret.location.latitude - distLat,
				left: ret.location.longitude - distLon
			};
		} else
			return null;
	}
};
