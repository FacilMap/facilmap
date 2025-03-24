<script setup lang="ts">
	import { Writable, type Type } from 'facilmap-types';
	import { computed, ref, toRef, watch, type DeepReadonly } from 'vue';
	import { getClientSub, injectContextRequired } from '../facil-map-context-provider/facil-map-context-provider.vue';
	import { useToasts } from './toasts/toasts.vue';
	import type { SelectedItem } from '../../utils/selection';
	import { type LineWithTags, type MarkerWithTags, addToMap } from '../../utils/add';
	import type { ButtonSize } from '../../utils/bootstrap';
	import DropdownMenu from "./dropdown-menu.vue";
	import { formatTypeName, getOrderedTypes } from 'facilmap-utils';
	import { useI18n } from '../../utils/i18n';

	const context = injectContextRequired();
	const clientSub = getClientSub(context);
	const mapContext = toRef(() => context.components.map);
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		markers?: MarkerWithTags[];
		lines?: DeepReadonly<LineWithTags[]>;
		label?: string;
		size?: ButtonSize;
		/** If true, the markers/lines entries are assumed to refer to a single object, omitting the prefix "Marker/line/polgon items as" */
		isSingle?: boolean;
	}>();

	const emit = defineEmits<{
		"update:isAdding": [isAdding: boolean];
	}>();

	const isAdding = ref(false);

	watch(isAdding, () => {
		emit("update:isAdding", isAdding.value);
	});

	const orderedTypes = computed(() => clientSub.value ? getOrderedTypes(clientSub.value.data.types) : []);

	const markerTypes = computed(() => {
		return orderedTypes.value.filter((type) => type.type == "marker");
	});

	const lineTypes = computed(() => {
		return orderedTypes.value.filter((type) => type.type == "line");
	});

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

	async function addMarkers(type: DeepReadonly<Type>): Promise<void> {
		await add(async () => {
			return await addToMap(context, (props.markers ?? []).map((marker) => ({ marker, type })));
		});
	}

	async function addLines(type: DeepReadonly<Type>): Promise<void> {
		await add(async () => {
			return await addToMap(context, (props.lines ?? []).map((line) => ({ line, type })));
		});
	}
</script>

<template>
	<DropdownMenu
		v-if="clientSub && clientSub.data.mapData.writable !== Writable.READ && ((props.markers && markerTypes.length > 0) || (props.lines && lineTypes.length > 0))"
		:label="props.label ?? i18n.t('add-to-map-dropdown.fallback-label')"
		:isDisabled="(props.markers ?? []).length === 0 && (props.lines ?? []).length === 0"
		:isBusy="isAdding"
		:size="props.size"
	>
		<template v-if="(props.markers ?? []).length > 0 && markerTypes.length > 0">
			<template v-for="type in markerTypes" :key="type.id">
				<li>
					<a
						href="javascript:"
						class="dropdown-item"
						@click="addMarkers(type)"
					>{{!props.isSingle && props.lines ? i18n.t("add-to-map-dropdown.add-marker-items", { typeName: formatTypeName(type.name) }) : formatTypeName(type.name)}}</a>
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
					>{{!props.isSingle && props.markers ? i18n.t("add-to-map-dropdown.add-line-items", { typeName: formatTypeName(type.name) }) : formatTypeName(type.name)}}</a>
				</li>
			</template>
		</template>

		<slot name="after"></slot>
	</DropdownMenu>
</template>