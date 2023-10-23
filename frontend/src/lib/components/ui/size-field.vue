<script setup lang="ts">
	import { computed } from "vue";

	const props = defineProps<{
		value: number;
	}>();

	const emit = defineEmits<{
		(type: "update", value: number): void;
	}>();

	const value = computed({
		get: () => props.value,
		set: (value: number) => {
			emit("update", value);
		}
	});
</script>

<template>
	<input type="range" class="custom-range" min="15" v-model="value" />
</template>

<style lang="scss">
</style>