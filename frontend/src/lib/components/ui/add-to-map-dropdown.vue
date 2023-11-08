<script setup lang="ts">
	import type { Type } from 'facilmap-types';
	import { computed, ref, toRef, watch } from 'vue';
	import { injectContextRequired, requireClientContext } from '../facil-map-context-provider/facil-map-context-provider.vue';
	import { useToasts } from './toasts/toasts.vue';
	import type { SelectedItem } from '../../utils/selection';
	import { type LineWithTags, type MarkerWithTags, addToMap } from '../../utils/add';
	import type { ButtonSize } from '../../utils/bootstrap';

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = toRef(() => context.components.map);
	const toasts = useToasts();

	const props = withDefaults(defineProps<{
		markers?: MarkerWithTags[];
		lines?: LineWithTags[];
		label?: string;
		size?: ButtonSize;
	}>(), {
		label: "Add to map"
	})

	const emit = defineEmits<{
		"update:isAdding": [isAdding: boolean];
	}>();

	const isAdding = ref(false);

	watch(isAdding, () => {
		emit("update:isAdding", isAdding.value);
	});

	const markerTypes = computed(() => {
		return Object.values(client.value.types).filter((type) => type.type == "marker");
	});

	const lineTypes = computed(() => {
		return Object.values(client.value.types).filter((type) => type.type == "line");
	});

	async function add(callback: () => Promise<SelectedItem[]>): Promise<void> {
		toasts.hideToast(`fm${context.id}-add-to-map-error`);
		isAdding.value = true;

		try {
			const selection = await callback();

			mapContext.value?.components.selectionHandler.setSelectedItems(selection, true);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-add-to-map-error`, "Error adding to map", err);
		} finally {
			isAdding.value = false;
		}
	}

	async function addMarkers(type: Type): Promise<void> {
		await add(async () => {
			return await addToMap(client.value, (props.markers ?? []).map((marker) => ({ marker, type })));
		});
	}

	async function addLines(type: Type): Promise<void> {
		await add(async () => {
			return await addToMap(client.value, (props.lines ?? []).map((line) => ({ line, type })));
		});
	}
</script>

<template>
	<DropdownMenu
		v-if="client.padData && !client.readonly && ((props.markers && markerTypes.length > 0) || (props.lines && lineTypes.length > 0))"
		:label="props.label"
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
					>{{props.lines ? 'Marker items as ' : ''}}{{type.name}}</a>
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
					>{{props.markers ? 'Line/polygon items as ' : ''}}{{type.name}}</a>
				</li>
			</template>
		</template>

		<slot name="after"></slot>
	</DropdownMenu>
</template>