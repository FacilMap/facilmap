<script setup lang="ts">
	import type { Type } from 'facilmap-types';
	import { computed, ref, toRef, watch } from 'vue';
	import { injectContextRequired, requireClientContext } from '../facil-map-context-provider/facil-map-context-provider.vue';
	import { useToasts } from './toasts/toasts.vue';
	import type { SelectedItem } from '../../utils/selection';
	import { type LineWithTags, type MarkerWithTags, addToMap } from '../../utils/add';
	import type { ButtonSize } from '../../utils/bootstrap';
	import DropdownMenu from "./dropdown-menu.vue";
	import { formatTypeName, getOrderedTypes } from 'facilmap-utils';
	import { useI18n } from '../../utils/i18n';

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = toRef(() => context.components.map);
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		markers?: MarkerWithTags[];
		lines?: LineWithTags[];
		label?: string;
		size?: ButtonSize;
		/** If true, the markers/lines entries are assumed to refer to a single object, omitting the prefix "Marker/line/polgon items as" */
		isSingle?: boolean;
		disabledTooltip?: string;
		markerLabel?: (params: { typeName: string }) => string;
		lineLabel?: (params: { typeName: string }) => string;
	}>();

	const emit = defineEmits<{
		"update:isAdding": [isAdding: boolean];
	}>();

	const isAdding = ref(false);

	watch(isAdding, () => {
		emit("update:isAdding", isAdding.value);
	});

	const markerTypes = computed(() => {
		return getOrderedTypes(client.value.types).filter((type) => type.type == "marker");
	});

	const lineTypes = computed(() => {
		return getOrderedTypes(client.value.types).filter((type) => type.type == "line");
	});

	const isDisabled = computed(() => (props.markers ?? []).length === 0 && (props.lines ?? []).length === 0);

	async function add(callback: () => Promise<SelectedItem[]>): Promise<void> {
		toasts.hideToast(`fm${context.id}-add-to-map-error`);
		isAdding.value = true;

		try {
			const selection = await callback();

			mapContext.value?.components.selectionHandler.setSelectedItems(selection, true);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-add-to-map-error`, () => i18n.t("add-to-map-dropdown.add-error"), err);
		} finally {
			isAdding.value = false;
		}
	}

	async function addMarkers(type: Type): Promise<void> {
		await add(async () => {
			return await addToMap(context, (props.markers ?? []).map((marker) => ({ marker, type })));
		});
	}

	async function addLines(type: Type): Promise<void> {
		await add(async () => {
			return await addToMap(context, (props.lines ?? []).map((line) => ({ line, type })));
		});
	}
</script>

<template>
	<DropdownMenu
		v-if="client.mapData && !client.readonly && ((props.markers && markerTypes.length > 0) || (props.lines && lineTypes.length > 0))"
		:label="props.label ?? i18n.t('add-to-map-dropdown.fallback-label')"
		:isDisabled="isDisabled"
		:isBusy="isAdding"
		:size="props.size"
		:tooltip="isDisabled ? (props.disabledTooltip ?? i18n.t('add-to-map-dropdown.disabled-tooltip')) : undefined"
	>
		<template v-if="(props.markers ?? []).length > 0 && markerTypes.length > 0">
			<template v-for="type in markerTypes" :key="type.id">
				<li>
					<a
						href="javascript:"
						class="dropdown-item"
						@click="addMarkers(type)"
					>{{(
						props.markerLabel ? props.markerLabel({ typeName: formatTypeName(type.name) }) :
						!props.isSingle && props.lines ? i18n.t("add-to-map-dropdown.add-marker-items", { typeName: formatTypeName(type.name) }) :
						formatTypeName(type.name)
					)}}</a>
				</li>
			</template>
		</template>
		<template v-if="(props.lines ?? []).length > 0 && lineTypes.length > 0">
			<template v-for="type in lineTypes" :key="type.id">
				<li>
					<a
						href="javascript:"
						class="dropdown-item"
						@click="addLines(type)"
					>{{(
						props.lineLabel ? props.lineLabel({ typeName: formatTypeName(type.name) }) :
						!props.isSingle && props.markers ? i18n.t("add-to-map-dropdown.add-line-items", { typeName: formatTypeName(type.name) }) :
						formatTypeName(type.name)
					)}}</a>
				</li>
			</template>
		</template>

		<slot name="after"></slot>
	</DropdownMenu>
</template>