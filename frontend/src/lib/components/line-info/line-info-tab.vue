<script setup lang="ts">
	import WithRender from "./line-info-tab.vue";
	import Vue from "vue";
	import { Component, Watch } from "vue-property-decorator";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { ID, Line } from "facilmap-types";
	import LineInfo from "./line-info";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import Icon from "../ui/icon/icon";
	import StringMap from "../../utils/string-map";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({
		components: { Icon, LineInfo }
	})
	export default class LineInfoTab extends Vue {

		@InjectContext() context!: Context;
		@InjectClient() client!: Client;
		@InjectMapContext() mapContext!: MapContext;
		@InjectMapComponents() mapComponents!: MapComponents;

		mounted(): void {
			this.mapContext.$on("fm-open-selection", this.handleOpenSelection);
		}

		beforeDestroy(): void {
			this.mapContext.$off("fm-open-selection", this.handleOpenSelection);
		}

		get lineId(): ID | undefined {
			if (this.mapContext.selection.length == 1 && this.mapContext.selection[0].type == "line")
				return this.mapContext.selection[0].id;
			else
				return undefined;
		}

		get line(): Line<StringMap> | undefined {
			return this.lineId != null ? this.client.lines[this.lineId] : undefined;
		}

		@Watch("line")
		handleChangeLine(line: Line | undefined): void {
			if (!line && this.lineId != null)
				this.close();
		}

		get title(): string | undefined {
			if (this.line != null)
				return this.line.name;
			else
				return undefined;
		}

		handleOpenSelection(): void {
			if (this.line)
				this.mapContext.$emit("fm-search-box-show-tab", `fm${this.context.id}-line-info-tab`)
		}

		close(): void {
			this.mapComponents.selectionHandler.setSelectedItems([]);
		}

	}
</script>

<template>
	<b-tab v-if="lineId" :id="`fm${context.id}-line-info-tab`">
		<template #title>
			<span class="closeable-tab-title">
				<span>{{title}}</span>
				<object><a href="javascript:" @click="close()"><Icon icon="remove" alt="Close"></Icon></a></object>
			</span>
		</template>

		<LineInfo :lineId="lineId"></LineInfo>
	</b-tab>
</template>