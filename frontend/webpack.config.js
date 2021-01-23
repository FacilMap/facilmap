const webpack = require("webpack");
const copyPlugin = require("copy-webpack-plugin");
const htmlPlugin = require("html-webpack-plugin");
const bundleAnalyzer = require("webpack-bundle-analyzer");

const depLoaders = {
	jquery: {
		loader: "expose-loader",
		options: {
			exposes: "jQuery"
		}
	}
};

// Add imports to these modules, as they don't specify their imports properly
const addDeps = {
	// Until https://github.com/webpack-contrib/css-loader/issues/51 is resolved we have to include CSS files by hand
	//bootstrap: [ "bootstrap/dist/css/bootstrap.css", "bootstrap/dist/css/bootstrap-theme.css" ],
	//"bootstrap-touchspin": [ "bootstrap-touchspin/dist/jquery.bootstrap-touchspin.css" ],
	leaflet: [ "leaflet/dist/leaflet.css" ],
	"leaflet.locatecontrol": [ "leaflet.locatecontrol/dist/L.Control.Locate.css" ],
	"leaflet.markercluster": [ "leaflet.markercluster/dist/MarkerCluster.css", "leaflet.markercluster/dist/MarkerCluster.Default.css" ],
	"leaflet.heightgraph": [ require.resolve("leaflet.heightgraph/src/L.Control.Heightgraph.css") ],
	"leaflet-mouse-position": [ "leaflet-mouse-position/src/L.Control.MousePosition.css" ],
	"leaflet-graphicscale": [ "leaflet-graphicscale/src/Leaflet.GraphicScale.scss" ]
};

for(let i in addDeps) {
	let thisDep = {
		loader: "imports-loader",
		options: {
			imports: addDeps[i].map((dep, i) => `pure ${dep}`),
			type: "commonjs"
		}
	};

	if(depLoaders[i]) {
		depLoaders[i] = [thisDep, ...(Array.isArray(depLoaders[i]) ? depLoaders[i] : [ depLoaders[i] ])];
	} else {
		depLoaders[i] = thisDep;
	}
}

function includeHotMiddleware(entry) {
	if(!process.env.FM_DEV)
		return entry;

	if(!Array.isArray(entry))
		entry = [ entry ];

	return [ "webpack-hot-middleware/client" ].concat(entry);
}

module.exports = {
	entry: {
		map: includeHotMiddleware(__dirname + "/src/map/map.ts"),
		table: includeHotMiddleware(__dirname + "/src/table/table.ts")
	},
	output: {
		filename: "frontend-[name]-[hash].js",
		path: __dirname + "/build/"
	},
	resolve: {
		unsafeCache: true,
		alias: {
			vue: "vue/dist/vue.js"
		},
		extensions: ['.ts', '.wasm', '.mjs', '.js', '.json']
	},
	resolveLoader: {
		modules: [ `${__dirname}/node_modules` ]
	},
	module: {
		rules: [
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
				test: /\.ts$/,
				exclude: /\/node_modules\//,
				use: {
					loader: "babel-loader",
					options: {
						cwd: __dirname,
						presets: [
							"@babel/preset-env",
							"@babel/preset-typescript",
						],
						plugins: [
							[ "@babel/plugin-proposal-decorators", { legacy: true } ],
							[ "@babel/plugin-proposal-class-properties", { loose: true } ]
						]
					}
				}
			},
			{
				test: /\.js$/,
				exclude: /\/node_modules\//,
				use: {
					loader: "babel-loader",
					options: {
						cwd: __dirname,
						presets: [
							"@babel/preset-env"
						]
					}
				}
			},
			{
				test: /\.(png|jpe?g|gif|ttf|svg)$/,
				use: [
					{
						loader: "url-loader",
						options: {
							esModule: false // In order for html-loader to handle it properly
						}
					}
				]
			},
			{
				test: /\.(html|ejs|vue)$/,
				use: "html-loader"
			},
			...Object.keys(depLoaders).map(key => ({ test: new RegExp("/node_modules/" + key + "/.*\.js$"), ...(Array.isArray(depLoaders[key]) ? { use: depLoaders[key] } : depLoaders[key]) })),

			{
				test: /\/node_modules\/bootstrap\/dist\/css\/bootstrap\.css$/,
				loader: "string-replace-loader",
				options: {
					multiple: [
						{ search: "src: url\\(\"\\.\\./fonts/glyphicons-halflings-regular.eot\"\\);", replace: "", flags: "" },
						{ search: "src: url\\(\"\\.\\./fonts/glyphicons-halflings-regular\\..*", replace: "", flags: "" }
					]
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
		new webpack.ProvidePlugin({
			$: "jquery",
			jQuery: "jquery",
			"window.jQuery": "jquery",
			L: "leaflet"
		}),
		new copyPlugin({ patterns: [ "deref.html", "opensearch.xml" ].map((file) => ({ from: `${__dirname}/static/${file}` })) }),
		...(process.env.FM_DEV ? [
			new webpack.HotModuleReplacementPlugin()
		] : [
			new bundleAnalyzer.BundleAnalyzerPlugin({
				analyzerMode: "static",
				openAnalyzer: false
			}),
		]),
	],
	mode: process.env.FM_DEV ? "development" : "production",
	devtool: process.env.FM_DEV ? "eval-cheap-source-map" : "source-map"
};
