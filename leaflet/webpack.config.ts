import { Configuration } from "webpack";
import nodeExternals from "webpack-node-externals";

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

function makeExternals(externals: Record<string, string | string[]>): Configuration['externals'] {
	const result: Configuration['externals'] = {};
	for (const name of Object.keys(externals)) {
		result[name] = {
			commonjs: name,
			commonjs2: name,
			amd: name,
			root: externals[name]
		};
	}
	return result;
}

module.exports = (env: any, argv: any): Configuration[] => {
	const isDev = argv.mode == "development";
	const path = __dirname + "/dist/";

	const base: Configuration = {
		entry: `${__dirname}/src/index.ts`,
		resolve: {
			extensions: [ ".js", ".ts" ]
		},
		mode: isDev ? "development" : "production",
		devtool: isDev ? "eval-cheap-source-map" : "source-map",
		module: {
			rules: [
				{
					resource: /\.ts/,
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
		plugins: [
			//new BundleAnalyzerPlugin()
		],
		devServer: {
			publicPath: "/dist",
			//hotOnly: true,
			disableHostCheck: true,
			injectClient: false, // https://github.com/webpack/webpack-dev-server/issues/2484
			port: 8081
		}
	};

	return [
		{
			...base,
			name: "module",
			output: {
				filename: "facilmap-leaflet.js",
				path,
				libraryTarget: "commonjs2"
			},
			optimization: {
				minimize: false
			},
			externalsType: "commonjs2",
			externals: nodeExternals({
				additionalModuleDirs: [
					`${__dirname}/../node_modules`
				],
				allowlist: /\.css$/
			})
		},
		{
			...base,
			entry: ["facilmap-client", base.entry as string],
			name: "full",
			output: {
				filename: "facilmap-leaflet.full.js",
				path,
				library: ["L", "FacilMap"],
				libraryTarget: "umd"
			},
			externals: makeExternals({
				"leaflet": "L"
			}),
			module: {
				...base.module,
				rules: [
					...base.module!.rules!,
					{
						test: require.resolve("facilmap-client"),
						loader: "expose-loader",
						options: {
							exposes: "FacilMap.Client"
						}
					}
				]
			}
		}
	];
};
