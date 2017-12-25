const compression = require("compression");
const ejs = require("ejs");
const express = require("express");
const fs = require("fs");
const http = require("http");
const jsonFormat = require("json-format");
const path = require("path");
const Promise = require("bluebird");

const database = require("./database/database");
const geojson = require("./export/geojson");
const gpx = require("./export/gpx");
const table = require("./export/table");
const utils = require("./utils");

const frontendPath = path.dirname(require.resolve("facilmap-frontend/package.json")); // Do not resolve main property

if(process.env.FM_DEV)
	process.chdir(frontendPath); // To make sure that webpack finds all the loaders

const staticMiddleware = process.env.FM_DEV
	? require("webpack-dev-middleware")(require("webpack")(require("facilmap-frontend/webpack.config")), { // require the stuff here so that it doesn't fail if devDependencies are not installed
		publicPath: "/"
	})
	: express.static(frontendPath + "/build/");

const webserver = {
	init(database, port, host) {

		const padMiddleware = function(req, res, next) {
			utils.promiseAuto({
				template: () => webserver.getFrontendFile("index.ejs"),

				padData: () => {
					if(req.params && req.params.padId) {
						return database.getPadData(req.params.padId).then((padData) => {
							// We only look up by read ID. At the moment, we only need the data for the search engine
							// meta tags, and those should be only enabled in the read-only version anyways.

							if (!padData)
								throw new Error();
							return padData;
						}).catch(() => {
							// Error will be handled on the client side when it tries to fetch the pad data
							return {
								searchEngines: false,
								description: ""
							};
						});
					}
				},

				render: (template, padData) => {
					res.type("html");
					res.send(ejs.render(template, {
						padData: padData
					}));
				}
			}).catch(next);
		};


		let app = express();
		app.use(compression());

		app.get("/bundle-:hash.js", function(req, res, next) {
			res.setHeader('Cache-Control', 'public, max-age=31557600'); // one year

			next();
		});

		app.get("/", padMiddleware);
		app.get("/index.ejs", padMiddleware);
		app.get("/table.ejs", padMiddleware);

		app.use(staticMiddleware);

		// If no file with this name has been found, we render a pad
		app.get("/:padId", padMiddleware);

		app.get("/:padId/gpx", function(req, res, next) {
			utils.promiseAuto({
				padData: database.getPadDataByAnyId(req.params.padId).then((padData) => {
					if(!padData)
						throw new Error(`Map with ID ${req.params.padId} could not be found.`);
					return padData;
				}),
				gpx: (padData) => {
					return gpx.exportGpx(database, padData ? padData.id : req.params.padId, req.query.useTracks == "1", req.query.filter);
				},
				response: (padData, gpx) => {
					res.set("Content-type", "application/gpx+xml");
					res.attachment(padData.name.replace(/[\\\/:*?"<>|]+/g, '_') + ".gpx");
					res.send(gpx);
				}
			}).catch(next);
		});

		app.get("/:padId/table", function(req, res, next) {
			return table.createTable(database, req.params.padId, req.query.filter).then((renderedTable) => {
				res.type("html");
				res.send(renderedTable);
			}).catch(next);
		});

		app.get("/:padId/geojson", function(req, res, next) {
			utils.promiseAuto({
				padData: database.getPadData(req.params.padId).then((padData) => {
					if(!padData)
						throw new Error(`Map with ID ${req.params.padId} could not be found.`);
					return padData;
				}),
				geojson: () => {
					return geojson.exportGeoJson(database, req.params.padId, req.query.filter);
				},
				response: (padData, geojson) => {
					res.set("Content-type", "application/geo+json");
					res.attachment(padData.name.replace(/[\\\/:*?"<>|]+/g, '_') + ".geojson");
					res.send(jsonFormat(geojson));
				}
			}).catch(next);
		});

		let server = http.createServer(app);
		return Promise.promisify(server.listen.bind(server))(port, host).then(() => server);
	},

	getFrontendFile(path) {
		if (process.env.FM_DEV) {
			return new Promise((resolve, reject) => {
				staticMiddleware.waitUntilValid(resolve);
			}).then(() => {
				return staticMiddleware.fileSystem.readFileSync(staticMiddleware.getFilenameFromUrl(`/${path}`), "utf8");
			});
		} else {
			// We don't want express.static's ETag handling, as it sometimes returns an empty template,
			// so we have to read it directly from the file system

			return Promise.promisify(fs.readFile)(`${frontendPath}/build/${path}`, "utf8");
		}
	}
};

Object.assign(exports, webserver);
