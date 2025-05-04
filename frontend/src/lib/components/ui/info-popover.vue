<script setup lang="ts">
	import { ref } from "vue";
	import Icon from "./icon.vue";
	import Popover from "./popover.vue";
	import type { Tooltip } from "bootstrap";
import { useRefWithOverride } from "../../utils/vue";

	const props = withDefaults(defineProps<{
		tag?: string;
		placement?: Tooltip.PopoverPlacement;
		size?: string;
		popoverClass?: string;
	}>(), {
		tag: "a",
		placement: "bottom",
		show: undefined
	});

	const buttonRef = ref<HTMLElement>();

	const showModel = defineModel<boolean>("show");
	const show = useRefWithOverride(false, showModel);
</script>

<template>
	<component
		:is="props.tag"
		href="javascript:"
		v-bind="$attrs"
		@click="show = !show"
		ref="buttonRef"
	>
		<Icon icon="info-sign" :size="props.size"></Icon>
	</component>
	<Popover
		:element="buttonRef"
		:placement="props.placement"
		class="fm-info-popover"
		:class="props.popoverClass"
		v-model:show="show"
	>
		<slot></slot>
	</Popover>
</template>