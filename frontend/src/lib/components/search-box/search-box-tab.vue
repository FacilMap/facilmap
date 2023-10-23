<script setup lang="ts">
	import { computed, onBeforeUnmount, onMounted, reactive, useSlots } from 'vue';
	import { injectSearchBoxContextRequired } from './search-box-context.vue';
	import { HashQuery } from 'facilmap-leaflet';

	const props = defineProps<{
		id: string;
		title: string;
		isCloseable?: boolean;
		hashQuery?: HashQuery;
	}>();

	const emit = defineEmits<{
		(type: "close"): void;
	}>();

	const searchBoxContext = injectSearchBoxContextRequired();

	const slots = useSlots();

	const tab = computed(() => ({
		title: props.title,
		content: slots.default,
		hashQuery: props.hashQuery,
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