<script setup lang="ts">
	import WithRender from "./icon.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { getSymbolHtml } from "facilmap-leaflet";

	@WithRender
	@Component({
		components: { }
	})
	export default class Icon extends Vue {

		@Prop({ type: String }) icon!: string | undefined;
		@Prop({ type: String }) alt?: string; // TODO
		@Prop({ type: String, default: "1.35em" }) size!: string;

		get iconCode(): string {
			return getSymbolHtml("currentColor", this.size, this.icon);
		}

	}
</script>

<template>
	<span class="fm-icon" v-html="iconCode"></span>
</template>

<style lang="scss">
</style>