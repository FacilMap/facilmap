<script setup lang="ts">
	import { EditorContent, Editor, VueNodeViewRenderer } from "@tiptap/vue-3";
	import { StarterKit } from "@tiptap/starter-kit";
	import { Markdown } from "@tiptap/markdown";
	import { nextTick, ref, toRef, watch, watchEffect, type ComponentInstance } from "vue";
	import { markdownOptions, subscriptTokenizer, superscriptTokenizer, tableClasses, taskListClasses } from "facilmap-utils";
	import storage from "../../../utils/storage";
	import Icon from "../icon.vue";
	import vTooltip from "../../../utils/tooltip";
	import { useI18n } from "../../../utils/i18n";
	import { useResizeObserver } from "../../../utils/vue";
	import { Image } from "@tiptap/extension-image";
	import { TableKit, TableCell, TableHeader } from "@tiptap/extension-table";
	import { Superscript } from "@tiptap/extension-superscript";
	import { Subscript } from "@tiptap/extension-subscript";
	import { TaskList, TaskItem } from "@tiptap/extension-list";
	import MarkdownEditorFormatMenu from "./markdown-editor-format-menu.vue";
	import MarkdownEditorInsertMenu from "./markdown-editor-insert-menu.vue";
	import TableCellNodeView from "./table-cell-node-view.vue";
	import { preserveScrollPosition } from "../../../utils/ui";
	import { Marked } from "marked";
	import Popover from "../popover.vue";
	import EditLink from "./edit-link.vue";

	const i18n = useI18n();

	const props = defineProps<{
		disableRte?: boolean;
	}>();

	const modelValue = defineModel<string | undefined>({ required: true });

	const editor = ref<Editor>();
	const textareaRef = ref<HTMLElement>();

	const linkPopoverEl = ref<HTMLElement>();
	const showLinkPopover = ref(false);
	const linkPopoverRef = ref<ComponentInstance<typeof Popover>>();

	const showCode = toRef(() => props.disableRte || storage.showMarkdownCode);

	watch(showCode, (showMarkdownCode, old, onCleanup) => {
		if (!showMarkdownCode) {
			const ed = editor.value = new Editor({
				content: modelValue.value ?? "",
				contentType: "markdown",
				extensions: [
					StarterKit.configure({
						link: {
							openOnClick: false,
							linkOnPaste: false,
							defaultProtocol: "https"
						}
					}),
					Markdown.configure({
						indentation: { style: "tab", size: 1 },
						marked: new Marked(markdownOptions)
					}),
					Image,
					TableKit.configure({
						table: {
							HTMLAttributes: {
								class: tableClasses
							}
						},
						tableHeader: false,
						tableCell: false
					}),

					TableHeader.extend({
						addNodeView() {
							return VueNodeViewRenderer(TableCellNodeView, { trackNodeViewPosition: true });
						}
					}),

					TableCell.extend({
						addNodeView() {
							return VueNodeViewRenderer(TableCellNodeView, { trackNodeViewPosition: true });
						}
					}),

					Superscript.extend({
						markdownTokenName: superscriptTokenizer.name,

						parseMarkdown: (token, helpers) => {
							const content = helpers.parseInline(token.tokens || []);
							return helpers.applyMark("superscript", content);
						},
						renderMarkdown: (node, helpers) => {
							const content = helpers.renderChildren(node.content || []);
							return `${superscriptTokenizer.fmDelimiter}${content}${superscriptTokenizer.fmDelimiter}`;
						}
					}),

					Subscript.extend({
						markdownTokenName: subscriptTokenizer.name,

						parseMarkdown: (token, helpers) => {
							const content = helpers.parseInline(token.tokens || []);
							return helpers.applyMark("subscript", content);
						},
						renderMarkdown: (node, helpers) => {
							const content = helpers.renderChildren(node.content || []);
							return `${subscriptTokenizer.fmDelimiter}${content}${subscriptTokenizer.fmDelimiter}`;
						}
					}),

					TaskList.configure({
						HTMLAttributes: {
							class: taskListClasses
						}
					}),
					TaskItem
				],
				onUpdate: () => {
					modelValue.value = ed.getMarkdown();
				},
				editorProps: {
					attributes: {
						class: "form-control"
					},
					handleClickOn(view, pos, node, nodePos, event, direct) {
						const linkMark = view.state.doc.resolve(pos).marks().find((mark) => mark.type.name === "link");
						if (linkMark) {
							nextTick(() => {
								linkPopoverEl.value = (event.target as HTMLElement | null)?.closest("a") ?? undefined;
								showLinkPopover.value = true;
							});
						}
						return false;
					}
				}
			});

			onCleanup(() => {
				ed.destroy();
				editor.value = undefined;
			});
		}
	}, { immediate: true });

	watch(modelValue, (newValue) => {
		if (editor.value && newValue !== editor.value.getMarkdown()) {
			// setContent will cause the scroll parent to scroll in Chrome (same happens when setting innerHTML, so it is
			// not a Tiptap/ProseMirror issue).
			preserveScrollPosition(editor.value.view.dom, () => {
				editor.value!.commands.setContent(newValue ?? "", { contentType: "markdown" });
			});
		}
	});

	// watch(modelValue, (newValue) => {
	// 	const json1 = editor.schema.nodeFromJSON(editor.markdown!.parse(newValue ?? "")).toJSON();
	// 	const json2 = editor.schema.nodeFromJSON(editor.markdown!.parse(editor.markdown!.serialize(json1))).toJSON();
	// 	console.log(isEqual(json1, json2));
	// });

	// When the editor is used inside a dialog, the textarea is rendered while the dialog fades in (so we have a ref),
	// but is not visible yet (so scrollHeight is 0). As a fix, we only start resizing it once its scrollHeight gets
	// an actual value.
	const loaded = ref(false);
	useResizeObserver(toRef(() => loaded.value ? undefined : textareaRef.value), () => {
		if (textareaRef.value && textareaRef.value.scrollHeight > 0) {
			loaded.value = true;
		}
	});

	// Resize textarea according to its content.
	// TODO around 2028: Switch to field-sizing: content
	watchEffect(async () => {
		modelValue.value;
		if (loaded.value && textareaRef.value) {
			textareaRef.value.style.height = "auto";
			textareaRef.value.style.height = `${textareaRef.value.scrollHeight + 1}px`;
		}
	});

	watchEffect(() => {
		console.log(editor.value?.view.hasFocus(), linkPopoverRef.value?.popoverRef?.contains(document.activeElement));
		if (showLinkPopover.value && (
			!editor.value ||
			//!(editor.value.view.hasFocus() || linkPopoverRef.value?.popoverRef?.contains(document.activeElement)) ||
			!editor.value.isActive("link") ||
			!editor.value.state.selection.empty // Format menu will be shown instead
		)) {
			showLinkPopover.value = false;
		}
	});
</script>

<template>
	<div class="fm-markdown-editor">
		<template v-if="showCode">
			<textarea
				class="form-control"
				v-model="modelValue"
				ref="textareaRef"
			></textarea>
		</template>
		<template v-else>
			<EditorContent :editor="editor"></EditorContent>

			<MarkdownEditorFormatMenu v-if="editor" :editor="editor"></MarkdownEditorFormatMenu>

			<MarkdownEditorInsertMenu v-if="editor" :editor="editor"></MarkdownEditorInsertMenu>

			<Popover
				v-if="editor && linkPopoverEl"
				:element="linkPopoverEl"
				placement="bottom"
				v-model:show="showLinkPopover"
				@hidden="linkPopoverEl = undefined"
				class="fm-markdown-editor-link-popover"
				ref="linkPopoverRef"
			>
				<EditLink :editor="editor"></EditLink>
			</Popover>
		</template>

		<button
			v-if="!props.disableRte"
			type="button"
			class="btn btn-secondary code-toggle"
			:class="{ active: showCode }"
			:aria-pressed="showCode"
			@click="storage.showMarkdownCode = !storage.showMarkdownCode"
			v-tooltip="i18n.t('markdown-editor.toggle-code-tooltip')"
		>
			<Icon icon="code" :alt="i18n.t('markdown-editor.toggle-code-alt')"></Icon>
		</button>
	</div>
</template>

<style lang="scss">
	.fm-markdown-editor {
		position: relative;

		--fm-selected-cell-background-color: rgba(var(--bs-primary-rgb), 0.15);
		--fm-selected-cell-border-color: var(--bs-primary);

		.code-toggle {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
		}

		textarea {
			resize: none;
		}

		.tiptap {
			// Tiptap wraps various contents (list item, task list item, table cell) in a <p>
			li > :last-child,
			li > div > :last-child,
			td > :last-child,
			th > :last-child,
			li > :has(+ ul) {
				margin-bottom: 0;
			}

			.selectedCell {
				background-color: var(--fm-selected-cell-background-color) !important;
				outline: 2px solid var(--fm-selected-cell-border-color);
				outline-offset: -1px;
			}

			.tableWrapper {
				// Create space for TableCellNodeView handles
				padding-top: calc(0.75rem + 3px);
				padding-left: calc(0.75rem + 3px);
			}
		}

		.fm-markdown-editor-link-popover > .popover-body {
			padding: 0.5rem;
		}
	}
</style>