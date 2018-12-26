const webpack = require("webpack");
const copyPlugin = require("copy-webpack-plugin");
const duplicatePlugin = require("./webpack-duplicates");
const htmlPlugin = require("html-webpack-plugin");
const bundleAnalyzer = require("webpack-bundle-analyzer");

const depLoaders = {
	jquery: "expose-loader?jQuery",
	angular: "exports-loader?window.angular",
	"leaflet.heightgraph": "imports-loader?d3=d3"
};

// Add imports to these modules, as they don't specify their imports properly
const addDeps = {
	"angular-ui-sortable": [ "jquery-ui", "jquery-ui/ui/widgets/sortable" ],

	// Until https://github.com/webpack-contrib/css-loader/issues/51 is resolved we have to include CSS files by hand
	bootstrap: [ "bootstrap/dist/css/bootstrap.css", "bootstrap/dist/css/bootstrap-theme.css" ],
	"leaflet-simple-graticule": [ "leaflet-simple-graticule/L.SimpleGraticule.css" ],
	"bootstrap-touchspin": [ "bootstrap-touchspin/dist/jquery.bootstrap-touchspin.css" ],
	leaflet: [ "leaflet/dist/leaflet.css" ],
	"leaflet.locatecontrol": [ "leaflet.locatecontrol/dist/L.Control.Locate.css" ],
	"leaflet.markercluster": [ "leaflet.markercluster/dist/MarkerCluster.css", "leaflet.markercluster/dist/MarkerCluster.Default.css" ],
	"leaflet.heightgraph": [ require.resolve("leaflet.heightgraph/src/L.Control.Heightgraph.css") ],
	"leaflet-mouse-position": [ "leaflet-mouse-position/src/L.Control.MousePosition.css" ],
	"leaflet-graphicscale": [ "leaflet-graphicscale/src/Leaflet.GraphicScale.scss" ]
};

for(let i in addDeps) {
	let thisDep = `imports-loader?${addDeps[i].map((dep, i) => `fmImport${i}=${dep}`).join(",")}`;
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
		index: includeHotMiddleware(__dirname + "/index/index.js"),
		table: includeHotMiddleware(__dirname + "/table/table.js")
	},
	output: {
		filename: "frontend-[name]-[hash].js",
		path: __dirname + "/build/"
	},
	resolve: {
		unsafeCache: true,
		alias: {
			angular: "angular/angular", // We cannot use the main file, as it exports the variable "angular", which clashes with this ProvidePlugin
			"leaflet.heightgraph": "leaflet.heightgraph/src/L.Control.Heightgraph.js",
			d3: `${__dirname}/lib/d3.js`
		}
	},
	module: {
		rules: [
			{ test: /\.css$/, use: [ "style-loader", "css-loader" ] },
			{ test: /\.scss$/, use: [ "style-loader", "css-loader", "sass-loader" ]},
			{
				test: /\.js$/,
				exclude: /\/node_modules\//,
				use: {
					loader: "babel-loader",
					options: {
						presets: [ "@babel/preset-env" ],
						plugins: [ require("babel-plugin-angularjs-annotate") ]
					}
				}
			},
			{ test: /\.(png|jpe?g|gif|ttf|svg)$/, loader: "url-loader" },
			{ test: /\.(html|ejs)$/, loader: "html-loader?attrs[]=img:src&attrs[]=link:href" },
			...Object.keys(depLoaders).map(key => ({ test: new RegExp("/node_modules/" + key + "/.*\.js$"), [Array.isArray(depLoaders[key]) ? "use" : "loader"]: depLoaders[key] })),

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
		new duplicatePlugin(),
		new htmlPlugin({
			template: `${__dirname}/index/index.ejs`,
			filename: "index.ejs",
			chunks: ["index"]
		}),
		new htmlPlugin({
			template: `${__dirname}/table/table.ejs`,
			filename: "table.ejs",
			chunks: ["table"]
		}),
		new webpack.ProvidePlugin({
		    $: "jquery",
		    jQuery: "jquery",
		    "window.jQuery": "jquery",
			L: "leaflet",
			angular: "angular"
		}),
		new copyPlugin([ "deref.html", "opensearch.xml" ].map((file) => ({ from: `${__dirname}/static/${file}` }))),
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
	devtool: process.env.FM_DEV ? "cheap-eval-source-map" : "source-map"
};
