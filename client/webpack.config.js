const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (env, argv) => {
	const isDev = argv.mode == "development";

	return {
		entry: `${__dirname}/src/client.ts`,
		output: {
			filename: "client.js",
			path: __dirname + "/dist/",
			library: "FacilMap.Client",
			libraryTarget: "umd"
		},
		resolve: {
			extensions: [ ".js", ".ts" ]
		},
		mode: isDev ? "development" : "production",
		devtool: isDev ? "cheap-eval-source-map" : "source-map",
		module: {
			rules: [
				{
					resource: { and: [ /\.ts/, [
						__dirname + "/src/"
					] ] },
					loader: 'ts-loader'
				},
				{
					test: /\.css$/,
					use: [ 'style-loader', 'css-loader' ]
				}
			]
		},
		plugins: [
			//new BundleAnalyzerPlugin()
		],
		devServer: {
			publicPath: "/dist"
		}
	};
};
