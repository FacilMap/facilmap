<script lang="ts">
	import { getSymbolHtml, symbolList } from "facilmap-leaflet";
	import Icon from "./icon.vue";
	import Picker from "./picker.vue";
	import { arrowNavigation } from "../../utils/ui";
	import { keyBy, mapValues, pickBy } from "lodash-es";
	import PrerenderedList from "./prerendered-list.vue";
	import { computed, nextTick, ref } from "vue";

	const allItems = mapValues(keyBy(symbolList, (s) => s), (s) => getSymbolHtml("currentColor", "1.5em", s));
</script>

<script setup lang="ts">
	const gridRef = ref<InstanceType<typeof PrerenderedList>>();

	const props = defineProps<{
		modelValue: string | undefined | null;
		id?: string;
		isRequired?: boolean;
		validationError?: string | undefined;
	}>();

	const emit = defineEmits<{
		"update:modelValue": [value: string];
	}>();

	const value = computed({
		get: () => props.modelValue,
		set: (value) => {
			emit("update:modelValue", value!);
		}
	});

	const filter = ref("");
	const filterRef = ref<HTMLElement>();

	const items = computed(() => {
		const result: Record<string, string> = {};

		if (filter.value.length == 1)
			result[filter.value] = getSymbolHtml("currentColor", "1.5em", filter.value);

		if (props.modelValue?.length == 1 && props.modelValue != filter.value)
			result[props.modelValue] = getSymbolHtml("currentColor", "1.5em", filter.value);

		const lowerFilter = filter.value.trim().toLowerCase();
		Object.assign(result, pickBy(allItems, (val, key) => key.toLowerCase().includes(lowerFilter)));

		return result;
	});

	const validationError = computed(() => {
		if (props.validationError) {
			return props.validationError;
		} else if (props.modelValue && props.modelValue.length !== 1 && !symbolList.includes(props.modelValue)) {
			return "Unknown icon";
		} else {
			return undefined;
		}
	});

	function handleClick(symbol: string, close: () => void): void {
		emit("update:modelValue", symbol);
		close();
	}

	async function handleKeyDown(event: KeyboardEvent): Promise<void> {
		const newVal = arrowNavigation(Object.keys(items.value), props.modelValue, gridRef.value!.containerRef!, event);
		if (newVal) {
			filterRef.value?.focus();
			emit("update:modelValue", newVal);
			await nextTick();
			gridRef.value?.containerRef?.querySelector<HTMLElement>(".active")?.focus();
		}
	}

	function handleFocusPopover() {
		filterRef.value?.focus();
	}
</script>

<template>
	<Picker
		:id="id"
		v-model="value"
		customClass="fm-symbol-field"
		:validationError="validationError"
		@keydown="handleKeyDown"
		enforceElementWidth
		@focusPopover="handleFocusPopover()"
	>
		<template #preview>
			<Icon :icon="modelValue ?? undefined"></Icon>
		</template>

		<template #default="{ close }">
			<input
				type="search"
				class="form-control fm-keyboard-navigation-exception"
				v-model="filter"
				placeholder="Filter"
				autocomplete="off"
				ref="filterRef"
				tabindex="-1"
			/>

			<div v-if="Object.keys(items).length == 0" class="alert alert-danger mt-2 mb-1">No icons could be found.</div>

			<PrerenderedList
				:items="items"
				:value="modelValue ?? undefined"
				noFocus
				@click="handleClick($event, close)"
				ref="gridRef"
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