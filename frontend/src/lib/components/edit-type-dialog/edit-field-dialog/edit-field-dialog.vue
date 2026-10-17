<script setup lang="ts">
	import type { CRU, Field, FieldUpdate, Type } from "facilmap-types";
	import { getControlNumber, mergeObject } from "facilmap-utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "../../ui/modal-dialog.vue";
	import { useToasts } from "../../ui/toasts/toasts.vue";
	import { computed, ref, watch } from "vue";
	import { injectContextRequired } from "../../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../../utils/i18n";
	import DropdownOptionsEdit from "./dropdown-options-edit.vue";
	import FormulaFieldEdit from "./formula-field-edit.vue";
	import { getUniqueId } from "../../../utils/utils.js";
	import FieldInput from "../../ui/field-input.vue";
	import FieldTypePicker from "../../ui/field-type-picker.vue";
	import StyleControlEdit from "./style-control-edit.vue";
	import FieldVisibilityPicker from "../../ui/field-visibility-picker.vue";

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

	const id = getUniqueId("fm-edit-field-dialog");

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const initialField = computed(() => {
		const field: FieldUpdate = cloneDeep(props.field);

		for(let option of (field.options || []))
			option.oldValue = option.value;

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

	const isModified = computed(() => !isEqual(fieldValue.value, initialField.value));

	function save(): void {
		toasts.hideToast(`fm${context.id}-edit-type-dropdown-error`);

		// "view" visibility is only supported for formula fields. When switching the field type, the visibility picker
		// already displays it as undefined.
		if (fieldValue.value.type !== "formula" && fieldValue.value.visibility === "view") {
			fieldValue.value.visibility = undefined;
		}

		emit("update:field", fieldValue.value);
		modalRef.value?.modal.hide();
	}

	const controlNumber = computed(() => getControlNumber(props.type, fieldValue.value));
</script>

<template>
	<ModalDialog
		:title="i18n.t('edit-field-dialog.title', { name: fieldValue.name })"
		class="fm-edit-type-dropdown"
		:isModified="isModified"
		@submit="save()"
		@hidden="emit('hidden')"
		:size="fieldValue && controlNumber > 2 ? 'xl' : 'lg'"
		:okLabel="isModified ? i18n.t('edit-field-dialog.ok-button') : undefined"
		ref="modalRef"
	>
		<div class="row mb-3">
			<label :for="`${id}-field-type-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-field-dialog.field-type")}}</label>
			<div class="col-sm-9">
				<FieldTypePicker :id="`${id}-field-type-input`" v-model="fieldValue.type"></FieldTypePicker>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-visibility-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-field-dialog.visibility")}}</label>
			<div class="col-sm-9">
				<FieldVisibilityPicker
					:id="`${id}-visibility-input`"
					v-model="fieldValue.visibility"
					:fieldType="fieldValue.type"
				></FieldVisibilityPicker>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-description-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-field-dialog.description")}}</label>
			<div class="col-sm-9">
				<textarea
					:id="`${id}-description-input`"
					class="form-control"
					v-model="fieldValue.description"
					style="height: 4em"
				></textarea>
				<div class="form-text">
					{{i18n.t("edit-field-dialog.description-description")}}
				</div>
			</div>
		</div>

		<div v-if="fieldValue.type !== 'formula'" class="row mb-3">
			<label :for="`${id}-edit-hint-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-field-dialog.edit-hint")}}</label>
			<div class="col-sm-9">
				<textarea
					:id="`${id}-edit-hint-input`"
					class="form-control"
					v-model="fieldValue.editHint"
					style="height: 4em"
				></textarea>
				<div class="form-text">
					{{i18n.t("edit-field-dialog.edit-hint-description")}}
				</div>
			</div>
		</div>

		<div v-if="fieldValue.type !== 'formula'" class="row mb-3">
			<label :for="`${id}-default-value-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-field-dialog.default-value")}}</label>
			<div class="col-sm-9" :class="{ 'fm-form-check-with-label': fieldValue.type === 'checkbox' }">
				<FieldInput
					:id="`${id}-default-value-input`"
					:field="fieldValue"
					v-model="fieldValue.default"
					noHint
					ignoreDefault
				></FieldInput>
			</div>
		</div>

		<template v-if="fieldValue.type === 'dropdown' || fieldValue.type === 'checkbox'">
			<StyleControlEdit
				v-model="fieldValue"
				:type="props.type"
			></StyleControlEdit>

			<hr />

			<DropdownOptionsEdit
				v-model="fieldValue"
				:type="props.type"
			></DropdownOptionsEdit>
		</template>

		<template v-else-if="fieldValue.type === 'formula'">
			<hr />

			<FormulaFieldEdit
				v-model="fieldValue"
			></FormulaFieldEdit>
		</template>
	</ModalDialog>
</template>

<style lang="scss">
	.fm-edit-type-dropdown {
		td.field {
			min-width: 10rem;
		}
	}
</style>