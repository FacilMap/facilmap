const webpack = require("webpack");

module.exports = {
	entry: `expose-loader?FacilMap.Client!${__dirname}/client.js`,
	output: {
		filename: "client.js",
		path: __dirname + "/build/"
	},
	module: {
		rules: [
			{ test: /\.js$/, loader: "babel-loader?presets=es2015" },
		]
	},
	plugins: [
		new webpack.optimize.UglifyJsPlugin({
			sourceMap: true
		})
	],
	devtool: "source-map"
};
