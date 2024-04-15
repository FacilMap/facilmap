<script lang="ts">
	import { getIconHtml, iconList } from "facilmap-leaflet";
	import Icon from "./icon.vue";
	import Picker from "./picker.vue";
	import { arrowNavigation } from "../../utils/ui";
	import PrerenderedList from "./prerendered-list.vue";
	import { computed, nextTick, ref } from "vue";
	import type { Validator } from "./validated-form/validated-field.vue";
	import { computedAsync } from "../../utils/vue";
	import { useI18n } from "../../utils/i18n";

	let allItemsP: Promise<Record<string, string>>;
	async function getAllItems(): Promise<Record<string, string>> {
		if (!allItemsP) { // eslint-disable-line @typescript-eslint/no-misused-promises
			allItemsP = Promise.all(iconList.map(async (s) => (
				[s, await getIconHtml("currentColor", "1.5em", s)] as const
			))).then((l) => Object.fromEntries(l));
		}
		return await allItemsP;
	}
</script>

<script setup lang="ts">
	const i18n = useI18n();

	const gridRef = ref<InstanceType<typeof PrerenderedList>>();

	const props = defineProps<{
		modelValue: string;
		id?: string;
		validators?: Array<Validator<string>>;
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

	const items = computedAsync(async () => {
		return Object.fromEntries<string>((await Promise.all([
			(async (): Promise<Array<[string, string]>> => {
				if (filter.value.length == 1) {
					return [[filter.value, await getIconHtml("currentColor", "1.5em", filter.value)]];
				} else {
					return [];
				}
			})(),
			(async (): Promise<Array<[string, string]>> => {
				if (props.modelValue?.length == 1 && props.modelValue != filter.value) {
					return [[props.modelValue, await getIconHtml("currentColor", "1.5em", props.modelValue)]];
				} else {
					return [];
				}
			})(),
			(async (): Promise<Array<[string, string]>> => {
				const lowerFilter = filter.value.trim().toLowerCase();
				return Object.entries(await getAllItems()).flatMap(([k, v]) => {
					if (k.toLowerCase().includes(lowerFilter)) {
						return [[k, v]];
					} else {
						return [];
					}
				});
			})()
		])).flat());
	});

	function validateSymbol(symbol: string) {
		if (symbol && symbol.length !== 1 && !iconList.includes(symbol)) {
			return i18n.t("symbol-picker.unknown-icon-error");
		}
	}

	function handleClick(symbol: string, close: () => void): void {
		emit("update:modelValue", symbol);
		close();
	}

	async function handleKeyDown(event: KeyboardEvent): Promise<void> {
		if (items.value) {
			const newVal = arrowNavigation(Object.keys(items.value), props.modelValue, gridRef.value!.containerRef!, event);
			if (newVal) {
				filterRef.value?.focus();
				emit("update:modelValue", newVal);
				await nextTick();
				gridRef.value?.containerRef?.querySelector<HTMLElement>(".active")?.focus();
			}
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
		:validators="[...props.validators ?? [], validateSymbol]"
		@keydown="handleKeyDown"
		enforceElementWidth
		@focusPopover="handleFocusPopover()"
	>
		<template #preview>
			<Icon :icon="modelValue" async></Icon>
		</template>

		<template #default="{ close }">
			<input
				type="search"
				class="form-control fm-keyboard-navigation-exception"
				v-model="filter"
				:placeholder="i18n.t('symbol-picker.filter-placeholder')"
				autocomplete="off"
				ref="filterRef"
				tabindex="-1"
			/>

			<div v-if="!items" class="d-flex align-items-center justify-content-center p-4">
				<div class="spinner-border"></div>
			</div>

			<template v-else>
				<div v-if="Object.keys(items).length == 0" class="alert alert-danger mt-2 mb-1">{{i18n.t("symbol-picker.no-icons-found-error")}}</div>

				<PrerenderedList
					:items="items"
					:value="modelValue"
					noFocus
					@click="handleClick($event, close)"
					ref="gridRef"
				></PrerenderedList>
			</template>
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