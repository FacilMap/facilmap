<script setup lang="ts">
	import { Editor, getMarkRange } from "@tiptap/vue-3";
	import { computed, nextTick, ref, watch, watchEffect, type ComponentInstance } from "vue";
	import { useI18n } from "../../../utils/i18n";
	import Popover from "../popover.vue";
	import Icon from "../icon.vue";
	import { getUniqueId } from "../../../utils/utils";
	import type { Commands } from "@tiptap/core";
import vTooltip from "../../../utils/tooltip";

	const i18n = useI18n();

	const props = defineProps<{
		editor: Editor;
		element: HTMLElement | undefined;
		noHideOnOutsideClick?: boolean;
		autofocus?: boolean;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const show = defineModel<boolean>("show", { required: true });

	function setLink(attrs: Parameters<Commands["link"]["setLink"]>[0]) {
		const { from, to } = props.editor.state.selection;
		props.editor.chain()
			.extendMarkRange("link")
			.setLink(attrs)
			.setTextSelection({ from, to })
			.run();
	}

	const href = computed<string>({
		get: () => props.editor.getAttributes("link").href ?? "",
		set: (href) => {
			setLink({ href });
		}
	});

	const activeLinkId = computed(() => {
		if (props.editor.isActive("link")) {
			let id = props.editor.getAttributes("link").fmId;
			if (!id) {
				id = getUniqueId();
				setLink({ fmId: id } as any);
			}
			return id;
		}
	});

	const initialHref = ref(href.value);

	watch(activeLinkId, () => {
		initialHref.value = href.value;
	});

	const popoverRef = ref<ComponentInstance<typeof Popover>>();

	function handleSubmit() {
		show.value = false;
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

	function setLinkHrefRef(el: any) {
		if (el && props.autofocus) {
			void nextTick(() => {
				(el as HTMLInputElement).focus();
			});
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			cancel();
		}
	}

	function cancel() {
		href.value = initialHref.value;
		show.value = false;
	}

	defineExpose({
		hasFocus: () => popoverRef.value?.hasFocus,
		cancel
	});
</script>

<template>
	<Popover
		v-if="editor && props.element"
		:element="props.element"
		placement="bottom"
		v-model:show="show"
		:noHideOnOutsideClick="props.noHideOnOutsideClick"
		@hidden="emit('hidden')"
		class="fm-markdown-editor-edit-link-popover"
		ref="popoverRef"
		@keydown="handleKeyDown"
	>
		<div class="btn-toolbar">
			<form @submit.prevent="handleSubmit()">
				<input
					type="text"
					class="form-control"
					v-model="href"
					:ref="setLinkHrefRef"
					placeholder="https://example.org/"
				>
				<input type="submit" class="d-none">
			</form>

			<button
				type="button"
				class="btn btn-secondary"
				@click="clearLink()"
				v-tooltip="i18n.t('markdown-editor.remove-link-tooltip')"
			>
				<Icon icon="link-slash"></Icon>
			</button>
		</div>
	</Popover>
</template>

<style lang="scss">
	.fm-markdown-editor-edit-link-popover {
		> .popover-body {
			padding: 0.5rem;
		}
	}
</style>