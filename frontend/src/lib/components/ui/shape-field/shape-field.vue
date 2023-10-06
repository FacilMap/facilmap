<script setup lang="ts">
	import WithRender from "./shape-field.vue";
	import Vue from "vue";
	import "./shape-field.scss";
	import { getMarkerUrl, shapeList } from "facilmap-leaflet";
	import { Component, Ref } from "vue-property-decorator";
	import Icon from "../icon/icon";
	import { quoteHtml } from "facilmap-utils";
	import Picker from "../picker/picker";
	import { Shape } from "facilmap-types";
	import { extend } from "vee-validate";
	import { arrowNavigation } from "../../../utils/ui";
	import { keyBy, mapValues } from "lodash-es";
	import PrerenderedList from "../prerendered-list/prerendered-list";

	extend("shape", {
		validate: (shape: string) => shapeList.includes(shape as Shape),
		message: "Unknown shape"
	});

	const items = mapValues(keyBy(shapeList, (s) => s), (s) => `<img src="${quoteHtml(getMarkerUrl("#000000", 25, undefined, s))}">`);

	@WithRender
	@Component({
		components: { Picker, PrerenderedList, Icon },
		props: {
			...(Picker as any).options.props
		}
	})
	export default class ShapeField extends Vue {

		@Ref() grid!: Vue;

		value!: Shape | undefined;
		filter = "";
		items = items;

		get valueSrc(): string {
			return getMarkerUrl("#000000", 21, undefined, this.value);
		}

		handleClick(shape: Shape, close: () => void): void {
			this.$emit("input", shape);
			close();
		}

		handleKeyDown(event: KeyboardEvent): void {
			const newVal = arrowNavigation(Object.keys(this.items), this.value, this.grid.$el, event);
			if (newVal) {
				this.$emit('input', newVal);
				setTimeout(() => {
					this.grid.$el.querySelector<HTMLElement>(".active")?.focus();
				}, 0);
			}
		}

	}
</script>

<template>
	<Picker v-bind="$props" v-on="$listeners" custom-class="fm-shape-field" @keydown="handleKeyDown">
		<template #preview>
			<b-input-group-text><span style="width: 1.4em"><img :src="valueSrc"></span></b-input-group-text>
		</template>

		<template #default="{ close }">
			<div v-if="Object.keys(items).length == 0" class="alert alert-danger mt-2 mb-1">No shapes could be found.</div>

			<PrerenderedList
				:items="items"
				:value="value"
				@click="handleClick($event, close)"
				ref="grid"
			></PrerenderedList>
		</template>
	</Picker>
</template>

<style lang="scss">
	.fm-shape-field {
		.popover-body {
			display: flex;
			flex-direction: column;

			ul {
				max-height: 200px;
			}
		}

		ul {
			margin: 10px 0 0 0;
			padding: 0;
			list-style-type: none;
			display: grid;
			grid-template-columns: repeat(5, 37px);
			overflow-y: auto;

			li {
				display: flex;
			}

			a {
				display: flex;
				align-items: center;
				justify-content: center;
				flex-grow: 1;
				color: inherit;
				padding: 5px 8px;
			}
		}
	}
</style>