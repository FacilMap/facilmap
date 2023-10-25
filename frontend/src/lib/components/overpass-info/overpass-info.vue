<script setup lang="ts">
	import WithRender from "./overpass-info.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { renderOsmTag } from "facilmap-utils";
	import { Type } from "facilmap-types";
	import Icon from "../ui/icon/icon";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import "./overpass-info.scss";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import { flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
	import { Context } from "../facilmap/facilmap";
	import { OverpassElement } from "facilmap-leaflet";
	import Coordinates from "../ui/coordinates/coordinates";
	import vTooltip from "../../utils/tooltip";

	@WithRender
	@Component({
		components: { Coordinates, Icon }
	})
	export default class OverpassInfo extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();
		const mapComponents = injectMapComponentsRequired();
		const mapContext = injectMapContextRequired();

		@Prop({ type: Object, required: true }) element!: OverpassElement;
		@Prop({ type: Boolean, default: false }) showBackButton!: boolean;
		@Prop({ type: Boolean, default: false }) isAdding!: boolean;

		renderOsmTag = renderOsmTag;

		get types(): Type[] {
			return Object.values(this.client.types).filter((type) => type.type == "marker");
		}

		zoomToElement(): void {
			const dest = getZoomDestinationForMarker(this.element);
			if (dest)
				flyTo(this.mapComponents.map, dest);
		}

		useAs(event: "fm-route-set-from" | "fm-route-add-via" | "fm-route-set-to"): void {
			this.mapContext.$emit(event, `${this.element.lat},${this.element.lon}`);
			this.mapContext.$emit("fm-search-box-show-tab", `fm${this.context.id}-route-form-tab`);
		}

		useAsFrom(): void {
			this.useAs("fm-route-set-from");
		}

		useAsVia(): void {
			this.useAs("fm-route-add-via");
		}

		useAsTo(): void {
			this.useAs("fm-route-set-to");
		}

	}
</script>

<template>
	<div class="fm-overpass-info">
		<h2>
			<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{element.tags.name || 'Unnamed POI'}}
		</h2>
		<dl class="fm-search-box-collapse-point">
			<dt>Coordinates</dt>
			<dd><Coordinates :point="element"></Coordinates></dd>

			<template v-for="(value, key) in element.tags">
				<dt>{{key}}</dt>
				<dd v-html="renderOsmTag(key, value)"></dd>
			</template>
		</dl>

		<b-button-toolbar>
			<button
				type="button"
				class="btn btn-light btn-sm"
				v-tooltip.hover="'Zoom to POI'"
				@click="zoomToElement()"
			>
				<Icon icon="zoom-in" alt="Zoom to POI"></Icon>
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

			<div v-if="context.search" class="dropdown">
				<button type="button" class="btn btn-light btn-sm dropdown-toggle" :disabled="isAdding">Use as</button>
				<ul class="dropdown-menu">
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="useAsFrom()"
						>Route start</a>
					</li>

					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="useAsVia()"
						>Route via</a>
					</li>

					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="useAsTo()"
						>Route destination</a>
					</li>
				</ul>
			</div>
		</b-button-toolbar>
	</div>
</template>

<style lang="scss">
	.fm-overpass-info {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.fm-search-box-collapse-point {
			min-height: 1.5em;
		}
	}
</style>