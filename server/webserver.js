const compression = require("compression");
const ejs = require("ejs");
const express = require("express");
const http = require("http");
const path = require("path");
const Promise = require("promise");
const webpack = require("webpack");
const webpackMiddleware = require("webpack-dev-middleware");

const config = require("../config");
const database = require("./database/database");
const utils = require("./utils");
const webpackConfig = require("../frontend/webpack.config");

const frontendPath = path.resolve(__dirname + "/../frontend");

const webserver = module.exports = {
	init(database) {
		const staticMiddleware = process.env.FM_DEV
			? webpackMiddleware(webpack(webpackConfig), {
				publicPath: "/"
			})
			: express.static(frontendPath + "/build/");


		const padMiddleware = function(req, res, next) {
			utils.promiseAuto({
				template: () => {
					// We have to let staticMiddleware create the page for us first, we cannot read it directly from the
					// file system (as webpackMiddleware might have to inject the bundle files into it).

					let intercept = utils.interceptWriteStream(res);
					req.url = req.originalUrl = "/index.ejs";
					staticMiddleware(req, res, next);
					return intercept;
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

		app.use(staticMiddleware);

		// If no file with this name has been found, we render a pad
		app.get("/:padId", padMiddleware);

		let server = http.createServer(app);
		return Promise.denodeify(server.listen.bind(server))(config.port, config.host).then(() => server);
	}
};
