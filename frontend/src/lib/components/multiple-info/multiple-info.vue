<script setup lang="ts">
	import WithRender from "./multiple-info.vue";
	import Vue from "vue";
	import { Component, Prop, Watch } from "vue-property-decorator";
	import { ID, Line, Marker } from "facilmap-types";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { showErrorToast } from "../../utils/toasts";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import "./multiple-info.scss";
	import { combineZoomDestinations, flyTo, getZoomDestinationForLine, getZoomDestinationForMarker } from "../../utils/zoom";
	import Icon from "../ui/icon/icon";
	import StringMap from "../../utils/string-map";
	import { isLine, isMarker } from "../../utils/utils";
	import MarkerInfo from "../marker-info/marker-info";
	import LineInfo from "../line-info/line-info";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({
		components: { Icon, MarkerInfo, LineInfo }
	})
	export default class MultipleInfo extends Vue {

		@InjectContext() context!: Context;
		@InjectClient() client!: Client;
		@InjectMapContext() mapContext!: MapContext;
		@InjectMapComponents() mapComponents!: MapComponents;

		@Prop({ type: Array, required: true }) objects!: Array<Marker<StringMap> | Line<StringMap>>;

		isDeleting = false;
		openedObjectId: ID | null = null;
		openedObjectType: "marker" | "line" | null = null;
		activeTab = 0;

		isMarker = isMarker;
		isLine = isLine;

		zoomToObject(object: Marker<StringMap> | Line<StringMap>): void {
			const zoomDestination = isMarker(object) ? getZoomDestinationForMarker(object) : isLine(object) ? getZoomDestinationForLine(object) : undefined;
			if (zoomDestination)
				flyTo(this.mapComponents.map, zoomDestination);
		}

		openObject(object: Marker<StringMap> | Line<StringMap>): void {
			this.openedObjectId = object.id;
			this.openedObjectType = isMarker(object) ? "marker" : isLine(object) ? "line" : null;
			this.activeTab = 1;
		}

		get openedObject(): Marker<StringMap> | Line<StringMap> | undefined {
			let openedObject: Marker<StringMap> | Line<StringMap> | undefined = undefined;
			if (this.openedObjectId != null) {
				if (this.openedObjectType == "marker")
					openedObject = this.client.markers[this.openedObjectId];
				else if (this.openedObjectType == "line")
					openedObject = this.client.lines[this.openedObjectId];
			}

			return openedObject && this.objects.includes(openedObject) ? openedObject : undefined;
		}

		@Watch("openedObject")
		handleOpenedObjectChange(): void {
			if (!this.openedObject)
				this.activeTab = 0;
		}

		async deleteObjects(): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-multiple-info-delete`);

			if (!this.objects || !await this.$bvModal.msgBoxConfirm(`Do you really want to remove ${this.objects.length} objects?`))
				return;

			this.isDeleting = true;

			try {
				for (const object of this.objects) {
					if (isMarker(object))
						await this.client.deleteMarker({ id: object.id });
					else if (isLine(object))
						await this.client.deleteLine({ id: object.id });
				}
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-multiple-info-delete`, "Error deleting objects", err);
			} finally {
				this.isDeleting = false;
			}
		}

		zoom(): void {
			const zoomDestination = combineZoomDestinations(this.objects.map((object) => {
				if (isMarker(object))
					return getZoomDestinationForMarker(object);
				else if (isLine(object))
					return getZoomDestinationForLine(object);
				else
					return undefined;
			}));
			if (zoomDestination)
				flyTo(this.mapComponents.map, zoomDestination);
		}

	}
</script>

<template>
	<div class="fm-multiple-info">
		<b-carousel :interval="0" v-model="activeTab">
			<b-carousel-slide>
				<div class="fm-search-box-collapse-point">
					<b-list-group>
						<b-list-group-item v-for="object in objects" active>
							<span>
								<a href="javascript:" @click="$emit('click-object', object, $event)">{{object.name}}</a>
								{{" "}}
								<span class="result-type" v-if="client.types[object.typeId]">({{client.types[object.typeId].name}})</span>
							</span>
							<a href="javascript:" @click="zoomToObject(object)" v-b-tooltip.hover.left="'Zoom to object'"><Icon icon="zoom-in" alt="Zoom"></Icon></a>
							<a href="javascript:" @click="openObject(object)" v-b-tooltip.hover.right="'Show details'"><Icon icon="arrow-right" alt="Details"></Icon></a>
						</b-list-group-item>
					</b-list-group>
				</div>

				<b-button-toolbar>
					<b-button v-b-tooltip.hover="'Zoom to selection'" @click="zoom()" size="sm"><Icon icon="zoom-in" alt="Zoom to selection"></Icon></b-button>

					<b-button v-if="!client.readonly" size="sm" @click="deleteObjects()" :disabled="isDeleting || mapContext.interaction">
						<b-spinner small v-if="isDeleting"></b-spinner>
						Remove
					</b-button>
				</b-button-toolbar>
			</b-carousel-slide>

			<b-carousel-slide>
				<MarkerInfo
					v-if="openedObject && isMarker(openedObject)"
					:markerId="openedObject.id"
					show-back-button
					@back="activeTab = 0"
				></MarkerInfo>
				<LineInfo
					v-else-if="openedObject && isLine(openedObject)"
					:lineId="openedObject.id"
					show-back-button
					@back="activeTab = 0"
				></LineInfo>
			</b-carousel-slide>
		</b-carousel>
	</div>
</template>

<style lang="scss">
	.fm-multiple-info {
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