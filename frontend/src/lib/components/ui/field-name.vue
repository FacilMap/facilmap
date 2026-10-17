<script setup lang="ts">
	import type { Field } from "facilmap-types";
	import { useI18n } from "../../utils/i18n";
	import { formatFieldName, markdownBlock } from "facilmap-utils";
	import Icon from "./icon.vue";
	import PopoverTooltip from "./popover-tooltip.vue";

	const i18n = useI18n();

	const props = defineProps<{
		field: Field;
	}>();
</script>

<template>
	<PopoverTooltip class="fm-field-name" :isDisabled="!props.field.description">
		{{formatFieldName(field.name)}}
		<Icon
			v-if="props.field.description"
			icon="info-sign"
			:alt="i18n.t('edit-object-fields.field-description-alt')"
			size="1em"
		></Icon>
		<template #popover>
			<div v-html="markdownBlock(props.field.description ?? '', true)"></div>
		</template>
	</PopoverTooltip>
</template>

<style lang="scss">
	.fm-field-name {
		.popover-body > div > :last-child {
			margin-bottom: 0;
		}
	}
</style>