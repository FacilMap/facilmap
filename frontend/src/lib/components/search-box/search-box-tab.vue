<script setup lang="ts">
	import { computed, onBeforeUnmount, onMounted } from 'vue';
	import { SearchBoxTab, injectSearchBoxContextRequired } from './search-box-context.vue';
	import { HashQuery } from 'facilmap-leaflet';

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

	const searchBoxContext = injectSearchBoxContextRequired();

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

	onMounted(() => {
		searchBoxContext.addTab(props.id, tab);
	});

	onBeforeUnmount(() => {
		searchBoxContext.removeTab(props.id);
	});
</script>