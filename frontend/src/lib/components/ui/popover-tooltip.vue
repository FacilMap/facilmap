<script lang="ts">
	import { computed, ref } from "vue";
	import Popover from "./popover.vue";
	import { usePointerOver } from "../../utils/vue";

	/**
	 * Shows a popover on hover, with a click fallback for touch devices and support for keyboard navigation.
	 */
	export default {};
</script>

<script setup lang="ts">
	const props = withDefaults(defineProps<{
		tag?: string;
		isDisabled?: boolean;
	}>(), {
		tag: "span"
	});

	const containerRef = ref<HTMLElement>();

	const clicked = ref(false);
	const focused = ref(false);
	const over = usePointerOver({
		filter: (e) => e.buttons === 0 // Filter out simulated pointerover events on touch/pen devices
	});
	const show = computed(() => !props.isDisabled && (clicked.value || over.isOver || focused.value));

	const handleClick = () => {
		// Only accept clicks without hover, to target devices without hover ability (such as touch devices)
		if (!props.isDisabled && !over.isOver) {
			clicked.value = !clicked.value;
		}
	};

	const handleFocus = () => {
		if (containerRef.value?.matches(":focus-visible")) {
			focused.value = true;
		}
	};

	const handleBlur = () => {
		focused.value = false;
	};
</script>

<template>
	<component
		:is="props.tag"
		class="fm-popover-tooltip"
		@pointerenter="over.handleEnter($event)"
		@pointerleave="over.handleLeave($event)"
		@focus="handleFocus()"
		@blur="handleBlur()"
		@click="handleClick()"
		ref="containerRef"
		:tabindex="props.isDisabled ? undefined : '0'"
	>
		<slot></slot>
		<Popover
			:element="containerRef"
			v-model:show="show"
			hideOnOutsideClick
			class="fm-popover-tooltip-popover"
		>
			<slot name="popover"></slot>
		</Popover>
	</component>
</template>