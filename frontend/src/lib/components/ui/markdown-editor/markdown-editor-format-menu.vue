<script lang="ts">
	import { Editor, isProseMirrorCellSelection, isTextSelection, type ChainedCommands } from "@tiptap/vue-3";
	import { BubbleMenu } from "@tiptap/vue-3/menus";
	import { computed, ref, toRef } from "vue";
	import { range } from "lodash-es";
	import MenuContent, { type MenuStyleDropdown, type MenuStyles } from "./menu-content.vue";
	import type { Node, ResolvedPos } from "@tiptap/pm/model";
	import { getI18n, useI18n } from "../../../utils/i18n";
	import EditLinkPopover from "./edit-link-popover.vue";

	export function getBlockStylesDropdown(ed: Editor): MenuStyleDropdown {
		const i18n = getI18n();

		const blockStyles: MenuStyleDropdown["sections"] = [
			{
				items: [
					{
						label: i18n.t("markdown-editor.paragraph-label"),
						icon: "align-left",
						toggle: (chain) => chain.setParagraph(),
						active: ed.isActive("paragraph") && !ed.isActive("bulletList") && !ed.isActive("orderedList")
					},
					{
						label: i18n.t("markdown-editor.code-block-label"),
						icon: "code",
						toggle: (chain) => chain.toggleCodeBlock(),
						active: ed.isActive("codeBlock"),
						tag: "code"
					},
					{
						label: i18n.t("markdown-editor.block-quote-label"),
						icon: "quote-left",
						toggle: (chain) => chain.toggleBlockquote(),
						active: ed.isActive("blockquote")
					}
				]
			},

			{
				heading: i18n.t("markdown-editor.lists-heading"),
				items: [
					{
						label: i18n.t("markdown-editor.bullet-list-label"),
						icon: "list-ul",
						toggle: (chain) => chain.toggleBulletList(),
						active: ed.isActive("bulletList")
					},

					{
						label: i18n.t("markdown-editor.ordered-list-label"),
						icon: "list-ol",
						toggle: (chain) => chain.toggleOrderedList(),
						active: ed.isActive("orderedList")
					},

					{
						label: i18n.t("markdown-editor.task-list-label"),
						icon: "list-check",
						toggle: (chain) => chain.toggleTaskList(),
						active: ed.isActive("taskList")
					}
				]
			},

			{
				heading: i18n.t("markdown-editor.headings-heading"),
				items: [
					...range(1, 7).map((level) => ({
						label: i18n.t("markdown-editor.heading-label", { level }),
						icon: "heading",
						toggle: (chain: ChainedCommands) => chain.toggleHeading({ level: level as any }),
						active: ed.isActive("heading", { level }),
						className: `h${level}`
					})),
				]
			}
		];

		return {
			label: blockStyles.flatMap((s) => s.items).find((s) => s.active)?.label ?? i18n.t("markdown-editor.paragraph-label"),
			sections: blockStyles
		};
	}
</script>

<script setup lang="ts">
	const i18n = useI18n();

	const props = defineProps<{
		editor: Editor;
	}>();

	const linkRef = ref<HTMLElement>();
	const showLinkPopover = ref(false);

	const cellSelection = toRef(() => isProseMirrorCellSelection(props.editor.state.selection) ? props.editor.state.selection : undefined);
	const isCellSelection = toRef(() => !!cellSelection.value);
	const isRowSelection = computed(() => cellSelection.value?.isRowSelection());
	const isColSelection = computed(() => cellSelection.value?.isColSelection());
	const selectedCells = computed(() => {
		const result: Node[] = [];
		cellSelection.value?.forEachCell((node) => {
			result.push(node);
		});
		return result;
	});

	function findClosestAncestorCell($node: ResolvedPos) {
		for (let d = $node.depth; d > 0; d--) {
			const node = $node.node(d);
			if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
				return node;
			}
		}
	}

	const textSelectionInsideTableCell = computed(() => {
		if (!isTextSelection(props.editor.state.selection)) {
			return;
		}

		const fromCell = findClosestAncestorCell(props.editor.state.selection.$from);
		if (!fromCell) {
			return;
		}

		const toCell = findClosestAncestorCell(props.editor.state.selection.$to);
		if (fromCell === toCell) {
			return fromCell;
		}
	});

	const isCombinedCell = computed(() => {
		const selectedSingleCell = (
			cellSelection.value && selectedCells.value.length === 1 ? selectedCells.value[0] :
			textSelectionInsideTableCell.value
		);
		return selectedSingleCell && (selectedSingleCell.attrs.colspan > 0 || selectedSingleCell.attrs.rowspan > 0);
	});

	const inlineStyles = computed((): MenuStyles[number] => [
		{
			label: i18n.t("markdown-editor.bold-icon"),
			toggle: (chain) => chain.toggleBold(),
			active: props.editor.isActive("bold"),
			style: "font-weight: bold",
			tooltip: i18n.t("markdown-editor.bold-label")
		},
		{
			label: i18n.t("markdown-editor.italic-icon"),
			toggle: (chain) => chain.toggleItalic(),
			active: props.editor.isActive("italic"),
			style: "font-style: italic",
			tooltip: i18n.t("markdown-editor.italic-label")
		},
		{
			label: i18n.t("markdown-editor.underline-icon"),
			toggle: (chain) => chain.toggleUnderline(),
			active: props.editor.isActive("underline"),
			style: "text-decoration: underline",
			tooltip: i18n.t("markdown-editor.underline-label")
		},
		{
			sections: [
				{
					items: [
						{
							icon: "strikethrough",
							label: i18n.t("markdown-editor.strikethrough-label"),
							toggle: (chain) => chain.toggleStrike(),
							active: props.editor.isActive("strike")
						},
						{
							icon: "code",
							label: i18n.t("markdown-editor.code-label"),
							toggle: (chain) => chain.toggleCode(),
							active: props.editor.isActive("code")
						},
						{
							icon: "superscript",
							label: i18n.t("markdown-editor.superscript-label"),
							toggle: (chain) => chain.toggleSuperscript(),
							active: props.editor.isActive("superscript")
						},
						{
							icon: "subscript",
							label: i18n.t("markdown-editor.subscript-label"),
							toggle: (chain) => chain.toggleSubscript(),
							active: props.editor.isActive("subscript")
						}
					]
				}
			],
			tooltip: i18n.t("markdown-editor.more-inline-tooltip")
		},
		{
			icon: "eraser",
			toggle: () => void props.editor.commands.unsetAllMarks(),
			active: false,
			tooltip: i18n.t("markdown-editor.clear-inline-tooltip")
		}
	]);

	const cellStyles = computed((): MenuStyles[number] => [
		...selectedCells.value.length > 1 ? [
			{
				icon: "object-group",
				tooltip: "Merge cells",
				toggle: (chain) => chain.mergeCells()
			}
		] satisfies MenuStyles[number] : [],
		...isCombinedCell.value ? [
			{
				icon: "object-ungroup",
				tooltip: "Split cell",
				toggle: (chain) => chain.splitCell()
			}
		] satisfies MenuStyles[number] : []
	]);

	const styles = computed((): MenuStyles => {

		// TODO: Merge/separate cells
		// TODO: Inline styles

		if (isRowSelection.value && isColSelection.value) {
			// A whole table is selected

			return [
				inlineStyles.value,
				[
					...cellStyles.value,
					{
						icon: "trash",
						toggle: (chain) => chain.deleteTable(),
						tooltip: i18n.t("markdown-editor.delete-table-label")
					}
				]
			];
		} else if (isRowSelection.value) {
			// One or more whole table rows are selected

			return [
				inlineStyles.value,
				[
					...cellStyles.value,
					{
						icon: "trash",
						toggle: (chain) => chain.deleteRow(),
						tooltip: i18n.t("markdown-editor.delete-rows-label")
					}
				]
			];
		} else if (isColSelection.value) {
			// One or more whole table columns are selected

			return [
				inlineStyles.value,
				[
					...cellStyles.value,
					{
						icon: "trash",
						toggle: (chain) => chain.deleteColumn(),
						tooltip: i18n.t("markdown-editor.delete-columns-label")
					}
				]
			];
		} else if (isCellSelection.value) {
			// One or more table cells are selected

			return [
				inlineStyles.value,
				cellStyles.value
			];
		} else {
			// Regular text is selected

			return [
				[
					getBlockStylesDropdown(props.editor)
				],
				inlineStyles.value,
				[
					{
						icon: "link",
						tooltip: i18n.t("markdown-editor.link-label"),
						toggle: (chain) => {
							showLinkPopover.value = !showLinkPopover.value;
							if (!props.editor.isActive("link")) {
								return chain.setLink({ href: "" });
							}
						},
						noFocus: true,
						ref: (el) => {
							linkRef.value = el;
						},
						active: showLinkPopover.value
					}
				],
				...cellStyles.value.length > 0 ? [cellStyles.value] : []
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

		<EditLinkPopover
			:element="linkRef"
			v-model:show="showLinkPopover"
			:editor="props.editor"
			autofocus
		></EditLinkPopover>
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