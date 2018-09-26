const webpack = require("webpack");

module.exports = {
	entry: `expose-loader?FacilMap.Client!${__dirname}/client.js`,
	output: {
		filename: "client.js",
		path: __dirname + "/build/"
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				use: {
					loader: "babel-loader",
					options: {
						presets: [ "@babel/preset-env" ]
					}
				}
			}
		]
	},
	mode: "production",
	devtool: "source-map"
};
