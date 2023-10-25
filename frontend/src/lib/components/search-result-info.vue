<script setup lang="ts">
	import WithRender from "./search-result-info.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { renderOsmTag } from "facilmap-utils";
	import { SearchResult, Type } from "facilmap-types";
	import Icon from "../ui/icon/icon";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import "./search-result-info.scss";
	import { FileResult } from "../../utils/files";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import { isLineResult, isMarkerResult } from "../../utils/search";
	import { flyTo, getZoomDestinationForSearchResult } from "../../utils/zoom";
	import { Context } from "../facilmap/facilmap";
	import Coordinates from "../ui/coordinates/coordinates";
	import vTooltip from "../utils/tooltip";

	@WithRender
	@Component({
		components: { Coordinates, Icon }
	})
	export default class SearchResultInfo extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();
		const mapComponents = injectMapComponentsRequired();
		const mapContext = injectMapContextRequired();

		@Prop({ type: Object, required: true }) result!: SearchResult | FileResult;
		@Prop({ type: Boolean, default: false }) showBackButton!: boolean;
		@Prop({ type: Boolean, default: false }) isAdding!: boolean;

		renderOsmTag = renderOsmTag;

		get isMarker(): boolean {
			return isMarkerResult(this.result);
		}

		get isLine(): boolean {
			return isLineResult(this.result);
		}

		get types(): Type[] {
			// Result can be both marker and line
			return Object.values(this.client.types).filter((type) => (this.isMarker && type.type == "marker") || (this.isLine && type.type == "line"));
		}

		zoomToResult(): void {
			const dest = getZoomDestinationForSearchResult(this.result);
			if (dest)
				flyTo(this.mapComponents.map, dest);
		}

	}
</script>

<template>
	<div class="fm-search-result-info" v-if="result">
		<h2>
			<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{result.short_name}}
		</h2>
		<dl class="fm-search-box-collapse-point">
			<dt v-if="result.type">Type</dt>
			<dd v-if="result.type">{{result.type}}</dd>

			<dt v-if="result.address">Address</dt>
			<dd v-if="result.address">{{result.address}}</dd>

			<dt v-if="result.type != 'coordinates' && result.lat != null && result.lon != null">Coordinates</dt>
			<dd v-if="result.type != 'coordinates' && result.lat != null && result.lon != null"><Coordinates :point="result"></Coordinates></dd>

			<dt v-if="result.elevation != null">Elevation</dt>
			<dd v-if="result.elevation != null">{{result.elevation}} m</dd>

			<template v-for="(value, key) in result.extratags">
				<dt>{{key}}</dt>
				<dd v-html="renderOsmTag(key, value)"></dd>
			</template>
		</dl>

		<b-button-toolbar>
			<button
				type="button"
				class="btn btn-light btn-sm"
				v-tooltip="'Zoom to search result'"
				@click="zoomToResult()"
			>
				<Icon icon="zoom-in" alt="Zoom to search result"></Icon>
			</button>

			<div v-if="!client.readonly && types.length > 0" class="dropdown">
				<button type="button" class="btn btn-light btn-sm dropdown-toggle" :disabled="isAdding">
					<div v-if="isAdding" class="spinner-border spinner-border-sm"></div>
					Add to map
				</button>
				<ul class="dropdown-menu">
					<template v-for="type in types">
						<li>
							<a
								href="javascript:"
								class="dropdown-item"
								@click="$emit('add-to-map', type)"
							>{{type.name}}</a>
						</li>
					</template>
				</ul>
			</div>

			<div v-if="isMarker && context.search" class="dropdown">
				<button type="button" class="btn btn-light btn-sm dropdown-toggle">Use as</button>
				<ul class="dropdown-menu">
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="$emit('use-as-from')"
						>Route start</a>
					</li>

					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="$emit('use-as-via')"
						>Route via</a>
					</li>

					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="$emit('use-as-to')"
						>Route destination</a>
					</li>
				</ul>
			</div>
		</b-button-toolbar>
	</div>
</template>

<style lang="scss">
	.fm-search-result-info {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.fm-search-box-collapse-point {
			min-height: 1.5em;
		}
	}
</style>