<script lang="ts">
	/**
	 * Renders an element that opens a popover on large screens and a modal on small screens.
	 */
	export default {};
</script>

<script setup lang="ts">
	import { ref, watch } from "vue";
	import { useModal } from "../../utils/modal";
	import { useMaxBreakpoint } from "../../utils/bootstrap";
	import Popover from "./popover.vue";
	import { useRefWithOverride } from "../../utils/vue";

	const props = defineProps<{
		show: boolean;
		title?: string;
		customClass?: string;
		/** If true, the width of the popover will be fixed to the width of the element. */
		enforceElementWidth?: boolean;
	}>();

	const emit = defineEmits<{
		(type: "update:show", show: boolean): void;
	}>();

	const show = useRefWithOverride(false, () => props.show, (show) => {
		emit("update:show", show);
	});
	const showModal = ref(false);
	const showPopover = ref(false);

	const shouldUseModal = useMaxBreakpoint("xs");

	watch(show, () => {
		if (!show) {
			showModal.value = false;
			showPopover.value = false;
		} else if (!showModal.value && !showPopover.value) {
			if (shouldUseModal.value) {
				showModal.value = true;
			} else {
				showPopover.value = true;
			}
		}
	});

	const trigger = ref<HTMLElement>();

	const modal = useModal({
		onHidden: () => {
			showModal.value = false;
			show.value = false;
		}
	});

	const handleShowPopoverChange = (newShowPopover: boolean) => {
		showPopover.value = newShowPopover;
		show.value = newShowPopover;
	};

	const handleClick = () => {
		show.value = !show.value;
	};

	const close = () => {
		show.value = false;
	};
</script>

<template>
	<div class="bb-popover">
		<span ref="trigger" @click="handleClick()">
			<slot name="trigger"></slot>
		</span>

		<Popover
			:show="showPopover"
			@update:show="handleShowPopoverChange"
			:element="trigger"
			:class="props.customClass"
			hide-on-outside-click
			:enforce-element-width="props.enforceElementWidth"
		>
			<template v-slot:header>
				{{props.title}}
			</template>
			<slot :is-modal="false" :close="close"></slot>
		</Popover>

		<Teleport to="body">
			<div v-if="showModal" class="modal fade" :class="props.customClass" tabindex="-1" aria-hidden="true" :ref="modal.ref">
				<div class="modal-dialog modal-dialog-scrollable">
					<div class="modal-content">
						<div v-if="props.title" class="modal-header">
							<h1 class="modal-title fs-5">{{props.title}}</h1>
							<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
						</div>
						<div class="modal-body">
							<slot :is-modal="false" :close="close"></slot>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
						</div>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>