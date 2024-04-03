<script setup lang="ts">
	import { getLayers } from "facilmap-leaflet";
	import { type Layer, Util } from "leaflet";
	import { computed } from "vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { injectContextRequired, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { T, useI18n } from "../utils/i18n";

	const { t } = useI18n();

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);

	const emit = defineEmits<{
		hidden: [];
	}>();

	const layers = computed((): Layer[] => {
		const { baseLayers, overlays } = getLayers(mapContext.value.components.map);
		return [...Object.values(baseLayers), ...Object.values(overlays)];
	});

	const fmVersion = __FM_VERSION__;
</script>

<template>
	<ModalDialog
		:title="t('about-dialog.header', { version: fmVersion })"
		class="fm-about"
		size="lg"
		@hidden="emit('hidden')"
	>
		<p>
			<T k="about-dialog.license-text">
				<template #facilmap>
					<a href="https://github.com/facilmap/facilmap" target="_blank"><strong>{{t('about-dialog.license-text-facilmap')}}</strong></a>
				</template>
				<template #license>
					<a href="https://www.gnu.org/licenses/agpl-3.0.en.html" target="_blank">{{t('about-dialog.license-text-license')}}</a>
				</template>
			</T>
		</p>
		<p>
			<T k="about-dialog.issues-text">
				<template #tracker>
					<a href="https://github.com/FacilMap/facilmap/issues" target="_blank">{{t('about-dialog.issues-text-tracker')}}</a>
				</template>
			</T>
		</p>

		<p>
			<T k="about-dialog.help-text">
				<template #documentation>
					<a href="https://docs.facilmap.org/users/" target="_blank">{{t('about-dialog.help-text-documentation')}}</a>
				</template>
				<template #discussions>
					<a href="https://github.com/FacilMap/facilmap/discussions" target="_blank">{{t('about-dialog.help-text-discussions')}}</a>
				</template>
				<template #chat>
					<a href="https://matrix.to/#/#facilmap:rankenste.in" target="_blank">{{t('about-dialog.help-text-chat')}}</a>
				</template>
			</T>
		</p>

		<p><a href="https://docs.facilmap.org/users/privacy/" target="_blank">{{t('about-dialog.privacy-information')}}</a></p>
		<h4>{{t('about-dialog.map-data')}}</h4>
		<dl class="row">
			<template v-for="layer in layers">
				<template v-if="layer.options.attribution">
					<dt :key="`name-${Util.stamp(layer)}`" class="col-sm-3">{{layer.options.fmName}}</dt>
					<dd :key="`attribution-${Util.stamp(layer)}`" class="col-sm-9" v-html="layer.options.attribution"></dd>
				</template>
			</template>

			<dt class="col-sm-3">{{t('about-dialog.map-data-search')}}</dt>
			<dd class="col-sm-9"><a href="https://nominatim.openstreetmap.org/" target="_blank">Nominatim</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">{{t('about-dialog.attribution-osm-contributors')}}</a></dd>

			<dt class="col-sm-3">{{t('about-dialog.map-data-pois')}}</dt>
			<dd class="col-sm-9"><a href="https://overpass-api.de/" target="_blank">Overpass API</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">{{t('about-dialog.attribution-osm-contributors')}}</a></dd>

			<dt class="col-sm-3">{{t('about-dialog.map-data-directions')}}</dt>
			<dd class="col-sm-9"><a href="https://www.mapbox.com/api-documentation/#directions">Mapbox Directions API</a> / <a href="https://openrouteservice.org/">OpenRouteService</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank">{{t('about-dialog.attribution-osm-contributors')}}</a></dd>

			<dt class="col-sm-3">{{t('about-dialog.map-data-geoip')}}</dt>
			<dd class="col-sm-9">
				<T k="about-dialog.map-data-geoip-description">
					<template #maxmind>
						<a href="https://www.maxmind.com">https://www.maxmind.com</a>
					</template>
				</T>
			</dd>
		</dl>
		<h4>{{t('about-dialog.programs-libraries')}}</h4>
		<ul>
			<li><a href="https://nodejs.org/" target="_blank">Node.js</a></li>
			<li><a href="https://sequelize.org/" target="_blank">Sequelize</a></li>
			<li><a href="https://socket.io/" target="_blank">socket.io</a></li>
			<li><a href="https://www.typescriptlang.org/" target="_blank">TypeScript</a></li>
			<li><a href="https://vuejs.org/" target="_blank">Vue.js</a></li>
			<li><a href="https://vitejs.dev/" target="_blank">Vite</a></li>
			<li><a href="https://getbootstrap.com/" target="_blank">Bootstrap</a></li>
			<li><a href="https://leafletjs.com/" target="_blank">Leaflet</a></li>
			<li><a href="http://project-osrm.org/" target="_blank">OSRM</a></li>
			<li><a href="https://openrouteservice.org/" target="_blank">OpenRouteService</a></li>
			<li><a href="https://nominatim.openstreetmap.org/" target="_blank">Nominatim</a></li>
			<li><a href="https://github.com/joewalnes/filtrex" target="_blank">Filtrex</a></li>
			<li><a href="https://github.com/chjj/marked" target="_blank">Marked</a></li>
			<li><a href="https://github.com/cure53/DOMPurify" target="_blank">DOMPurify</a></li>
			<li><a href="https://expressjs.com/" target="_blank">Express</a></li>
			<li><a href="https://vuepress.vuejs.org/" target="_blank">Vuepress</a></li>
			<li><a href="https://www.i18next.com/" target="_blank">I18next</a></li>
		</ul>
		<h4>{{t('about-dialog.icons')}}</h4>
		<ul>
			<li><a href="https://github.com/twain47/Open-SVG-Map-Icons/" target="_blank">Open SVG Map Icons</a></li>
			<li><a href="https://glyphicons.com/" target="_blank">Glyphicons</a></li>
			<li><a href="https://zavoloklom.github.io/material-design-iconic-font/index.html" target="_blank">Material Design Iconic Font</a></li>
			<li><a href="https://fontawesome.com/" target="_blank">Font Awesome</a></li>
		</ul>
	</ModalDialog>
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