const compression = require("compression");
const express = require("express");
const http = require("http");
const path = require("path");
const Promise = require("promise");
const webpack = require("webpack");
const webpackMiddleware = require("webpack-dev-middleware");

const config = require("../config");
const webpackConfig = require("../frontend/webpack.config");

const frontendPath = path.resolve(__dirname + "/../frontend");

const staticMiddleware = process.env.FM_DEV ?
	webpackMiddleware(webpack(webpackConfig), {
		publicPath: "/"
	}) :
	express.static(frontendPath + "/build/");

const webserver = module.exports = {
	init() {
		let app = express();
		app.use(compression());

		app.get("/bundle-:hash.js", function(req, res, next) {
			res.setHeader('Cache-Control', 'public, max-age=31557600'); // one year

			next();
		});

		app.use(staticMiddleware);

		app.get("/:padId", function(req, res, next) {
			req.url = req.url.replace(/[^\/]*$/, "");
			req.originalUrl = req.originalUrl.replace(/[^\/]*$/, "");

			staticMiddleware(req, res, next);
		});

		let server = http.createServer(app);
		return Promise.denodeify(server.listen.bind(server))(config.port, config.host).then(() => server);
	}
};
