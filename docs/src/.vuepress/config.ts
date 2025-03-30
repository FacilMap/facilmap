import { description } from "../../package.json";
import { defaultTheme, defineUserConfig } from "vuepress";
import backToTopPlugin from "@vuepress/plugin-back-to-top";
import mediumZoomPlugin from "@vuepress/plugin-medium-zoom";
//import checkMdPluin from "vuepress-plugin-check-md";
import { searchPlugin } from "@vuepress/plugin-search";

export default defineUserConfig({
	title: 'FacilMap',
	description: description,
	head: [
		['meta', { name: 'theme-color', content: '#3eaf7c' }], // TODO: Update
		['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
		['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }]
	],
	dest: `${__dirname}/../../dist`,
	theme: defaultTheme({
		repo: '',
		docsDir: '',
		editLinkText: '',
		lastUpdated: false,
		contributors: false,
		navbar: [
			{
				text: 'Users',
				link: '/users/',
			},
			{
				text: 'Developers',
				link: '/developers/'
			}
		],
		sidebar: {
			'/users/': [
				{
					text: "Overview",
					children: [
						"/users/",
						"/users/help/",
						"/users/releases/",
						"/users/contribute/",
						"/users/privacy/"
					]
				},
				{
					text: 'General functions',
					children: [
						"/users/ui/",
						"/users/layers/",
						"/users/search/",
						"/users/pois/",
						"/users/route/",
						"/users/click-marker/",
						"/users/files/",
						"/users/locate/",
						"/users/share/",
						"/users/app/",
						"/users/user-preferences/"
					]
				},
				{
					text: 'Collaborative maps',
					children: [
						"/users/collaborative/",
						"/users/markers/",
						"/users/lines/",
						"/users/multiple/",
						"/users/types/",
						"/users/legend/",
						"/users/views/",
						"/users/filter/",
						"/users/history/",
						"/users/export/",
						"/users/import/",
						"/users/map-settings/"
					]
				},
			],
			'/developers/': [
				{
					text: "Developer guide",
					children: [
						"/developers/",
						"/developers/embed",
						"/developers/i18n"
					]
				},
				{
					text: "Server",
					children: [
						"/developers/server/",
						"/developers/server/docker",
						"/developers/server/standalone",
						"/developers/server/config"
					]
				},
				{
					text: 'API / Client',
					children: [
						"/developers/client/",
						"/developers/client/events",
						"/developers/client/methods",
						"/developers/client/types",
						"/developers/client/classes",
						"/developers/client/advanced",
						"/developers/client/changelog"
					]
				},
				{
					text: "Leaflet components",
					children: [
						"/developers/leaflet/",
						"/developers/leaflet/bbox",
						"/developers/leaflet/layers",
						"/developers/leaflet/markers",
						"/developers/leaflet/lines",
						"/developers/leaflet/route",
						"/developers/leaflet/search",
						"/developers/leaflet/overpass",
						"/developers/leaflet/icons",
						"/developers/leaflet/hash",
						"/developers/leaflet/views",
						"/developers/leaflet/filter",
						"/developers/leaflet/click-listener"
					]
				},
				{
					text: "Frontend",
					children: [
						"/developers/frontend/",
						"/developers/frontend/facilmap"
					]
				},
				{
					text: 'Development',
					children: [
						"/developers/development/dev-setup",
						"/developers/development/documentation"
					]
				}
			]
		}
	}),
	plugins: [
		//checkMdPlugin,
		searchPlugin,
	]
});
