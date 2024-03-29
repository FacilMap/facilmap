<script setup lang="ts">
	import Icon from "./icon.vue";
	import { ref } from "vue";
	import Popover from "./popover.vue";

	const helpLinkRef = ref<HTMLElement>();
	const showPopover = ref(false);
</script>

<template>
	<a href="javascript:" ref="helpLinkRef" @click.prevent="showPopover = !showPopover">
		<Icon icon="question-sign" alt="Show explanation"></Icon>
	</a>
	<Popover :element="helpLinkRef" v-model:show="showPopover" hideOnOutsideClick>
		<slot></slot>
	</Popover>
</template>