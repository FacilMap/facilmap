<script setup lang="ts">
</script>

<template>
	<b-tab v-if="elements.length > 0" :id="`fm${context.id}-overpass-info-tab`">
		<template #title>
			<span class="closeable-tab-title">
				<span>{{elements.length == 1 ? (elements[0].tags.name || "Unnamed POI") : `${elements.length} POIs`}}</span>
				<object><a href="javascript:" @click="close()"><Icon icon="remove" alt="Close"></Icon></a></object>
			</span>
		</template>

		<OverpassMultipleInfo :elements="elements" @click-element="handleElementClick"></OverpassMultipleInfo>
	</b-tab>
</template>

<style lang="scss">
	import WithRender from "./overpass-info-tab.vue";
	import Vue from "vue";
	import { Component } from "vue-property-decorator";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import Icon from "../ui/icon/icon";
	import { Context } from "../facilmap/facilmap";
	import { OverpassElement } from "facilmap-leaflet";
	import OverpassMultipleInfo from "./overpass-multiple-info";

	@WithRender
	@Component({
		components: { Icon, OverpassMultipleInfo }
	})
	export default class OverpassInfoTab extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();
		const mapContext = injectMapContextRequired();
		const mapComponents = injectMapComponentsRequired();

		mounted(): void {
			this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
		}

		beforeDestroy(): void {
			this.mapContext.$off("fm-open-selection", this.handleOpenSelection);
		}

		get elements(): OverpassElement[] {
			return this.mapContext.selection.flatMap((item) => (item.type == "overpass" ? [item.element] : []));
		}

		handleOpenSelection(): void {
			if (this.elements.length > 0)
				this.mapContext.$emit("fm-search-box-show-tab", `fm${this.context.id}-overpass-info-tab`);
		}

		handleElementClick(element: OverpassElement, event: MouseEvent): void {
			if (event.ctrlKey)
				this.mapComponents.selectionHandler.setSelectedItems(this.mapContext.selection.filter((it) => it.type != "overpass" || it.element !== element), true);
			else
				this.mapComponents.selectionHandler.setSelectedItems(this.mapContext.selection.filter((it) => it.type == "overpass" && it.element === element), true);
		}

		close(): void {
			this.mapComponents.selectionHandler.setSelectedItems([]);
		}

	}
</style>