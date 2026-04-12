

<script lang="ts">
	import { inject, provide, reactive, type InjectionKey } from "vue";
	import { useModelWithFallback } from "../../../utils/vue";

	interface AccordionContext {
		toggleItem(item: string): void;
		activeItems: ReadonlyArray<string>;
	}

	const contextKey = Symbol.for("fm-inject-accordion") as InjectionKey<AccordionContext>;

	export function injectAccordionContextOptional(): AccordionContext | undefined {
		return inject(contextKey);
	}

	export function injectAccordionContextRequired(): AccordionContext {
		const context = injectAccordionContextOptional();
		if (!context) {
			throw new Error("No accordion context present.");
		}
		return context;
	}
</script>

<script setup lang="ts">
	const showModel = defineModel<string[]>("show");
	const activeItems = useModelWithFallback(showModel, []);

	function toggleItem(item: string): void {
		if (activeItems.value.includes(item)) {
			activeItems.value = activeItems.value.filter((it) => it !== item);
		} else {
			activeItems.value = [item];
		}
	}

	const context: AccordionContext = reactive({
		toggleItem,
		activeItems
	});

	provide(contextKey, context);
</script>

<template>
	<div class="accordion fm-accordion">
		<slot></slot>
	</div>
</template>

<style lang="scss">
	.fm-accordion {
		.accordion-button {
			font-weight: bold;
		}
	}
</style>