<script setup lang="ts">
	import WithRender from "./route-form-tab.vue";
	import Vue from "vue";
	import { Component, Ref } from "vue-property-decorator";
	import { InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import RouteForm from "./route-form";
	import "./route-form-tab.scss";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import { HashQuery } from "facilmap-leaflet";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({
		components: { RouteForm }
	})
	export default class RouteFormTab extends Vue {

		@InjectContext() context!: Context;
		@InjectMapContext() mapContext!: MapContext;
		@InjectMapComponents() mapComponents!: MapComponents;

		@Ref() routeForm!: RouteForm;

		tabActive = false;
		hashQuery: HashQuery | null | undefined = null;

		mounted(): void {
			this.mapContext.$on("fm-route-set-query", this.setQuery);
			this.mapContext.$on("fm-route-set-from", this.setFrom);
			this.mapContext.$on("fm-route-add-via", this.addVia);
			this.mapContext.$on("fm-route-set-to", this.setTo);
		}

		beforeDestroy(): void {
			this.mapContext.$off("fm-route-set-query", this.setQuery);
			this.mapContext.$off("fm-route-set-from", this.setFrom);
			this.mapContext.$off("fm-route-add-via", this.addVia);
			this.mapContext.$off("fm-route-set-to", this.setTo);
		}

		activate(): void {
			this.mapContext.$emit("fm-search-box-show-tab", `fm${this.context.id}-route-form-tab`);
		}

		setQuery(...args: any[]): void {
			(this.routeForm.setQuery as any)(...args);
		}

		setFrom(...args: any[]): void {
			(this.routeForm.setFrom as any)(...args);
		}

		addVia(...args: any[]): void {
			(this.routeForm.addVia as any)(...args);
		}

		setTo(...args: any[]): void {
			(this.routeForm.setTo as any)(...args);
		}

	}
</script>

<template>
	<b-tab title="Route" :id="`fm${context.id}-route-form-tab`" :active.sync="tabActive" :fm-hash-query="hashQuery">
		<RouteForm :active="tabActive" @activate="activate()" ref="routeForm" @hash-query-change="hashQuery = $event"></RouteForm>
	</b-tab>
</template>

<style lang="scss">
	.fm-route-form-tab {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		flex-grow: 1;

		.input-group {
			position: static;
		}
	}
</style>