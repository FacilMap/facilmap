<script setup lang="ts">
	import { EditorContent, Editor, VueNodeViewRenderer } from "@tiptap/vue-3";
	import { StarterKit } from "@tiptap/starter-kit";
	import { Markdown } from "@tiptap/markdown";
	import { ref, toRef, watch, watchEffect } from "vue";
	import { markdownOptions, tableClasses, taskListClasses } from "facilmap-utils";
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

	const i18n = useI18n();

	const modelValue = defineModel<string | undefined>({ required: true });

	const editor = ref<Editor>();
	const editorAreaRef = ref<HTMLElement>();
	const textareaRef = ref<HTMLElement>();

	watch(() => storage.showMarkdownCode, (showMarkdownCode, old, onCleanup) => {
		if (!showMarkdownCode) {
			const ed = editor.value = new Editor({
				content: modelValue.value,
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
						markedOptions: markdownOptions
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
						renderMarkdown: (node, helpers) => {
							const content = helpers.renderChildren(node.content || [])
							return `<sup>${content}</sup>`;
						}
					}),
					Subscript.extend({
						renderMarkdown: (node, helpers) => {
							const content = helpers.renderChildren(node.content || [])
							return `<sub>${content}</sub>`;
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
					}
				}
			});

			editorAreaRef.value = ed.view.dom;

			onCleanup(() => {
				ed.destroy();
				editor.value = undefined;
			});
		}
	}, { immediate: true });

	watch(modelValue, (newValue) => {
		if (editor.value && newValue !== editor.value.getMarkdown()) {
			editor.value.commands.setContent(newValue ?? "", { contentType: "markdown" });
		}
	});

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
</script>

<template>
	<div class="fm-markdown-editor">
		<template v-if="storage.showMarkdownCode">
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
		</template>

		<button
			type="button"
			class="btn btn-secondary code-toggle"
			:class="{ active: storage.showMarkdownCode }"
			:aria-pressed="storage.showMarkdownCode"
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
			li > :last-child, li > div > :last-child, td > :last-child, th > :last-child {
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
	}
</style>