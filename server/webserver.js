const compression = require("compression");
const ejs = require("ejs");
const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");
const Promise = require("promise");

const database = require("./database/database");
const gpx = require("./gpx");
const table = require("./table");
const utils = require("./utils");

const frontendPath = path.dirname(require.resolve("facilmap-frontend/package.json")); // Do not resolve main property

if(process.env.FM_DEV)
	process.chdir(frontendPath); // To make sure that webpack finds all the loaders

const webserver = module.exports = {
	init(database, port, host) {
		const staticMiddleware = process.env.FM_DEV
			? require("webpack-dev-middleware")(require("webpack")(require("facilmap-frontend/webpack.config")), { // require the stuff here so that it doesn't fail if devDependencies are not installed
				publicPath: "/"
			})
			: express.static(frontendPath + "/build/");


		const padMiddleware = function(req, res, next) {
			utils.promiseAuto({
				template: () => {
					if (process.env.FM_DEV) {
						let intercept = utils.interceptWriteStream(res);
						req.url = req.originalUrl = "/index.ejs";
						staticMiddleware(req, res, next);
						return intercept;
					} else {
						// We don't want express.static's ETag handling, as it sometimes returns an empty template,
						// so we have to read it directly from the file system

						return Promise.denodeify(fs.readFile)(`${frontendPath}/build/index.ejs`, "utf8");
					}
				},

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
					return gpx.exportGpx(database, padData ? padData.id : req.params.padId, req.query.useTracks == "1");
				},
				response: (padData, gpx) => {
					res.set("Content-type", "application/gpx+xml");
					res.attachment(padData.name.replace(/[\\\/:*?"<>|]+/g, '_') + ".gpx");
					res.send(gpx);
				}
			}).catch(next);
		});

		app.get("/:padId/table", function(req, res, next) {
			Promise.resolve().then(() => {
				if (process.env.FM_DEV) {
					let intercept = utils.interceptWriteStream(res);
					req.url = req.originalUrl = "/table.ejs";
					staticMiddleware(req, res, next);
					return intercept;
				} else {
					// We don't want express.static's ETag handling, as it sometimes returns an empty template,
					// so we have to read it directly from the file system

					return Promise.denodeify(fs.readFile)(`${frontendPath}/build/table.ejs`, "utf8");
				}
			}).then((template) => {
				return table.createTable(database, req.params.padId, template);
			}).then((renderedTable) => {
				res.type("html");
				res.send(renderedTable);
			}).catch(next);
		});

		let server = http.createServer(app);
		return Promise.denodeify(server.listen.bind(server))(port, host).then(() => server);
	}
};
