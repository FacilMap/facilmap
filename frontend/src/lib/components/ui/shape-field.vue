<script lang="ts">
	import { getMarkerUrl, shapeList } from "facilmap-leaflet";
	import { quoteHtml } from "facilmap-utils";
	import Picker from "./picker.vue";
	import type { Shape } from "facilmap-types";
	import { arrowNavigation } from "../../utils/ui";
	import { keyBy, mapValues } from "lodash-es";
	import PrerenderedList from "./prerendered-list.vue";
	import { computed, nextTick, ref } from "vue";

	const items = mapValues(keyBy(shapeList, (s) => s), (s) => `<img src="${quoteHtml(getMarkerUrl("#000000", 25, undefined, s))}">`);
</script>

<script setup lang="ts">
	const gridRef = ref<InstanceType<typeof PrerenderedList>>();

	const props = defineProps<{
		modelValue: Shape | undefined | null;
		id?: string;
		validationError?: string | undefined;
	}>();

	const emit = defineEmits<{
		"update:modelValue": [value: Shape];
	}>();

	const value = computed({
		get: () => props.modelValue,
		set: (value) => {
			emit("update:modelValue", value!);
		}
	});

	const valueSrc = computed(() => getMarkerUrl("#000000", 21, undefined, props.modelValue ?? undefined));

	const validationError = computed(() => {
		if (props.validationError) {
			return props.validationError;
		} else if (props.modelValue && !shapeList.includes(props.modelValue)) {
			return "Unknown shape";
		} else {
			return undefined;
		}
	});

	function handleClick(shape: Shape, close: () => void): void {
		emit("update:modelValue", shape);
		close();
	}

	async function handleKeyDown(event: KeyboardEvent): Promise<void> {
		const newVal = arrowNavigation(Object.keys(items), props.modelValue, gridRef.value!.containerRef!, event);
		if (newVal) {
			emit("update:modelValue", newVal);
			await nextTick();
			gridRef.value?.containerRef?.querySelector<HTMLElement>(".active")?.focus();
		}
	}
</script>

<template>
	<Picker
		:id="id"
		v-model="value"
		customClass="fm-shape-field"
		:validationError="validationError"
		@keydown="handleKeyDown"
		enforceElementWidth
	>
		<template #preview>
			<span style="width: 1.4em"><img :src="valueSrc"></span>
		</template>

		<template #default="{ close }">
			<div v-if="Object.keys(items).length == 0" class="alert alert-danger mt-2 mb-1">No shapes could be found.</div>

			<PrerenderedList
				:items="items"
				:value="modelValue ?? undefined"
				@click="handleClick($event, close)"
				ref="gridRef"
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