<script setup lang="ts">
	import type { ThemeColour } from "../../utils/bootstrap";

	const props = withDefaults(defineProps<{
		label?: string;
		alt?: string;
		colour?: ThemeColour;
		/** If true, renders the badge in the top right corner of a parent element. The parent element needs to have position: relative (or the position-relative class). */
		positioned?: boolean;
	}>(), {
		colour: "secondary"
	});
</script>

<template>
	<span
		class="badge"
		:class="[
			props.positioned ? 'position-absolute top-0 start-100 translate-middle' : '',
			`bg-${props.colour}`,
			props.label ? 'rounded-pill' : 'p-2 border border-light rounded-circle'
		]">
		{{props.label}}
		<span class="visually-hidden" v-if="props.alt">{{props.alt}}</span>
	</span>
</template>