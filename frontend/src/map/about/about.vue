<b-modal :id="id" :title="`About FacilMap ${fmVersion}`" ok-only ok-title="Close" size="lg" dialog-class="fm-about">
	<p><a :href="fmHomepage" target="_blank"><strong>FacilMap</strong></a> is available under the <a href="https://www.gnu.org/licenses/agpl-3.0.en.html" target="_blank">GNU Affero General Public License, Version 3</a>.</p>
	<p>If something does not work or you have a suggestion for improvement, please report on the <a :href="fmBugTracker" target="_blank">issue tracker</a>.</p>
	<h4>Privacy</h4>
	<p>
		FacilMap aims to be a privacy-friendly open-source alternative to commercial maps that track your data. When you use FacilMap,
		anything you do on the map (for example pan/zoom the map, search for something, calculate a route, add a marker) is sent to the
		FacilMap server and persisted there only if necessary for the interaction. No personally identifiable information is persisted
		(for example your IP address). FacilMap stores the zoom preferences that you set in the search bar (auto-zoom, etc.) in the
		localStorage of your browser, but it does not set any cookies.
	</p>
	<p>
		FacilMap combines multiple third-party services (listed below under “Map data”) into one versatile map. When you use FacilMap,
		your browser will retrieve the information provided by these services directly from there. FacilMap will send the current position
		of the map and (for the search/route service) the search terms to those services. Your browser will send your IP address and
		potentially some cookies that these services have set. It remains at the discretion of those third-party services what they
		do with this data.
	</p>
	<h4>Map data</h4>
	<dl class="row">
		<template v-for="layer in layers" v-if="layer.options.attribution">
			<dt class="col-sm-3">{{layer.options.fmName}}</dt>
			<dd class="col-sm-9" v-html="layer.options.attribution"></dd>
		</template>

		<dt class="col-sm-3">Search</dt>
		<dd class="col-sm-9"><a href="https://nominatim.openstreetmap.org/" target="_blank">Nominatim</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a></dd>

		<dt class="col-sm-3">Directions</dt>
		<dd class="col-sm-9"><a href="https://www.mapbox.com/api-documentation/#directions">Mapbox Directions API</a> / <a href="https://openrouteservice.org/">OpenRouteService</a> / <a href="http://www.openstreetmap.org/copyright" target="_blank">OSM Contributors</a></dd>

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