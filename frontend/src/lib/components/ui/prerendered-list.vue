<script setup lang="ts">
	import { quoteHtml } from "facilmap-utils";
	import { computed, ref, watchEffect } from "vue";

	const props = defineProps<{
		value: string | undefined;
		items: Record<string, string>;
	}>();

	const emit = defineEmits<{
		click: [item: string];
	}>();

	const containerRef = ref<HTMLElement>();

	const code = computed(() => Object.entries(props.items).map(([key, val]) => (`
		<li data-fm-item="${quoteHtml(key)}">
			<a href="javascript:" class="dropdown-item">
				${val}
			</a>
		</li>
	`)).join(''));

	watchEffect(() => {
		if (containerRef.value) {
			for (const el of containerRef.value.querySelectorAll(".active")) {
				el.classList.remove("active");
			}

			const active = props.value != null && [...containerRef.value.querySelectorAll<HTMLElement>("[data-fm-item]")].find((el) => el.getAttribute("data-fm-item") === props.value);
			if (active) {
				active.querySelector("a")!.classList.add("active");
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
	<ul ref="containerRef" v-show="Object.keys(items).length > 0" v-html="code" @click="handleClick"></ul>
</template>