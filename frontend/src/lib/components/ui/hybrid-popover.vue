<script lang="ts">
	import { ref, toRef, watch } from "vue";
	import { useModal } from "../../utils/modal";
	import { useMaxBreakpoint } from "../../utils/bootstrap";
	import Popover from "./popover.vue";
	import { useRefWithOverride } from "../../utils/vue";
	import AttributePreservingElement from "./attribute-preserving-element.vue";
	import { useI18n } from "../../utils/i18n";

	export const hybridPopoverShouldUseModal = useMaxBreakpoint("xs");

	/**
	 * Renders an element that opens a popover on large screens and a modal on small screens.
	 */
	export default {};
</script>

<script setup lang="ts">
	const i18n = useI18n();

	const props = defineProps<{
		title?: string;
		customClass?: string;
		/** If true, the width of the popover will be fixed to the width of the element. */
		enforceElementWidth?: boolean;
		/** If true, a click of the reference element will not toggle the popover. */
		ignoreClick?: boolean;
	}>();

	const emit = defineEmits<{
		shown: [];
		hide: [];
		hidden: [];
	}>();

	const showModel = defineModel<boolean>("show");
	const show = useRefWithOverride(false, showModel);
	const showModal = ref(false);
	const showPopover = ref(false);

	watch(show, () => {
		if (!show.value) {
			if (showModal.value) {
				modal.hide();
			}
			showPopover.value = false;
		} else if (!showModal.value && !showPopover.value) {
			if (hybridPopoverShouldUseModal.value) {
				showModal.value = true;
			} else {
				showPopover.value = true;
			}
		}
	});

	const trigger = ref<HTMLElement>();

	const modalElementRef = ref<InstanceType<typeof AttributePreservingElement>>();
	const modalRef = toRef(() => modalElementRef.value?.elementRef);
	const modal = useModal(modalRef, {
		onShown: () => {
			emit("shown");
		},
		onHide: () => {
			emit("hide");
		},
		onHidden: () => {
			showModal.value = false;
			show.value = false;
			emit("hidden");
		}
	});

	const handleShowPopoverChange = (newShowPopover: boolean) => {
		showPopover.value = newShowPopover;
		show.value = newShowPopover;
	};

	const handleClick = () => {
		if (!props.ignoreClick) {
			show.value = !show.value;
		}
	};

	const close = () => {
		show.value = false;
	};
</script>

<template>
	<div class="fm-hybrid-popover">
		<div ref="trigger" @click="handleClick()">
			<slot name="trigger"></slot>
		</div>

		<Popover
			:show="showPopover"
			@update:show="handleShowPopoverChange"
			:element="trigger"
			:class="props.customClass"
			hideOnOutsideClick
			:enforceElementWidth="props.enforceElementWidth"
			@shown="emit('shown')"
			@hide="emit('hide')"
			@hidden="emit('hidden')"
		>
			<template v-slot:header>
				{{props.title}}
			</template>
			<slot :is-modal="false" :close="close"></slot>
		</Popover>

		<Teleport to="body">
			<AttributePreservingElement
				v-if="showModal"
				tag="div"
				class="modal fade"
				:class="props.customClass"
				tabindex="-1"
				aria-hidden="true"
				ref="modalElementRef"
			>
				<div class="modal-dialog modal-dialog-scrollable">
					<div class="modal-content">
						<div v-if="props.title" class="modal-header">
							<h1 class="modal-title fs-5">{{props.title}}</h1>
							<button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="i18n.t('hybrid-popover.close-label')"></button>
						</div>
						<div class="modal-body">
							<slot :is-modal="false" :close="close"></slot>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-primary" data-bs-dismiss="modal">{{i18n.t("hybrid-popover.ok-label")}}</button>
						</div>
					</div>
				</div>
			</AttributePreservingElement>
		</Teleport>
	</div>
</template>