<script setup lang="ts">
	import type { FieldUpdate } from "facilmap-types";
	import { markdownBlock, validateFilter } from "facilmap-utils";
	import ValidatedField from "../../ui/validated-form/validated-field.vue";
	import { useI18n } from "../../../utils/i18n.js";
	import FilterSyntax from "../../ui/filter-syntax.vue";
	import { useImmutableModel } from "../../../utils/vue.js";
	import { computed } from "vue";

	const i18n = useI18n();

	const fieldModel = defineModel<FieldUpdate>({ required: true});
	const field = useImmutableModel(fieldModel);

	const code = computed({
		get: () => field.value.formula?.code ?? "",
		set: (code) => {
			if (!field.value.formula) {
				field.value.formula = { type: "filtrex", code };
			} else {
				field.value.formula.code = code;
			}
		}
	});
</script>

<template>
	<div class="fm-edit-field-dialog-formula-field-edit">
		<h2>{{i18n.t("edit-field-dialog.formula")}}</h2>

		<p v-html="markdownBlock(i18n.t('edit-field-dialog.formula-introduction'), true)"></p>

		<ValidatedField
			:value="code"
			:validators="[
				validateFilter
			]"
			immediate
		>
			<template #default="slotProps">
				<textarea
					class="form-control text-monospace"
					v-model="code"
					style="height: 10em"
					:ref="slotProps.inputRef"
				></textarea>
				<div class="invalid-feedback" v-if="slotProps.validationError">
					<pre>{{slotProps.validationError}}</pre>
				</div>
			</template>
		</ValidatedField>

		<hr />

		<FilterSyntax isFormula></FilterSyntax>
	</div>
</template>

<style lang="scss">
	.fm-edit-field-dialog-formula-field-edit {
		td.field {
			min-width: 10rem;
		}
	}
</style>