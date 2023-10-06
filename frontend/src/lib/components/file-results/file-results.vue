<script setup lang="ts">
	import WithRender from "./file-results.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { FileResultObject } from "../../utils/files";
	import { Client, InjectClient, InjectContext, InjectMapComponents } from "../../utils/decorators";
	import { showErrorToast } from "../../utils/toasts";
	import Icon from "../ui/icon/icon";
	import SearchResults from "../search-results/search-results";
	import { displayView } from "facilmap-leaflet";
	import { MapComponents } from "../leaflet-map/leaflet-map";
	import "./file-results.scss";
	import { typeExists, viewExists } from "../../utils/search";
	import { Context } from "../facilmap/facilmap";

	type ViewImport = FileResultObject["views"][0];
	type TypeImport = FileResultObject["types"][0];

	@WithRender
	@Component({
		components: { Icon, SearchResults }
	})
	export default class FileResults extends Vue {

		@InjectContext() context!: Context;
		@InjectClient() client!: Client;
		@InjectMapComponents() mapComponents!: MapComponents;

		@Prop({ type: Number, required: true }) layerId!: number;
		@Prop({ type: Object, required: true }) file!: FileResultObject;

		/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
		@Prop({ type: Boolean, default: false }) unionZoom!: boolean;
		/** When clicking or selecting a search result, zoom to it. */
		@Prop({ type: Boolean, default: false }) autoZoom!: boolean;

		isAddingView: Array<ViewImport> = [];
		isAddingType: Array<TypeImport> = [];

		get hasViews(): boolean {
			return this.file.views.length > 0;
		}

		get hasTypes(): boolean {
			return Object.keys(this.file.types).length > 0;
		}

		viewExists(view: ViewImport): boolean {
			return viewExists(this.client, view);
		};

		showView(view: ViewImport): void {
			displayView(this.mapComponents.map, view, { overpassLayer: this.mapComponents.overpassLayer });
		};

		async addView(view: ViewImport): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-file-result-import-error`);
			this.isAddingView.push(view);

			try {
				await this.client.addView(view);
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-file-result-import-error`, "Error importing view", err);
			} finally {
				this.isAddingView = this.isAddingView.filter((v) => v !== view);
			}
		};

		typeExists(type: TypeImport): boolean {
			return typeExists(this.client, type);
		};

		async addType(type: TypeImport): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-file-result-import-error`);
			this.isAddingType.push(type);

			try {
				await this.client.addType(type);
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-file-result-import-error`, "Error importing type", err);
			} finally {
				this.isAddingType = this.isAddingType.filter((t) => t !== type);
			}
		};

	}
</script>

<template>
	<div class="fm-file-results">
		<SearchResults
			:search-results="file.features"
			:layer-id="layerId"
			:auto-zoom="autoZoom"
			:union-zoom="unionZoom"
			:custom-types="file.types"
		>
			<template #before>
				<template v-if="hasViews">
					<h3>Views</h3>
					<b-list-group>
						<b-list-group-item v-for="view in file.views">
							<span>
								<a href="javascript:" @click="showView(view)">{{view.name}}</a>
								{{" "}}
								<span class="result-type">(View)</span>
							</span>
							<div v-if="isAddingView.includes(view)" class="spinner-border spinner-border-sm"></div>
							<a href="javascript:" v-else-if="client.padData && client.writable == 2 && !viewExists(view)" @click="addView(view)" v-b-tooltip.hover.right="'Add this view to the map'"><Icon icon="plus" alt="Add"></Icon></a>
						</b-list-group-item>
					</b-list-group>
				</template>
				<h3 v-if="hasViews || hasTypes">Markers/Lines</h3>
			</template>

			<template #after>
				<template v-if="hasTypes">
					<h3>Types</h3>
					<b-list-group>
						<b-list-group-item v-for="type in file.types">
							<span>
								{{type.name}}
								{{" "}}
								<span class="result-type">(Type)</span>
							</span>
							<div v-if="isAddingType.includes(type)" class="spinner-border spinner-border-sm"></div>
							<a href="javascript:" v-else-if="client.padData && client.writable == 2 && !typeExists(type)" @click="addType(type)" v-b-tooltip.hover.right="'Add this type to the map'"><Icon icon="plus" alt="Add"></Icon></a>
						</b-list-group-item>
					</b-list-group>
				</template>
			</template>

		</SearchResults>
	</div>
</template>

<style lang="scss">
	.fm-file-results {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>