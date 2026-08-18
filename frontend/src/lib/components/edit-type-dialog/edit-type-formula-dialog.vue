<script setup lang="ts">
	import type { CRU, Field, FieldUpdate, Type } from "facilmap-types";
	import { filterHasError, markdownBlock, mergeObject } from "facilmap-utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { computed, ref, watch } from "vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "../ui/validated-form/validated-field.vue";
	import { useI18n } from "../../utils/i18n";
	import FilterSyntax from "../ui/filter-syntax.vue";

	const context = injectContextRequired();
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		type: Type<CRU.READ | CRU.CREATE_VALIDATED>;
		field: Field;
	}>();

	const emit = defineEmits<{
		"update:field": [field: Field];
		hidden: [];
	}>();

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const initialField = computed(() => {
		const field: FieldUpdate = cloneDeep(props.field);
		if (field.formula == null) {
			field.formula = { type: "filtrex", code: "" };
		}
		return field;
	});

	const fieldValue = ref(cloneDeep(initialField.value));

	watch(() => props.field, (newField, oldField) => {
		if (fieldValue.value) {
			if (newField == null) {
				modalRef.value?.modal.hide();
				// TODO: Show message
			} else {
				mergeObject(oldField, newField, fieldValue.value);
			}
		}
	}, { deep: true });

	function validateFilter(filter: string | undefined) {
		return filterHasError(filter ?? "")?.message;
	}

	const isModified = computed(() => !isEqual(fieldValue.value, initialField.value));

	function save(): void {
		toasts.hideToast(`fm${context.id}-edit-type-dropdown-error`);
		emit("update:field", fieldValue.value);
		modalRef.value?.modal.hide();
	}


</script>

<template>
	<ModalDialog
		:title="i18n.t('edit-type-formula-dialog.title')"
		class="fm-edit-type-formula"
		:isModified="isModified"
		@submit="save()"
		@hidden="emit('hidden')"
		:okLabel="isModified ? i18n.t('edit-type-formula-dialog.ok-button') : undefined"
		ref="modalRef"
	>
		<p v-html="markdownBlock(i18n.t('edit-type-formula-dialog.introduction'), true)"></p>

		<ValidatedField
			:value="fieldValue.formula!.code"
			:validators="[
				validateFilter
			]"
			immediate
		>
			<template #default="slotProps">
				<textarea
					class="form-control text-monospace"
					v-model="fieldValue.formula!.code"
					rows="5"
					:ref="slotProps.inputRef"
				></textarea>
				<div class="invalid-feedback" v-if="slotProps.validationError">
					<pre>{{slotProps.validationError}}</pre>
				</div>
			</template>
		</ValidatedField>

		<hr />

		<FilterSyntax isFormula></FilterSyntax>
	</ModalDialog>
</template>

<style lang="scss">
	.fm-edit-type-formula {
		td.field {
			min-width: 10rem;
		}
	}
</style>