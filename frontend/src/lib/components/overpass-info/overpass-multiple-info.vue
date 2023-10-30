<script setup lang="ts">
	import WithRender from "./overpass-multiple-info.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import "./overpass-multiple-info.scss";
	import { combineZoomDestinations, flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
	import Icon from "../ui/icon/icon";
	import { Context } from "../facilmap/facilmap";
	import OverpassInfo from "./overpass-info";
	import { OverpassElement } from "facilmap-leaflet";
	import { MarkerCreate, Type } from "facilmap-types";
	import { SelectedItem } from "../../utils/selection";
	import { showErrorToast } from "../../utils/toasts";
	import StringMap from "../../utils/string-map";
	import { mapTagsToType } from "../search-results/utils";
	import vTooltip from "../../utils/tooltip";

	@WithRender
	@Component({
		components: { Icon, OverpassInfo }
	})
	export default class OverpassMultipleInfo extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();
		const mapContext = injectMapContextRequired();
		const mapComponents = injectMapComponentsRequired();

		@Prop({ type: Array, required: true }) elements!: OverpassElement[];

		openedElement: OverpassElement | null = null;
		activeTab = 0;
		isAdding = false;

		get types(): Type[] {
			return Object.values(this.client.types).filter((type) => type.type == "marker");
		}

		zoomToElement(element: OverpassElement): void {
			const zoomDestination = getZoomDestinationForMarker(element);
			if (zoomDestination)
				flyTo(this.mapComponents.map, zoomDestination);
		}

		openElement(element: OverpassElement): void {
			this.openedElement = element;
			this.activeTab = 1;
		}

		zoom(): void {
			const zoomDestination = combineZoomDestinations(this.elements.map((element) => getZoomDestinationForMarker(element)));
			if (zoomDestination)
				flyTo(this.mapComponents.map, zoomDestination);
		}

		async addToMap(elements: OverpassElement[], type: Type): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-overpass-multiple-info-add-error`);
			this.isAdding = true;

			try {
				const selection: SelectedItem[] = [];

				for (const element of elements) {
					const obj: Partial<MarkerCreate<StringMap>> = {
						name: element.tags.name || "",
						data: mapTagsToType(element.tags || {}, type)
					};

					const marker = await this.client.addMarker({
						...obj,
						lat: element.lat,
						lon: element.lon,
						typeId: type.id
					});

					selection.push({ type: "marker", id: marker.id });
				}

				this.mapComponents.selectionHandler.setSelectedItems(selection, true);
			} catch (err) {
				toasts.showErrorToast(this, `fm${this.context.id}-overpass-multiple-info-add-error`, "Error adding to map", err);
			} finally {
				this.isAdding = false;
			}
		}

	}
</script>

<template>
	<div class="fm-overpass-multiple-info">
		<OverpassInfo
			v-if="elements.length == 1"
			:element="elements[0]"
			:is-adding="isAdding"
			@add-to-map="addToMap(elements, $event)"
		></OverpassInfo>
		<b-carousel v-else :interval="0" v-model="activeTab">
			<b-carousel-slide>
				<div class="fm-search-box-collapse-point">
					<ul class="list-group">
						<li v-for="element in elements" class="list-group-item active">
							<span>
								<a href="javascript:" @click="$emit('click-element', element, $event)">{{element.tags.name || 'Unnamed POI'}}</a>
							</span>
							<a href="javascript:" @click="zoomToElement(element)" v-tooltip.left="'Zoom to object'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
							<a href="javascript:" @click="openElement(element)" v-tooltip.right="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
						</li>
					</ul>
				</div>

				<div v-if="client.padData && !client.readonly" class="btn-group">
					<button
						type="button"
						class="btn btn-light btn-sm"
						v-tooltip="'Zoom to selection'"
						@click="zoom()"
					>
						<Icon icon="zoom-in" alt="Zoom to selection"></Icon>
					</button>

					<div v-if="client.padData && !client.readonly && types.length > 0" class="dropdown">
						<button type="button" class="btn btn-light dropdown-toggle" :disabled="isAdding">
							<div v-if="isAdding" class="spinner-border spinner-border-sm"></div>
							Add to map
						</button>
						<ul class="dropdown-menu">
							<template v-for="type in types">
								<li>
									<a
										href="javascript:"
										class="dropdown-item"
										@click="addToMap(elements, type)"
									>{{type.name}}</a>
								</li>
							</template>
						</ul>
					</div>
				</div>
			</b-carousel-slide>

			<b-carousel-slide>
				<OverpassInfo
					v-if="openedElement"
					:element="openedElement"
					show-back-button
					:is-adding="isAdding"
					@back="activeTab = 0"
					@add-to-map="addToMap([openedElement], $event)"
				></OverpassInfo>
			</b-carousel-slide>
		</b-carousel>
	</div>
</template>

<style lang="scss">
	.fm-overpass-multiple-info {
		&, .carousel, .carousel-inner, .carousel-item.active, .carousel-item-prev, .carousel-item-next, .carousel-caption {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.carousel-item {
			float: none;
		}

		.carousel-inner {
			flex-direction: row;
		}

		.list-group-item {
			display: flex;
			align-items: center;

			> :first-child {
				flex-grow: 1;
			}
		}

		.list-group-item.active a {
			color: inherit;
		}

		.carousel-caption {
			position: static;
			padding: 0;
			color: inherit;
			text-align: inherit;
		}

		.fm-search-box-collapse-point {
			min-height: 3em;
		}

		.btn-toolbar {
			margin-top: 0.5rem;
		}
	}
</style>