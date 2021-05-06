const { description } = require('../../package')

module.exports = {
	title: 'FacilMap',
	description: description,
	head: [
		['meta', { name: 'theme-color', content: '#3eaf7c' }],
		['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
		['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }]
	],
	dest: `${__dirname}/../../dist`,
	themeConfig: {
		repo: '',
		editLinks: false,
		docsDir: '',
		editLinkText: '',
		lastUpdated: false,
		nav: [
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
					title: "Overview",
					collapsable: false,
					children: [
						"",
						"help/",
						"releases/",
						"contribute/"
					]
				},
				{
					title: 'General functions',
					collapsable: false,
					children: [
						"ui/",
						"layers/",
						"search/",
						"route/",
						"click-marker/",
						"files/",
						"locate/",
						"hash/",
						"app/",
						"privacy/"
					]
				},
				{
					title: 'Collaborative maps',
					collapsable: false,
					children: [
						"collaborative/",
						"markers/",
						"lines/",
						"multiple/",
						"types/",
						"legend/",
						"views/",
						"filter/",
						"history/",
						"export/",
						"import/",
						"map-settings/"
					]
				},
			],
			'/developers/': [
				{
					title: "Developer guide",
					collapsable: false,
					children: [
						"",
						"embed"
					]
				},
				{
					title: "Server",
					collapsable: true,
					children: [
						"server/",
						"server/docker",
						"server/standalone",
						"server/config"
					]
				},
				{
					title: 'Client',
					collapsable: true,
					children: [
						"client/",
						"client/properties",
						"client/events",
						"client/methods",
						"client/types",
						"client/advanced"
					]
				},
				{
					title: "Leaflet components",
					collapsable: true,
					children: [
						"leaflet/",
						"leaflet/bbox",
						"leaflet/layers",
						"leaflet/markers",
						"leaflet/lines",
						"leaflet/route",
						"leaflet/search",
						"leaflet/icons",
						"leaflet/hash",
						"leaflet/views",
						"leaflet/filter",
						"leaflet/click-listener"
					]
				},
				{
					title: "Frontend",
					collapsable: true,
					children: [
						"frontend/",
						"frontend/facilmap"
					]
				},
				{
					title: 'Development',
					collapsable: true,
					children: [
						"development/dev-setup",
						"development/documentation"
					]
				}
			]
		}
	},
	plugins: [
		'@vuepress/plugin-back-to-top',
		'@vuepress/plugin-medium-zoom',
		'check-md'
	],
	markdown: {
		extendMarkdown: (md) => {
			md.use(require("markdown-it-footnote"));
		}
	}
}
