<script setup lang="ts">
	import OverpassForm from "./overpass-form.vue";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
import { injectContextRequired } from "../../utils/context";

	const context = injectContextRequired();
</script>

<template>
	<SearchBoxTab
		title="POIs"
		:id="`fm${context.id}-overpass-form-tab`"
		class="fm-overpass-form-tab"
	>
		<OverpassForm></OverpassForm>
	</SearchBoxTab>
</template>

<style lang="scss">
	.fm-overpass-form-tab.fm-overpass-form-tab.fm-overpass-form-tab {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
	}
</style>