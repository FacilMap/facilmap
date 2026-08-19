<script setup lang="ts">
	import { useEditor, EditorContent, Editor } from "@tiptap/vue-3";
	import { StarterKit } from "@tiptap/starter-kit";
	import { Markdown } from "@tiptap/markdown";
	import { computed, nextTick, onBeforeUnmount, ref, toRef, watch, watchEffect, watchPostEffect } from "vue";
	import { markdownOptions, sleep } from "facilmap-utils";
	import { BubbleMenu } from "@tiptap/vue-3/menus";
	import storage from "../../utils/storage";
	import Icon from "./icon.vue";
	import vTooltip from "../../utils/tooltip";
	import { useI18n } from "../../utils/i18n";
	import { useIsMounted, useResizeObserver } from "../../utils/vue";
	import { Link } from "@tiptap/extension-link";
	import { Image } from "@tiptap/extension-image";
	import { TableKit } from "@tiptap/extension-table";
	import { Superscript } from "@tiptap/extension-superscript";
	import { Subscript } from "@tiptap/extension-subscript";

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
					TableKit,
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
					//BubbleMenu.configure({})
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

		.code-toggle {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
		}

		textarea {
			resize: none;
		}

		.tiptap {
			// Tiptap always wraps the content of an <li> in a <p>
			li > p {
				margin-bottom: 0;
			}
		}
	}
</style>