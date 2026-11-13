<script setup lang="ts">
	import { computed, toRef, useId } from "vue";
	import { injectAccordionContextRequired } from "./accordion.vue";
	import Collapse from "../collapse.vue";
	import { useModelWithFallback } from "../../../utils/vue";

	const props = defineProps<{
		id?: string;
		header?: string;
	}>();

	const uniqueId = useId();
	const resolvedId = useModelWithFallback(toRef(() => props.id), uniqueId);

	const accordion = injectAccordionContextRequired();

	const show = computed(() => accordion.activeItems.includes(resolvedId.value));
</script>

<template>
	<div class="accordion-item">
		<h2 class="accordion-header">
			<button
				type="button"
				class="accordion-button"
				:class="{ collapsed: !show }"
				:aria-expanded="show"
				:aria-controls="uniqueId"
				@click="accordion.toggleItem(resolvedId)"
			>
				<slot name="header">{{props.header}}</slot>
			</button>
		</h2>
		<Collapse :id="uniqueId" class="accordion-collapse" :show="show">
			<div class="accordion-body">
				<slot></slot>
			</div>
		</Collapse>
	</div>
</template>