import 'leaflet.heightgraph';
import $ from 'jquery';
import L from 'leaflet';

import css from './heightgraph.scss';

export default class FmHeightgraph extends L.Control.Heightgraph {
	constructor(options) {
		super(Object.assign({
			margins: {
				top: 20,
				right: 10,
				bottom: 45,
				left: 50
			},
			mappings: {
				"": {
					"": { text: 'unknown', color: '#4682B4' }
				},
				steepness: {
					'-5': { text: '16%+', color: '#028306' },
					'-4': { text: '10-15%', color: '#2AA12E' },
					'-3': { text: '7-9%', color: '#53BF56' },
					'-2': { text: '4-6%', color: '#7BDD7E' },
					'-1': { text: '1-3%', color: '#A4FBA6' },
					'0': { text: '0%', color: '#ffcc99' },
					'1': { text: '1-3%', color: '#F29898' },
					'2': { text: '4-6%', color: '#E07575' },
					'3': { text: '7-9%', color: '#CF5352' },
					'4': { text: '10-15%', color: '#BE312F' },
					'5': { text: '16%+', color: '#AD0F0C' }
				},
				waytypes: {
					'0': { text: 'Other', color: '#30959e' },
					'1': { text: 'StateRoad', color: '#3f9da6' },
					'2': { text: 'Road', color: '#4ea5ae' },
					'3': { text: 'Street', color: '#5baeb5' },
					'4': { text: 'Path', color: '#67b5bd' },
					'5': { text: 'Track', color: '#73bdc4' },
					'6': { text: 'Cycleway', color: '#7fc7cd' },
					'7': { text: 'Footway', color: '#8acfd5' },
					'8': { text: 'Steps', color: '#96d7dc' },
					'9': { text: 'Ferry', color: '#a2dfe5' },
					'10': { text: 'Construction', color: '#ade8ed' }
				},
				surface: {
					'0': { text: 'Other', color: '#ddcdeb' },
					'1': { text: 'Paved', color: '#cdb8df' },
					'2': { text: 'Unpaved', color: '#d2c0e3' },
					'3': { text: 'Asphalt', color: '#bca4d3' },
					'4': { text: 'Concrete', color: '#c1abd7' },
					'5': { text: 'Cobblestone', color: '#c7b2db' },
					'6': { text: 'Metal', color: '#e8dcf3' },
					'7': { text: 'Wood', color: '#eee3f7' },
					'8': { text: 'Compacted Gravel', color: '#d8c6e7' },
					'9': { text: 'Fine Gravel', color: '#8f9de4' },
					'10': { text: 'Gravel', color: '#e3d4ef' },
					'11': { text: 'Dirt', color: '#99a6e7' },
					'12': { text: 'Ground', color: '#a3aeeb' },
					'13': { text: 'Ice', color: '#acb6ee' },
					'14': { text: 'Salt', color: '#b6c0f2' },
					'15': { text: 'Sand', color: '#c9d1f8' },
					'16': { text: 'Woodchips', color: '#c0c8f5' },
					'17': { text: 'Grass', color: '#d2dafc' },
					'18': { text: 'Grass Paver', color: '#dbe3ff' }
				},
				tollways: {
					0: { text: "No tollway", color: "#6ca97b" },
					1: { text: "Tollway", color: "#ffb347" }
				}
			}
		}, options));
	}

	onAdd(map) {
		// Work around double margins (https://github.com/GIScience/Leaflet.Heightgraph/issues/33)
		let sizeBkp = { width: this.options.width, height: this.options.height };
		this.options.width = sizeBkp.width + this.options.margins.left + this.options.margins.right;
		this.options.height = sizeBkp.height + this.options.margins.top + this.options.margins.bottom;

		let el = $("svg", super.onAdd(map));

		Object.assign(this.options, sizeBkp);

		if(this._data)
			super.addData(this._data);

		el.addClass(css.className);

		return el[0];
	}

	addData(extraInfo, trackPoints) {
		let data = FmHeightgraph.createGeoJsonForHeightGraph(extraInfo, trackPoints);

		if(this._container)
			super.addData(data);
		else
			this._data = data;
	}

	_appendScales() {
		super._appendScales();

		//this._xAxis.ticks(3);
	}

	static trackSegment(trackPoints, fromIdx, toIdx) {
		let ret = [];

		for(let i=fromIdx; i<trackPoints.length; i++) {
			if(trackPoints[i] && trackPoints[i].ele != null) {
				ret.push(trackPoints[i]);

				if(i >= toIdx) // Makes sure that if toIdx does not exist in trackPoints, the next trackPoint is added, which avoids gaps between the segments, as required by leaflet.heightgraph
					break;
			}
		}

		return ret;
	}

	static createGeoJsonForHeightGraph(extraInfo, trackPoints) {
		let geojson = [];

		if(!extraInfo || Object.keys(extraInfo).length == 0)
			extraInfo = { "": [[ 0, trackPoints.length-1, "" ]] };

		for(let i in extraInfo) {
			let featureCollection = {
				type: "FeatureCollection",
				features: [],
				properties: {
					summary: i
				}
			};

			for(let segment in extraInfo[i]) {
				featureCollection.features.push({
					type: "Feature",
					geometry: {
						type: "LineString",
						coordinates: FmHeightgraph.trackSegment(trackPoints, extraInfo[i][segment][0], extraInfo[i][segment][1]).map((trackPoint) => ([trackPoint.lon, trackPoint.lat, trackPoint.ele]))
					},
					properties: {
						attributeType: extraInfo[i][segment][2]
					}
				});
			}

			geojson.push(featureCollection);
		}
		return geojson;
	}
}