<script setup lang="ts">
	import { Editor } from "@tiptap/vue-3";
	import { FloatingMenu } from "@tiptap/vue-3/menus";
	import { useI18n } from "../../../utils/i18n";
	import { computed } from "vue";
	import type { MenuStyles } from "./menu-content.vue";
	import MenuContent from "./menu-content.vue";
	import { getBlockStylesDropdown } from "./markdown-editor-format-menu.vue";

	const i18n = useI18n();

	const props = defineProps<{
		editor: Editor;
	}>();

	const styles = computed<MenuStyles>(() => [
		[
			getBlockStylesDropdown(props.editor)
		],
		[
			// {
			// 	icon: "image",
			// 	toggle: () => undefined,
			// 	tooltip: "Image"
			// },

			{
				icon: "table",
				toggle: (chain) => chain.insertTable({ rows: 2, cols: 2, withHeaderRow: true }),
				tooltip: "Table"
			},

			{
				label: "—",
				toggle: (chain) => chain.setHorizontalRule(),
				tooltip: "Horizontal rule"
			}
		]
	]);
</script>

<template>
	<FloatingMenu
		:editor="props.editor"
		class="fm-markdown-editor-insert-menu"
	>
		<MenuContent :editor="editor" :styles="styles"></MenuContent>
	</FloatingMenu>
</template>

<style lang="scss">
	.fm-markdown-editor-menu {
		// .bubble-menu {
		// 	border-radius: var(--bs-border-radius);
		// 	background-color: var(--bs-body-bg);
		// 	border: var(--bs-border-width) solid var(--bs-border-color-translucent);
		// 	padding: 0.25rem;
		// }
	}
</style>