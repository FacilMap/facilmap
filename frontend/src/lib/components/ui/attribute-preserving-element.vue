<script lang="ts">
	import { isEqual } from "lodash-es";
	import { computed, onBeforeUpdate, reactive, ref, useAttrs, watch } from "vue";

	/**
	 * Renders an element that preserves attributes manually added through the DOM.
	 *
	 * Usually Vue removes any attributes that are not part of the template when the component is rerendered.
	 * This makes it hard to work with third-party libraries that modify the DOM directly. This component
	 * creates a copy of any attributes in the DOM before each component update and renders these attributes
	 * again during the update. Any DOM attributes that are (or have ever been) part of the component props
	 * are ignored and rendered according to the prop value.
	 *
	 * Class names are handled separately in the same way: The component keeps track of class names manually
	 * added through DOM operations and adds them again during render. Class names that are (or have ever been)
	 * part of the "class" prop are ignored.
	 */
	export default {};
</script>

<script setup lang="ts">
	const props = defineProps<{
		tag: string;
		class?: string | Record<string, boolean> | Array<string | Record<string, boolean>>;
	}>();

	const elementRef = ref<HTMLElement>();

	const ownAttributeNames = reactive(new Set<string>());
	const ownClassNames = reactive(new Set<string>());

	watch(props, () => {
		for (const attrName of Object.keys(props)) {
			ownAttributeNames.add(attrName);
		}
	}, { immediate: true });

	watch(() => props.class, () => {
		const classNames = (
			typeof props.class === 'string' ? props.class.split(" ") :
			Array.isArray(props.class) ? props.class.flatMap((className) => typeof className === 'string' ? [className] : Object.keys(className)) :
			props.class ? Object.keys(props.class) :
			[]
		);
		for (const className of classNames) {
			ownClassNames.add(className);
		}
	}, { immediate: true, deep: true });


	const manualAttributes = ref<Record<string, string>>({});
	const manualClassNames = ref<string[]>([]);

	onBeforeUpdate(() => {
		if (elementRef.value) {
			const attributes = Object.fromEntries([...elementRef.value.attributes].flatMap((attr) => {
				return attr.nodeValue != null ? [[attr.nodeName, attr.nodeValue]] : [];
			}));
			if (!isEqual(attributes, manualAttributes.value)) {
				manualAttributes.value = attributes;
			}

			const classNames = [...elementRef.value.classList];
			if (!isEqual(classNames, manualClassNames.value)) {
				manualClassNames.value = classNames;
			}
		}
	});

	const attrs: Record<string, unknown> = useAttrs();

	const attributes = computed(() => Object.fromEntries([
		...Object.entries(manualAttributes.value).filter(([k, v]) => !ownAttributeNames.has(k)),
		...Object.entries(attrs).filter(([k, v]) => !["class", "tag"].includes(k))
	]));

	const className = computed(() => [
		...manualClassNames.value.filter((c) => !ownClassNames.has(c)),
		props.class ?? ''
	]);

	defineExpose({
		elementRef
	});
</script>

<template>
	<component
		v-bind="attributes"
		:is="props.tag"
		:class="className"
		ref="elementRef"
	>
		<slot></slot>
	</component>
</template>