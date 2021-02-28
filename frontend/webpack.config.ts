import webpack, { Configuration } from "webpack";
import copyPlugin from "copy-webpack-plugin";
import htmlPlugin from "html-webpack-plugin";
//import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";

/*
const addDeps = {
	"angular-ui-sortable": [ "jquery-ui", "jquery-ui/ui/widgets/sortable" ],
	"bootstrap-touchspin": [ "bootstrap-touchspin/dist/jquery.bootstrap-touchspin.css" ],
	"leaflet.markercluster": [ "leaflet.markercluster/dist/MarkerCluster.css", "leaflet.markercluster/dist/MarkerCluster.Default.css" ],
	"leaflet.heightgraph": [ require.resolve("leaflet.heightgraph/src/L.Control.Heightgraph.css") ],
};
*/

function includeHotMiddleware(entry: string | string[], isDev: boolean): string | string[] {
	if(!isDev)
		return entry;

	if(!Array.isArray(entry))
		entry = [ entry ];

	return [ "webpack-hot-middleware/client" ].concat(entry);
}

module.exports = (env: any, argv: any): Configuration => {
	const isDev = argv.mode == "development" || !!process.env.FM_DEV;

	return {
		entry: {
			map: includeHotMiddleware(__dirname + "/src/map/map.ts", isDev),
			table: includeHotMiddleware(__dirname + "/src/table/table.ts", isDev)
		},
		output: {
			filename: "frontend-[name].js",
			path: __dirname + "/dist/"
		},
		resolve: {
			alias: {
				vue: "vue/dist/vue.runtime.esm.js"
			},
			extensions: ['.ts', '.wasm', '.mjs', '.js', '.json']
		},
		mode: isDev ? "development" : "production",
		devtool: isDev ? "eval-cheap-source-map" : "source-map",
		module: {
			rules: [
				{
					resource: /\.ts/,
					use: {
						loader: "ts-loader",
						options: { onlyCompileBundledFiles: true }
					}
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
					test: /\.(png|jpe?g|gif|ttf)$/,
					type: 'asset/inline'
				},
				{
					test: /\.(svg)$/,
					type: 'asset/source'
				},
				{
					test: /\.(html|ejs)$/,
					use: "html-loader"
				},
				{
					test: /\.vue$/,
					loader: "vue-template-loader",
					options: {
						transformAssetUrls: {
							img: 'src'
						}
					}
				}
			],
		},
		plugins: [
			new htmlPlugin({
				template: `${__dirname}/src/map/map.ejs`,
				filename: "map.ejs",
				chunks: ["map"]
			}),
			new htmlPlugin({
				template: `${__dirname}/src/table/table.ejs`,
				filename: "table.ejs",
				chunks: ["table"]
			}),
			new copyPlugin({ patterns: [ "deref.html", "opensearch.xml" ].map((file) => ({ from: `${__dirname}/static/${file}` })) }),
			...(isDev ? [
				new webpack.HotModuleReplacementPlugin()
			] : [
				//new BundleAnalyzerPlugin(),
			]),
		],
		devServer: {
			publicPath: "/dist",
			//hotOnly: true,
			disableHostCheck: true,
			writeToDisk: true,
			injectClient: false // https://github.com/webpack/webpack-dev-server/issues/2484
		}
	};
};