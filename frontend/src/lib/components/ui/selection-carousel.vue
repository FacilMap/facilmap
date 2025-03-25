<script lang="ts">
	import { computed, readonly, ref, watch, type ComponentInstance, type DeepReadonly } from "vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useEventListener } from "../../utils/utils";
	import type { SelectedItem } from "../../utils/selection";
	import Carousel, { CarouselTab } from "./carousel.vue";
	import { sleep } from "facilmap-utils";

	export type CarouselSelectionContext<T> = {
		/** Opens the given item at a new level */
		open: (item: T) => void;
		/** Opens the given item at the current level */
		switch: (item: T) => void;
		/** Closes the current level */
		close: () => void;
		items: T[];
	};
</script>

<script setup lang="ts" generic="T">
	const context = injectContextRequired();
	const mapContext = requireMapContext(context);

	const props = defineProps<{
		selector: ((item: DeepReadonly<SelectedItem>) => item is SelectedItem & T) | undefined;
	}>();

	const carouselRef = ref<ComponentInstance<typeof Carousel>>();

	// If explicit is true, the user has explicitly clicked the "open" button to open the item
	// If it is false, the item was opened implicitly because the user selected it on the map
	// If the item was opened implicitly, it will be closed again once the item is unselected again on the map.

	const openSelection = ref<{ items: T[]; explicit: boolean }>({ items: [], explicit: false });

	function open(item: T, level: number, explicit: boolean) {
		openSelection.value.explicit = explicit;
		openSelection.value.items = [...openSelection.value.items.slice(0, level), item as any];
		if (carouselRef.value!.tab < openSelection.value.items.length) {
			setTimeout(() => {
				carouselRef.value!.setTab(openSelection.value.items.length);
			}, 0);
		}
	}

	function close(level: number) {
		if (level < openSelection.value.items.length) {
			void (async () => {
				if (carouselRef.value!.tab > level) {
					await sleep(0);
					await carouselRef.value!.setTab(level);
				}

				// Check current active tab again, since another tab might have been opened during the animation
				if (carouselRef.value!.tab < openSelection.value.items.length) {
					openSelection.value.items = openSelection.value.items.slice(0, carouselRef.value!.tab);
				}
			})();
		}
	}

	useEventListener(mapContext, "open-selection", (selection) => {
		if (selection.selection.length === 1 && props.selector?.(selection.selection[0])) {
			open(selection.selection[0], 0, false);
		}
	});

	watch(() => mapContext.value.selection.length === 1 ? mapContext.value.selection[0] : undefined, (val) => {
		if ((!val || !props.selector?.(val)) && openSelection.value && !openSelection.value.explicit) {
			void close(0);
		}
	});

	defineExpose(readonly({
		open: (item: T, level: number) => open(item, level, true),
		close: (level: number) => close(level),
		items: computed(() => carouselRef.value ? openSelection.value.items.slice(0, carouselRef.value.tab) : [])
	}));

	const ctx = readonly({
		open: (item: T) => open(item, 0, true),
		active: carouselRef.value?.tab === 0
	});

	const ctxs = computed(() => openSelection.value.items.map((item, level) => readonly({
		/** Opens the given item at a new level */
		open: (item: T) => open(item, level + 1, true),
		/** Opens the given item at the current level */
		switch: (item: T) => open(item, level, true),
		/** Closes the current level */
		close: () => close(level),
		item,
		level,
		active: carouselRef.value?.tab === level + 1
	})));
</script>

<template>
	<Carousel ref="carouselRef">
		<CarouselTab>
			<slot v-bind="ctx"></slot>
		</CarouselTab>

		{{/* eslint-disable-next-line vue/valid-v-for */""}}
		<CarouselTab v-for="ctx in ctxs">
			<slot name="openItem" v-bind="ctx"></slot>
		</CarouselTab>
	</Carousel>
</template>