import { Configuration } from "webpack";

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (env: any, argv: any): Configuration => {
	const isDev = argv.mode == "development";

	return {
		entry: `${__dirname}/src/index.ts`,
		output: {
			filename: "facilmap-leaflet.js",
			path: __dirname + "/dist/",
			library: "Leaflet.FacilMap",
			libraryTarget: "umd"
		},
		resolve: {
			extensions: [ ".js", ".ts" ]
		},
		mode: isDev ? "development" : "production",
		devtool: isDev ? "eval-cheap-source-map" : "source-map",
		module: {
			rules: [
				{
					resource: { and: [ /\.ts/, [
						__dirname + "/src/"
					] ] },
					loader: "ts-loader"
				},
				{ test: /\.css$/, use: [ "style-loader", "css-loader" ] },
				{ test: /\.scss$/, use: [
					"style-loader",
					{
						loader: "css-loader",
						options: {
							modules: "global"
						}
					},
					"sass-loader"
				]},
				{
					test: /\.svg$/,
					type: 'asset/source'
				}
			]
		},
		externals : {
			leaflet: {
				commonjs: 'leaflet',
				commonjs2: 'leaflet',
				amd: 'leaflet',
				root: 'L'
			}
		},
		plugins: [
			//new BundleAnalyzerPlugin()
		],
		devServer: {
			publicPath: "/dist",
			hotOnly: true
		}
	};
};
