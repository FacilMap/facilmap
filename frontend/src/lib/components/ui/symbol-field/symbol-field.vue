<script setup lang="ts">
	import WithRender from "./symbol-field.vue";
	import Vue from "vue";
	import "./symbol-field.scss";
	import { getSymbolHtml, symbolList } from "facilmap-leaflet";
	import { Component, Ref } from "vue-property-decorator";
	import Icon from "../icon/icon";
	import Picker from "../picker/picker";
	import { extend } from "vee-validate";
	import { arrowNavigation } from "../../../utils/ui";
	import { keyBy, mapValues, pickBy } from "lodash-es";
	import PrerenderedList from "../prerendered-list/prerendered-list";

	extend("symbol", {
		validate: (symbol: string) => (symbol.length == 1 || symbolList.includes(symbol)),
		message: "Unknown icon"
	});

	const items = mapValues(keyBy(symbolList, (s) => s), (s) => getSymbolHtml("currentColor", "1.5em", s));

	@WithRender
	@Component({
		components: { Picker, PrerenderedList, Icon },
		props: {
			...(Picker as any).options.props
		}
	})
	export default class SymbolField extends Vue {

		@Ref() grid!: Vue;

		value!: string | undefined;
		filter = "";

		get items(): Record<string, string> {
			const result: Record<string, string> = {};

			if (this.filter.length == 1)
				result[this.filter] = getSymbolHtml("currentColor", "1.5em", this.filter);

			if (this.value?.length == 1 && this.value != this.filter)
				result[this.value] = getSymbolHtml("currentColor", "1.5em", this.filter);

			const lowerFilter = this.filter.trim().toLowerCase();
			Object.assign(result, pickBy(items, (val, key) => key.toLowerCase().includes(lowerFilter)));

			return result;
		}

		handleClick(symbol: Symbol, close: () => void): void {
			this.$emit("input", symbol);
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
	<Picker v-bind="$props" v-on="$listeners" custom-class="fm-symbol-field" expand @keydown="handleKeyDown">
		<template #preview>
			<b-input-group-text><Icon :icon="value"></Icon></b-input-group-text>
		</template>

		<template #default="{ close }">
			<b-input type="search" v-model="filter" placeholder="Filter" autocomplete="off" autofocus></b-input>

			<b-alert v-if="Object.keys(items).length == 0" show variant="danger" class="mt-2 mb-1">No icons could be found.</b-alert>

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
	.fm-symbol-field {
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
			grid-template-columns: repeat(auto-fill, 37px);
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