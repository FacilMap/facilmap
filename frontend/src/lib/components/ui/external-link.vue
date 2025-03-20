<script setup lang="ts">
	import Icon from "../ui/icon.vue";
</script>

<template>
	<a class="fm-external-link">
		<slot></slot>
		{{" "}}
		<Icon icon="new-window" size="1em"></Icon>
	</a>
</template>