<script setup lang="ts">
	import Component from "vue-class-component";
	import Vue from "vue";
	import packageJson from "../../../../package.json";
	import WithRender from "./about.vue";
	import { getLayers } from "facilmap-leaflet";
	import { Prop } from "vue-property-decorator";
	import "./about.scss";
	import { InjectMapComponents } from "../../utils/decorators";
	import { MapComponents } from "../leaflet-map/leaflet-map";
	import { Layer } from "leaflet";

	@WithRender
	@Component({
		components: { }
	})
	export default class About extends Vue {

		@InjectMapComponents() mapComponents!: MapComponents;

		@Prop({ type: String, required: true }) id!: string;

		get layers(): Layer[] {
			const { baseLayers, overlays } = getLayers(this.mapComponents.map);
			return [...Object.values(baseLayers), ...Object.values(overlays)];
		}

		fmVersion = packageJson.version;

	}

</script>

<template>
	<b-modal :id="id" :title="`About FacilMap ${fmVersion}`" ok-only ok-title="Close" size="lg" dialog-class="fm-about">
		<p><a href="https://github.com/facilmap/facilmap" target="_blank"><strong>FacilMap</strong></a> is available under the <a href="https://www.gnu.org/licenses/agpl-3.0.en.html" target="_blank">GNU Affero General Public License, Version 3</a>.</p>
		<p>If something does not work or you have a suggestion for improvement, please report on the <a href="https://github.com/FacilMap/facilmap/issues" target="_blank">issue tracker</a>.</p>
		<p>If you have a question, please have a look at the <a href="https://docs.facilmap.org/users/">documentation</a> or raise a question in the <a href="https://github.com/FacilMap/facilmap/discussions">discussion forum</a>.</p>
		<p><a href="https://docs.facilmap.org/users/privacy/">Privacy information</a></p>
		<h4>Map data</h4>
		<dl class="row">
			<template v-for="layer in layers" v-if="layer.options.attribution">
				<dt class="col-sm-3">{{layer.options.fmName}}</dt>
				<dd class="col-sm-9" v-html="layer.options.attribution"></dd>
			</template>

			<dt class="col-sm-3">Search</dt>
			<dd class="col-sm-9"><a href="https://nominatim.openstreetmap.org/" target="_blank">Nominatim</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a></dd>

			<dt class="col-sm-3">POIs</dt>
			<dd class="col-sm-9"><a href="https://overpass-api.de/" target="_blank">Overpass API</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a></dd>

			<dt class="col-sm-3">Directions</dt>
			<dd class="col-sm-9"><a href="https://www.mapbox.com/api-documentation/#directions">Mapbox Directions API</a> / <a href="https://openrouteservice.org/">OpenRouteService</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a></dd>

			<dt class="col-sm-3">GeoIP</dt>
			<dd class="col-sm-9">This product includes GeoLite2 data created by MaxMind, available from <a href="https://www.maxmind.com">https://www.maxmind.com</a>.</dd>
		</dl>
		<h4>Programs/libraries</h4>
		<ul>
			<li><a href="https://nodejs.org/" target="_blank">Node.js</a></li>
			<li><a href="https://sequelize.org/" target="_blank">Sequelize</a></li>
			<li><a href="https://socket.io/" target="_blank">socket.io</a></li>
			<li><a href="https://www.typescriptlang.org/" target="_blank">TypeScript</a></li>
			<li><a href="https://webpack.js.org/" target="_blank">Webpack</a></li>
			<li><a href="https://jquery.com/" target="_blank">jQuery</a></li>
			<li><a href="https://vuejs.org/" target="_blank">Vue.js</a></li>
			<li><a href="https://github.com/chjj/marked" target="_blank">Marked</a></li>
			<li><a href="https://getbootstrap.com/" target="_blank">Bootstrap</a></li>
			<li><a href="https://bootstrap-vue.org/" target="_blank">BootstrapVue</a></li>
			<li><a href="https://leafletjs.com/" target="_blank">Leaflet</a></li>
			<li><a href="http://project-osrm.org/" target="_blank">OSRM</a></li>
			<li><a href="https://openrouteservice.org/" target="_blank">OpenRouteService</a></li>
			<li><a href="https://nominatim.openstreetmap.org/" target="_blank">Nominatim</a></li>
			<li><a href="https://github.com/joewalnes/filtrex" target="_blank">Filtrex</a></li>
		</ul>
		<h4>Icons</h4>
		<ul>
			<li><a href="https://github.com/twain47/Open-SVG-Map-Icons/" target="_blank">Open SVG Map Icons</a></li>
			<li><a href="https://glyphicons.com/" target="_blank">Glyphicons</a></li>
			<li><a href="https://zavoloklom.github.io/material-design-iconic-font/index.html" target="_blank">Material Design Iconic Font</a></li>
			<li><a href="https://fontawesome.com/" target="_blank">Font Awesome</a></li>
		</ul>
	</b-modal>
</template>

<style lang="scss">
	.fm-about {
		ul {
			margin-left: 0;
			padding-left: 0;
			display: grid;
			grid-template-columns: repeat(auto-fit, 180px);
			gap: 5px;

			li {
				border: 1px solid rgba(0,0,0,.125);
				display: flex;

				a {
					flex-grow: 1;
					padding: 5px 10px;
				}
			}
		}
	}
</style>