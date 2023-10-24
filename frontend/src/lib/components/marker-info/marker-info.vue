<script setup lang="ts">
	import WithRender from "./marker-info.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { FindOnMapResult, ID, Marker } from "facilmap-types";
	import { IdType } from "../../utils/utils";
	import { moveMarker } from "../../utils/draw";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { showErrorToast } from "../../utils/toasts";
	import EditMarker from "../edit-marker/edit-marker";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import "./marker-info.scss";
	import { flyTo, getZoomDestinationForMarker } from "../../utils/zoom";
	import Icon from "../ui/icon/icon";
	import StringMap from "../../utils/string-map";
	import { Context } from "../facilmap/facilmap";
	import Coordinates from "../ui/coordinates/coordinates";

	@WithRender
	@Component({
		components: { Coordinates, EditMarker, Icon }
	})
	export default class MarkerInfo extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();
		const mapContext = injectMapContextRequired();
		const mapComponents = injectMapComponentsRequired();

		@Prop({ type: IdType, required: true }) markerId!: ID;
		@Prop({ type: Boolean, default: false }) showBackButton!: boolean;

		isDeleting = false;

		get marker(): Marker<StringMap> | undefined {
			return this.client.markers[this.markerId];
		}

		move(): void {
			moveMarker(this.markerId, this.client, this.mapComponents);
		}

		async deleteMarker(): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-marker-info-delete`);

			if (!this.marker || !await this.$bvModal.msgBoxConfirm(`Do you really want to remove the marker “${this.marker.name}”?`))
				return;

			this.isDeleting = true;

			try {
				await this.client.deleteMarker({ id: this.markerId });
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-marker-info-delete`, "Error deleting marker", err);
			} finally {
				this.isDeleting = false;
			}
		}

		zoomToMarker(): void {
			if (this.marker)
				flyTo(this.mapComponents.map, getZoomDestinationForMarker(this.marker));
		}

		useAs(event: "fm-route-set-from" | "fm-route-add-via" | "fm-route-set-to"): void {
			if (!this.marker)
				return;

			const markerSuggestion: FindOnMapResult = { ...this.marker, kind: "marker", similarity: 1 };
			this.mapContext.$emit(event, this.marker.name, [], [markerSuggestion], markerSuggestion);
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
	<div class="fm-marker-info" v-if="marker">
		<h2>
			<a v-if="showBackButton" href="javascript:" @click="$emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{marker.name}}
		</h2>
		<dl class="fm-search-box-collapse-point">
			<dt class="pos">Coordinates</dt>
			<dd class="pos"><Coordinates :point="marker"></Coordinates></dd>

			<template v-if="marker.ele != null">
				<dt class="elevation">Elevation</dt>
				<dd class="elevation">{{marker.ele}} m</dd>
			</template>

			<template v-for="field in client.types[marker.typeId].fields">
				<dt>{{field.name}}</dt>
				<dd v-html="$options.filters.fmFieldContent(marker.data.get(field.name), field)"></dd>
			</template>
		</dl>

		<b-button-toolbar>
			<button
				type="button"
				class="btn btn-light btn-sm"
				v-b-tooltip.hover="'Zoom to marker'"
				@click="zoomToMarker()"
			>
				<Icon icon="zoom-in" alt="Zoom to marker"></Icon>
			</button>

			<div v-if="context.search" class="dropdown">
				<button type="button" class="btn btn-light btn-sm dropdown-toggle">Use as</button>
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

			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-light btn-sm"
				v-b-modal="`fm${context.id}-marker-info-edit`"
				:disabled="isDeleting || mapContext.interaction"
			>Edit data</button>
			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-light btn-sm"
				@click="move()"
				:disabled="isDeleting || mapContext.interaction"
			>Move</button>
			<button
				v-if="!client.readonly"
				type="button"
				class="btn btn-light btn-sm"
				@click="deleteMarker()"
				:disabled="isDeleting || mapContext.interaction"
			>
				<div v-if="isDeleting" class="spinner-border spinner-border-sm"></div>
				Remove
			</button>
		</b-button-toolbar>

		<EditMarker :id="`fm${context.id}-marker-info-edit`" :markerId="markerId"></EditMarker>
	</div>
</template>

<style lang="scss">
	.fm-marker-info {
		display: flex;
		flex-direction: column;
		min-height: 0;

		.fm-search-box-collapse-point {
			min-height: 1.5em;
		}
	}
</style>