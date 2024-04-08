<script lang="ts">
	import { getMarkerUrl, shapeList } from "facilmap-leaflet";
	import { quoteHtml } from "facilmap-utils";
	import Picker from "./picker.vue";
	import type { Shape } from "facilmap-types";
	import { arrowNavigation } from "../../utils/ui";
	import PrerenderedList from "./prerendered-list.vue";
	import { computed, nextTick, ref } from "vue";
	import type { Validator } from "./validated-form/validated-field.vue";
	import { computedAsync } from "../../utils/vue";
	import { useI18n } from "../../utils/i18n";

	const items = computedAsync(async () => {
		const list = await Promise.all(shapeList.map(async (s) => (
			[s, `<img src="${quoteHtml(await getMarkerUrl("#000000", 25, undefined, s))}">`] as const
		)));
		return Object.fromEntries(list);
	});
</script>

<script setup lang="ts">
	const i18n = useI18n();

	const gridRef = ref<InstanceType<typeof PrerenderedList>>();

	const props = defineProps<{
		modelValue: Shape;
		id?: string;
		validators?: Array<Validator<string>>;
	}>();

	const emit = defineEmits<{
		"update:modelValue": [value: Shape];
	}>();

	const value = computed({
		get: () => props.modelValue,
		set: (value) => {
			emit("update:modelValue", value);
		}
	});

	const valueSrc = computedAsync(async () => await getMarkerUrl("#000000", 21, undefined, props.modelValue));

	function validateShape(shape: string) {
		if (shape && !shapeList.includes(shape)) {
			return i18n.t("shape-picker.unknown-shape-error");
		}
	}

	function handleClick(shape: Shape, close: () => void): void {
		emit("update:modelValue", shape);
		close();
	}

	function handleKeyDown(event: KeyboardEvent): void {
		const newVal = arrowNavigation(Object.keys(items), props.modelValue, gridRef.value!.containerRef!, event);
		if (newVal) {
			emit("update:modelValue", newVal);
			void nextTick(() => {
				gridRef.value?.containerRef?.querySelector<HTMLElement>(".active > a")?.focus();
			});
		}
	}
</script>

<template>
	<Picker
		:id="id"
		v-model="value"
		customClass="fm-shape-field"
		:validators="[...props.validators ?? [], validateShape]"
		@keydown="handleKeyDown"
	>
		<template #preview>
			<span style="width: 1.4em"><img :src="valueSrc"></span>
		</template>

		<template #default="{ close }">
			<div v-if="!items" class="d-flex align-items-center justify-content-center p-4">
				<div class="spinner-border"></div>
			</div>

			<template v-else>
				<div v-if="Object.keys(items).length == 0" class="alert alert-danger mt-2 mb-1">{{i18n.t("shape-picker.no-shapes-error")}}</div>

				<PrerenderedList
					:items="items"
					:value="modelValue"
					@click="handleClick($event, close)"
					ref="gridRef"
					noFocus
				></PrerenderedList>
			</template>
		</template>
	</Picker>
</template>

<style lang="scss">
	.fm-shape-field {
		max-width: none;

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
			grid-template-columns: repeat(5, 40px);
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
				padding: 5px;
			}
		}
	}
</style>