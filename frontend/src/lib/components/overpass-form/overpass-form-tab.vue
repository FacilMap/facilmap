<script setup lang="ts">
	import WithRender from "./overpass-form-tab.vue";
	import Vue from "vue";
	import { Component } from "vue-property-decorator";
	import { InjectContext } from "../../utils/decorators";
	import "./overpass-form-tab.scss";
	import { Context } from "../facilmap/facilmap";
	import OverpassForm from "./overpass-form";

	@WithRender
	@Component({
		components: { OverpassForm }
	})
	export default class OverpassFormTab extends Vue {

		@InjectContext() context!: Context;

	}
</script>

<template>
	<b-tab title="POIs" :id="`fm${context.id}-overpass-form-tab`" class="fm-overpass-form-tab">
		<OverpassForm></OverpassForm>
	</b-tab>
</template>

<style lang="scss">
	.fm-overpass-form-tab.fm-overpass-form-tab.fm-overpass-form-tab {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
	}
</style>