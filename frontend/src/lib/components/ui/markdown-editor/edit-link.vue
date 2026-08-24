<script setup lang="ts">
	import { Editor, isProseMirrorCellSelection, isTextSelection, type ChainedCommands } from "@tiptap/vue-3";
	import { BubbleMenu } from "@tiptap/vue-3/menus";
	import { computed, ref, toRef, watch, watchEffect } from "vue";
	import { range } from "lodash-es";
	import MenuContent, { type MenuStyleDropdown, type MenuStyles } from "./menu-content.vue";
	import { CellSelection } from "@tiptap/pm/tables";
	import type { Node, ResolvedPos } from "@tiptap/pm/model";
	import { TextSelection } from "@tiptap/pm/state";
	import { getI18n, useI18n } from "../../../utils/i18n";
	import Popover from "../popover.vue";
	import Icon from "../icon.vue";
	import type { ComponentProps } from "vue-component-type-helpers";
	import BubbleMenuPlugin from "@tiptap/extension-bubble-menu";

	const i18n = useI18n();

	const props = defineProps<{
		editor: Editor;
	}>();

	const linkHref = ref("");
	const linkHrefRef = ref<HTMLInputElement>();

	defineExpose({ linkHrefRef });

	watch(() => props.editor.getAttributes("link").href, (href) => {
		linkHref.value = href;
	}, { immediate: true });

	function saveLink() {
		const href = linkHref.value.trim();
		if (href) {
			const { from, to } = props.editor.state.selection;
			props.editor.chain()
				.focus()
				.extendMarkRange("link")
				.setLink({ href })
				.setTextSelection({ from, to })
				.run();
		} else {
			clearLink();
		}
	}

	function clearLink() {
		const { from, to } = props.editor.state.selection;
		props.editor.chain()
			.focus()
			.extendMarkRange("link")
			.unsetLink()
			.setTextSelection({ from, to })
			.run();
	}

</script>

<template>
	<div class="fm-markdown-editor-edit-link btn-toolbar">
		<form class="input-group" @submit.prevent="saveLink()">
			<input
				type="text"
				class="form-control"
				v-model="linkHref"
				ref="linkHrefRef"
			>
			<button
				type="submit"
				class="btn btn-secondary"
			>
				<Icon icon="fa-check"></Icon>
			</button>
		</form>

		<button
			type="button"
			class="btn btn-secondary"
			@click="clearLink()"
		>
			<Icon icon="link-slash"></Icon>
		</button>
	</div>
</template>