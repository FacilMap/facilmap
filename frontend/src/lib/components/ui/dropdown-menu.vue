<script setup lang="ts">
	import { type SlotsType, computed, defineComponent, h, ref, shallowRef, useSlots, watch, watchEffect } from "vue";
	import { getMaxSizeModifiers, type ButtonSize, type ButtonVariant, useIsNarrow } from "../../utils/bootstrap";
	import Dropdown from "bootstrap/js/dist/dropdown";
	import vLinkDisabled from "../../utils/link-disabled";
	import type { TooltipPlacement } from "../../utils/tooltip";
	import AttributePreservingElement from "./attribute-preserving-element.vue";

	const props = withDefaults(defineProps<{
		isOpen?: boolean;
		noWrapper?: boolean;
		class?: string;
		buttonClass?: string;
		menuClass?: string;
		variant?: ButtonVariant;
		noCaret?: boolean;
		label?: string;
		size?: ButtonSize;
		isDisabled?: boolean;
		/** Disables the dropdown and shows a spinner on the button. */
		isBusy?: boolean;
		/** Shows a spinner instead of the dropdown items. */
		isLoading?: boolean;
		tag?: string;
		isLink?: boolean;
		tabindex?: number;
		tooltip?: string; // TODO
		tooltipPlacement?: TooltipPlacement;
		maxWidth?: string;
	}>(), {
		isOpen: undefined,
		noWrapper: false,
		variant: "secondary",
		noCaret: false,
		tag: "div"
	});

	const emit = defineEmits<{
		"update:isOpen": [boolean];
	}>();

	const buttonRef = ref<InstanceType<typeof AttributePreservingElement>>();
	const dropdownRef = shallowRef<Dropdown>();

	const isNarrow = useIsNarrow();

	class CustomDropdown extends Dropdown {
		_detectNavbar() {
			// Bootstrap Dropdown disables the "applyStyles" modifier if the dropdown trigger is a descendant
			// of a navbar, causing the dropdown to ignore any popper styles and be positioned statically
			// instead.
			// In wide mode, we want to use the regular popper positioning so that we can rely on the maxSizeModifers.
			// In narrow mode, navbars are collapsed and dropdowns expand in between to navbar items, rather than
			// being absolutely positioned. We want to keep that behaviour.
			if (isNarrow.value) {
				// @ts-ignore
				return super._detectNavbar();
			} else {
				return false;
			}
		}
	}

	watch([
		() => buttonRef.value?.elementRef,
		isNarrow
	], ([newRef], [oldRef], onCleanup) => {
		if (newRef) {
			dropdownRef.value = new CustomDropdown(newRef, {
				popperConfig: (defaultConfig) => ({
					...defaultConfig,
					modifiers: [
						...(defaultConfig.modifiers ?? []),
						...getMaxSizeModifiers({ maxWidth: props.maxWidth })
					],
					strategy: "fixed"
				})
			});
			onCleanup(() => {
				dropdownRef.value!.dispose();
				dropdownRef.value = undefined;
			});
		}
	}, { immediate: true });

	watchEffect(() => {
		if (dropdownRef.value) {
			if (props.isOpen === true) {
				dropdownRef.value.show();
			} else if (props.isOpen === false) {
				dropdownRef.value.hide();
			}
		}
	});

	const Wrapper = defineComponent({
		slots: Object as SlotsType<{
			default: void
		}>,

		setup(innerProps, { slots }) {
			return () => {
				if (props.noWrapper) {
					return slots.default();
				} else {
					return h(props.tag, {
						class: ["dropdown", "fm-dropdown-menu-container", props.class]
					}, slots.default());
				}
			};
		}
	});

	const slots = useSlots();
	const isEmptyLabel = computed(() => !slots.label && !props.label);

	const buttonClass = computed((): string[] => [
		"fm-dropdown-menu-toggle",
		...(props.buttonClass != null ? [props.buttonClass] : []),
		...(props.size ? [`btn-${props.size}`] : []),
		...(props.noCaret ? [] : ["dropdown-toggle"]),
		...(props.isLink ? [] : ["btn", `btn-${props.variant}`]),
		...(isEmptyLabel.value ? ["isEmptyLabel"] : [])
	]);

	const menuClass = computed((): string[] => [
		"fm-dropdown-menu-menu",
		"dropdown-menu",
		"text-break",
		...(props.menuClass != null ? [props.menuClass] : []),
		...(props.isLoading ? ["isLoading"] : [])
	]);

	function handleHidden() {
		if (props.isOpen !== false) {
			emit("update:isOpen", false);
		}
	}

	function handleShown() {
		if (props.isOpen !== true) {
			emit("update:isOpen", true);
		}
	}

	watchEffect(() => {
		if (props.isDisabled || props.isBusy) {
			dropdownRef.value?.hide();
		}
	});

</script>

<template>
	<Wrapper>
		<template v-if="props.isLink">
			<AttributePreservingElement
				tag="a"
				href="javascript:"
				:class="buttonClass"
				v-on="{
					'hidden.bs.dropdown': handleHidden,
					'shown.bs.dropdown': handleShown
				}"
				ref="buttonRef"
				data-bs-toggle="dropdown"
				v-link-disabled="props.isDisabled || props.isBusy"
				:tabindex="props.tabindex"
				draggable="false"
			>
				<slot name="label">
					<div v-if="props.isBusy" class="spinner-border spinner-border-sm"></div>
					{{props.label}}
				</slot>
			</AttributePreservingElement>
		</template>
		<template v-else>
			<AttributePreservingElement
				tag="button"
				type="button"
				:class="buttonClass"
				v-on="{
					'hidden.bs.dropdown': handleHidden,
					'shown.bs.dropdown': handleShown
				}"
				ref="buttonRef"
				data-bs-toggle="dropdown"
				:disabled="props.isDisabled || props.isBusy"
				:tabindex="props.tabindex"
			>
				<slot name="label">
					<div v-if="props.isBusy" class="spinner-border spinner-border-sm"></div>
					{{props.label}}
				</slot>
			</AttributePreservingElement>
		</template>

		<AttributePreservingElement
			tag="ul"
			:class="menuClass"
		>
			<template v-if="props.isLoading">
				<li class="spinner-border"></li>
			</template>
			<template v-else>
				<slot></slot>
			</template>
		</AttributePreservingElement>
	</Wrapper>
</template>

<style lang="scss">
	.fm-dropdown-menu-toggle.isEmptyLabel::after {
		margin-left: 0;
	}

	.fm-dropdown-menu-menu {
		overflow: auto;

		.dropdown-item {
			// Wrap in connection with the text-break class on the menu
			white-space: normal;
		}
	}

	.fm-dropdown-menu-menu.isLoading.show {
		display: flex !important;
		align-items: center;
		justify-content: center;
	}
</style>