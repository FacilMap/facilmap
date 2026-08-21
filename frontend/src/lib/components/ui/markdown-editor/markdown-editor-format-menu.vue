<script lang="ts">
	import { Editor, type ChainedCommands } from "@tiptap/vue-3";
	import { BubbleMenu } from "@tiptap/vue-3/menus";
	import { computed, watchEffect } from "vue";
	import { range } from "lodash-es";
	import MenuContent, { type MenuStyleDropdown, type MenuStyles } from "./menu-content.vue";
import { CellSelection } from "@tiptap/pm/tables";

	export function getBlockStylesDropdown(ed: Editor): MenuStyleDropdown {
		const blockStyles: MenuStyleDropdown["sections"] = [
			{
				items: [
					{
						label: "Paragraph",
						icon: "align-left",
						toggle: (chain) => chain.setParagraph(),
						active: ed.isActive("paragraph") && !ed.isActive("bulletList") && !ed.isActive("orderedList")
					},
					{
						label: "Code block",
						icon: "code",
						toggle: (chain) => chain.toggleCodeBlock(),
						active: ed.isActive("codeBlock"),
						tag: "code"
					},
					{
						label: "Block quote",
						icon: "quote-left",
						toggle: (chain) => chain.toggleBlockquote(),
						active: ed.isActive("blockquote")
					}
				]
			},

			{
				heading: "Lists",
				items: [
					{
						label: "Bullet list",
						icon: "list-ul",
						toggle: (chain) => chain.toggleBulletList(),
						active: ed.isActive("bulletList")
					},

					{
						label: "Ordered list",
						icon: "list-ol",
						toggle: (chain) => chain.toggleOrderedList(),
						active: ed.isActive("orderedList")
					},

					{
						label: "Task list",
						icon: "list-check",
						toggle: (chain) => chain.toggleTaskList(),
						active: ed.isActive("taskList")
					}
				]
			},

			{
				heading: "Headings",
				items: [
					...range(1, 7).map((level) => ({
						label: `Heading ${level}`,
						icon: "heading",
						toggle: (chain: ChainedCommands) => chain.toggleHeading({ level: level as any }),
						active: ed.isActive("heading", { level }),
						className: `h${level}`
					})),
				]
			}
		];

		return {
			label: blockStyles.flatMap((s) => s.items).find((s) => s.active)?.label ?? "Paragraph",
			sections: blockStyles
		};
	}
</script>

<script setup lang="ts">
	const props = defineProps<{
		editor: Editor;
	}>();

	const isCellSelection = computed(() => props.editor.state.selection instanceof CellSelection);
	const isRowSelection = computed(() => props.editor.state.selection instanceof CellSelection && props.editor.state.selection.isRowSelection());
	const isColSelection = computed(() => props.editor.state.selection instanceof CellSelection && props.editor.state.selection.isColSelection());

	const styles = computed((): MenuStyles => {

		// TODO: Merge/separate cells
		// TODO: Inline styles

		if (isRowSelection.value && isColSelection.value) {
			// A whole table is selected
			return [
				[
					{
						icon: "trash",
						toggle: (chain) => chain.deleteTable(),
						tooltip: "Delete table"
					}
				]
			];
		} else if (isRowSelection.value) {
			// One or more whole table rows are selected
			return [
				[
					{
						icon: "trash",
						toggle: (chain) => chain.deleteRow(),
						tooltip: "Delete row(s)"
					}
				]
			];
		} else if (isColSelection.value) {
			// One or more whole table columns are selected
			return [
				[
					{
						icon: "trash",
						toggle: (chain) => chain.deleteColumn(),
						tooltip: "Delete column(s)"
					}
				]
			];
		} else if (isCellSelection.value) {
			// One or more table cells are selected
			return [];
		} else {
			return [
				[
					getBlockStylesDropdown(props.editor)
				],
				[
					{
						label: "B",
						toggle: (chain) => chain.toggleBold(),
						active: props.editor.isActive("bold"),
						style: "font-weight: bold",
						tooltip: "Bold"
					},
					{
						label: "I",
						toggle: (chain) => chain.toggleItalic(),
						active: props.editor.isActive("italic"),
						style: "font-style: italic",
						tooltip: "Italic"
					},
					{
						label: "U",
						toggle: (chain) => chain.toggleUnderline(),
						active: props.editor.isActive("underline"),
						style: "text-decoration: underline",
						tooltip: "Underline"
					},
					{
						sections: [
							{
								items: [
									{
										icon: "strikethrough",
										label: "Strikethrough",
										toggle: (chain) => chain.toggleStrike(),
										active: props.editor.isActive("strike")
									},
									{
										icon: "code",
										label: "Code",
										toggle: (chain) => chain.toggleCode(),
										active: props.editor.isActive("code")
									},
									{
										icon: "superscript",
										label: "Superscript",
										toggle: (chain) => chain.toggleSuperscript(),
										active: props.editor.isActive("superscript")
									},
									{
										icon: "subscript",
										label: "Subscript",
										toggle: (chain) => chain.toggleSubscript(),
										active: props.editor.isActive("subscript")
									}
								]
							}
						],
						tooltip: "More inline styles"
					},
					{
						icon: "eraser",
						toggle: () => void props.editor.commands.unsetAllMarks(),
						active: false,
						tooltip: "Clear inline styles"
					}

					// Link
				]
			];
		}
	});
</script>

<template>
	<BubbleMenu
		:editor="props.editor"
		:options="{ placement: 'bottom', offset: 8 }"
		class="fm-markdown-editor-format-menu"
	>
		<MenuContent :editor="editor" :styles="styles"></MenuContent>
	</BubbleMenu>
</template>

<style lang="scss">
	.fm-markdown-editor-format-menu {
		border-radius: var(--bs-border-radius);
		background-color: var(--bs-body-bg);
		border: var(--bs-border-width) solid var(--bs-border-color-translucent);
		padding: 0.25rem;
	}
</style>