const messagesEn = {
	"about-dialog": {
		"header": `About FacilMap {{version}}`,
		"license-text": `{{facilmap}} is available under the {{license}}.`,
		"license-text-facilmap": `FacilMap`,
		"license-text-license": `GNU Affero General Public License, Version 3`,
		"issues-text": `If something does not work or you have a suggestion for improvement, please report on the {{tracker}}.`,
		"issues-text-tracker": `issue tracker`,
		"help-text": `If you have a question, please have a look at the {{documentation}}, raise a question in the {{discussions}} or ask in the {{chat}}.`,
		"help-text-documentation": `documentation`,
		"help-text-discussions": `discussion forum`,
		"help-text-chat": `Matrix chat`,
		"privacy-information": `Privacy information`,
		"map-data": `Map data`,
		"map-data-search": `Search`,
		"map-data-pois": `POIs`,
		"map-data-directions": `Directions`,
		"map-data-geoip": `GeoIP`,
		"map-data-geoip-description": `This product includes GeoLite2 data created by MaxMind, available from {{maxmind}}.`,
		"attribution-osm-contributors": `OSM Contributors`,
		"programs-libraries": `Programs/libraries`,
		"icons": `Icons`
	},

	"click-marker-tab": {
		"look-up-error": `Error looking up point`
	},

	"client-provider": {
		"loading-map-header": `Loading`,
		"loading-map": `Loading map…`,
		"connecting-header": `Connecting`,
		"connecting": `Connecting to server…`,
		"map-deleted-header": `Map deleted`,
		"map-deleted": `This map has been deleted.`,
		"close-map": `Close map`,
		"connection-error": `Error connecting to server`,
		"open-map-error": `Error opening map`,
		"disconnected-header": `Disconnected`,
		"disconnected": `The connection to the server was lost. Trying to reconnect…`
	},

	"edit-filter-dialog": {
		"title": `Filter`,
		"apply": `Apply`,
		"introduction": `Here you can set an advanced expression to show/hide certain markers/lines based on their attributes. The filter expression only applies to your view of the map, but it can be persisted as part of a saved view or a shared link.`,
		"syntax-header": `Syntax`,
		"variable": `Variable`,
		"operator": `Operator`,
		"description": `Description`,
		"example": `Example`,
		"name-description": `Marker/Line name`,
		"type-description": `{{marker}} / {{line}}`,
		"typeId-description": `{{items}})`,
		"typeId-description-item": `{{typeId}} ({{typeName}})`,
		"typeId-description-separator": ` / `,
		"data-description-1": `Field values (example: {{example1}} or {{example2}}).`,
		"data-description-2": `For checkbox fields, the value is {{uncheckedValue}} (unchecked) or {{checkedValue}} (checked).`,
		"lon-lat-description": `Marker coordinates`,
		"colour-description": `Marker/line colour`,
		"size-description": `Marker size`,
		"symbol-description": `Marker icon`,
		"shape-description": `Marker shape`,
		"ele-description": `Marker elevation`,
		"mode-description": `Line routing mode ({{straight}} / {{car}} / {{bicycle}} / {{pedestrian}} / {{track}})`,
		"width-description": `Line width`,
		"stroke-description": `Line stroke ({{solid}} (solid) / {{dashed}} / {{dotted}})`,
		"distance-description": `Line distance in kilometers`,
		"time-description": `Line routing time in seconds`,
		"ascent-descent-description": `Total ascent/descent of line`,
		"routePoints-description": `Line point coordinates`,
		"number-description": `Numerical value`,
		"text-description": `Text value`,
		"mathematical-description": `Mathematical operations ({{modulo}}: modulo, {{power}}: power)`,
		"logical-description": `Logical operators`,
		"ternary-description": `if/then/else operator`,
		"comparison-description": `Comparison ({{notEqual}}: not equal) (case sensitive)`,
		"list-description": `List operator (case sensitive)`,
		"regexp-description": `Regular expression match (case sensitive)`,
		"lower-description": `Convert to lower case`,
		"round-description": `Round ({{ceil}}: up, {{floor}}: down)`,
		"functions-description": `Mathematical functions`,
		"min-max-description": `Smallest/highest value`
	},

	"modal-dialog": {
		"close": "Close",
		"cancel": "Cancel",
		"save": "Save"
	},

	"user-preferences-dialog": {
		"title": `User preferences`,
		"introduction": `These settings are stored on your computer as a cookie and are applied independently of the opened map.`,
		"language": `Language`,
		"units": `Units`,
		"units-metric": `Metric`,
		"units-us": `US customary (miles, feet)`
	}
};

export default messagesEn;