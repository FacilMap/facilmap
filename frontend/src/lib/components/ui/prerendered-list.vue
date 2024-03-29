<script setup lang="ts">
	import { quoteHtml } from "facilmap-utils";
	import { computed, ref, watchEffect } from "vue";

	const props = defineProps<{
		value: string | undefined;
		items: Record<string, string>;
		/** If true, tabindex="-1" will be set on all elements. */
		noFocus?: boolean;
	}>();

	const emit = defineEmits<{
		click: [item: string];
	}>();

	const containerRef = ref<HTMLElement>();

	const code = computed(() => Object.entries(props.items).map(([key, val]) => (`
		<li class="list-group-item list-group-item-action" data-fm-item="${quoteHtml(key)}">
			<a href="javascript:"${props.noFocus ? ` tabindex="-1"` : ""}>
				${val}
			</a>
		</li>
	`)).join(''));

	watchEffect(() => {
		if (containerRef.value) {
			for (const el of containerRef.value.querySelectorAll(".active")) {
				el.classList.remove("active");
				el.removeAttribute("aria-current");
			}

			const active = props.value != null && [...containerRef.value.querySelectorAll<HTMLElement>("[data-fm-item]")].find((el) => el.getAttribute("data-fm-item") === props.value);
			if (active) {
				active.classList.add("active");
				active.setAttribute("aria-current", "true");
			}
		}
	});

	function handleClick(e: MouseEvent): void {
		const item = (e.target as HTMLElement).closest("[data-fm-item]")?.getAttribute("data-fm-item");
		if (item)
			emit("click", item);
	}

	defineExpose({
		containerRef
	});
</script>

<template>
	<ul
		ref="containerRef"
		v-show="Object.keys(items).length > 0"
		v-html="code"
		@click="handleClick"
		class="fm-prerendered-list list-group"
	></ul>
</template>

<style lang="scss">
	.fm-prerendered-list.fm-prerendered-list.fm-prerendered-list {
		border-radius: unset;

		li {
			padding: 0;
			border: none;
			border-radius: unset;
		}
	}
</style>