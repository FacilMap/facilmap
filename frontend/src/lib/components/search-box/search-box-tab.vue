<script setup lang="ts">
	import { computed, watch } from "vue";
	import type { HashQuery } from "facilmap-leaflet";
	import { injectContextRequired, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import type { SearchBoxTab } from "../facil-map-context-provider/search-box-context";

	const props = defineProps<{
		id: string;
		title: string;
		isCloseable?: boolean;
		hashQuery?: HashQuery;
		class?: string;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();

	const context = injectContextRequired();
	const searchBoxContext = requireSearchBoxContext(context);

	const slots = defineSlots<{
		default(props: { isActive: boolean }): any;
	}>();

	const tab = computed((): SearchBoxTab => ({
		title: props.title,
		content: slots.default,
		hashQuery: props.hashQuery,
		class: props.class,
		onClose: props.isCloseable ? () => {
			emit("close");
		} : undefined
	}));

	watch(searchBoxContext, () => {
		searchBoxContext.value.provideTab(props.id, tab);
	}, { immediate: true });
</script>

<!-- eslint-disable-next-line vue/valid-template-root -->
<template>
</template>