<script setup lang="ts">
	import type { CRU, Field, FieldOptionUpdate, FieldUpdate, Type } from "facilmap-types";
	import { canControl, formatCheckboxValue, mergeObject } from "facilmap-utils";
	import { getUniqueId } from "../../utils/utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ColourPicker from "../ui/colour-picker.vue";
	import Draggable from "vuedraggable";
	import Icon from "../ui/icon.vue";
	import ModalDialog from "../ui/modal-dialog.vue";
	import ShapePicker from "../ui/shape-picker.vue";
	import SizePicker from "../ui/size-picker.vue";
	import IconPicker from "../ui/icon-picker.vue";
	import WidthPicker from "../ui/width-picker.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { computed, ref, watch } from "vue";
	import { showConfirm } from "../ui/alert.vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "../ui/validated-form/validated-field.vue";
	import StrokePicker from "../ui/stroke-picker.vue";
	import { useI18n } from "../../utils/i18n";

	function getControlNumber(type: Type<CRU.READ | CRU.CREATE_VALIDATED>, field: FieldUpdate): number {
		return [
			field.controlColour,
			...(type.type == "marker" ? [
				field.controlSize,
				field.controlIcon,
				field.controlShape
			] : []),
			...(type.type == "line" ? [
				field.controlWidth,
				field.controlStroke
			] : [])
		].filter((v) => v).length;
	}

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

	const id = getUniqueId("fm-edit-type-dropdown-dialog");

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const initialField = computed(() => {
		const field: FieldUpdate = cloneDeep(props.field);

		if(field.type == 'checkbox') {
			if(!field.options || field.options.length != 2) {
				field.options = [
					{ value: '' },
					{ value: field.name }
				]
			}

			// Convert legacy format
			if(field.options[0].value == "0")
				field.options[0].value = "";
			if(field.options[1].value == "1")
				field.options[1].value = field.name;
		}

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

	const resolvedCanControl = computed(() => canControl(props.type, props.field));

	function addOption(): void {
		if(fieldValue.value.options == null)
			fieldValue.value.options = [ ];

		fieldValue.value.options!.push({ value: "" });
	}

	async function deleteOption(option: FieldOptionUpdate): Promise<void> {
		if (!await showConfirm({
			title: i18n.t("edit-type-dropdown-dialog.delete-option-title"),
			message: i18n.t("edit-type-dropdown-dialog.delete-option-message", { value: option.value }),
			variant: "danger",
			okLabel: i18n.t("edit-type-dropdown-dialog.delete-option-button")
		}))
			return;

		var idx = fieldValue.value.options!.indexOf(option);
		if(idx != -1)
			fieldValue.value.options!.splice(idx, 1);
	}

	function save(): void {
		toasts.hideToast(`fm${context.id}-edit-type-dropdown-error`);
		emit("update:field", fieldValue.value);
		modalRef.value?.modal.hide();
	}

	const controlNumber = computed(() => getControlNumber(props.type, fieldValue.value));

	const columns = computed(() => controlNumber.value + (fieldValue.value.type === "checkbox" ? 2 : 3));

	function validateOptionValue(value: string): string | undefined {
		if (fieldValue.value.type !== "checkbox" && fieldValue.value.options!.filter((op) => op.value === value).length > 1) {
			return i18n.t("edit-type-dropdown-dialog.unique-value-error");
		}
	}

	const formValidationError = computed(() => {
		if (controlNumber.value > 0 && (fieldValue.value.options?.length ?? 0) === 0) {
			return i18n.t("edit-type-dropdown-dialog.no-options-error");
		} else {
			return undefined;
		}
	});

	const typeInterpolation = computed(() => {
		if (props.type.type === "marker") {
			return i18n.t("edit-type-dropdown-dialog.control-interpolation-marker");
		} else {
			return i18n.t("edit-type-dropdown-dialog.control-interpolation-line");
		}
	});
</script>

<template>
	<ModalDialog
		:title="fieldValue.type === 'checkbox' ? i18n.t('edit-type-dropdown-dialog.title-checkbox') : i18n.t('edit-type-dropdown-dialog.title-dropdown')"
		class="fm-edit-type-dropdown"
		:isModified="isModified"
		@submit="save()"
		@hidden="emit('hidden')"
		:size="fieldValue && controlNumber > 2 ? 'xl' : 'lg'"
		:okLabel="isModified ? i18n.t('edit-type-dropdown-dialog.ok-button') : undefined"
		:formValidationError="formValidationError"
		ref="modalRef"
	>
		<div class="row mb-3">
			<label class="col-sm-3 col-form-label">{{i18n.t("edit-type-dropdown-dialog.control")}}</label>
			<div class="col-sm-9">
				<div class="form-check fm-form-check-with-label">
					<input
						:id="`${id}-control-colour`"
						class="form-check-input"
						type="checkbox"
						v-model="fieldValue.controlColour"
						:disabled="!resolvedCanControl.includes('colour')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-colour`"
					>
						{{i18n.t("edit-type-dropdown-dialog.control-colour", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="type.type == 'marker'" class="form-check">
					<input
						:id="`${id}-control-size`"
						class="form-check-input"
						type="checkbox"
						v-model="fieldValue.controlSize"
						:disabled="!resolvedCanControl.includes('size')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-size`"
					>
						{{i18n.t("edit-type-dropdown-dialog.control-size", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="type.type == 'marker'" class="form-check">
					<input
						:id="`${id}-control-icon`"
						class="form-check-input"
						type="checkbox"
						v-model="fieldValue.controlIcon"
						:disabled="!resolvedCanControl.includes('icon')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-icon`"
					>
						{{i18n.t("edit-type-dropdown-dialog.control-icon", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="type.type == 'marker'" class="form-check">
					<input
						:id="`${id}-control-shape`"
						class="form-check-input"
						type="checkbox"
						v-model="fieldValue.controlShape"
						:disabled="!resolvedCanControl.includes('shape')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-shape`"
					>
						{{i18n.t("edit-type-dropdown-dialog.control-shape", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="type.type == 'line'" class="form-check">
					<input
						:id="`${id}-control-width`"
						class="form-check-input"
						type="checkbox"
						v-model="fieldValue.controlWidth"
						:disabled="!resolvedCanControl.includes('width')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-width`"
					>
						{{i18n.t("edit-type-dropdown-dialog.control-width", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="type.type == 'line'" class="form-check">
					<input
						:id="`${id}-control-stroke`"
						class="form-check-input"
						type="checkbox"
						v-model="fieldValue.controlStroke"
						:disabled="!resolvedCanControl.includes('stroke')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-stroke`"
					>
						{{i18n.t("edit-type-dropdown-dialog.control-stroke", { type: typeInterpolation })}}
					</label>
				</div>
			</div>
		</div>
		<table v-if="fieldValue.type != 'checkbox' || controlNumber > 0" class="table table-striped table-hover">
			<thead>
				<tr>
					<th>{{i18n.t("edit-type-dropdown-dialog.option")}}</th>
					<th v-if="fieldValue.type == 'checkbox'">{{i18n.t("edit-type-dropdown-dialog.label")}}</th>
					<th v-if="fieldValue.controlColour">{{i18n.t("edit-type-dropdown-dialog.colour")}}</th>
					<th v-if="fieldValue.controlSize">{{i18n.t("edit-type-dropdown-dialog.size")}}</th>
					<th v-if="fieldValue.controlIcon">{{i18n.t("edit-type-dropdown-dialog.icon")}}</th>
					<th v-if="fieldValue.controlShape">{{i18n.t("edit-type-dropdown-dialog.shape")}}</th>
					<th v-if="fieldValue.controlWidth">{{i18n.t("edit-type-dropdown-dialog.width")}}</th>
					<th v-if="fieldValue.controlStroke">{{i18n.t("edit-type-dropdown-dialog.stroke")}}</th>
					<th v-if="fieldValue.type != 'checkbox'"></th>
					<th v-if="fieldValue.type != 'checkbox'" class="move"></th>
				</tr>
			</thead>
			<Draggable
				v-model="fieldValue.options"
				tag="tbody"
				handle=".fm-drag-handle"
				:itemKey="(option: any) => fieldValue.options!.indexOf(option)"
			>
				<template #item="{ element: option, index: idx }">
					<tr>
						<td v-if="fieldValue.type == 'checkbox'" class="align-middle">
							<strong>{{formatCheckboxValue(idx === 0 ? "0" : "1")}}</strong>
						</td>
						<ValidatedField
							tag="td"
							class="field position-relative"
							:value="option.value"
							:validators="[validateOptionValue]"
						>
							<template #default="slotProps">
								<input
									class="form-control"
									v-model="option.value"
									:ref="slotProps.inputRef"
								/>
								<div class="invalid-tooltip">
									{{slotProps.validationError}}
								</div>
							</template>
						</ValidatedField>
						<td v-if="fieldValue.controlColour" class="field">
							<ColourPicker
								:modelValue="option.colour ?? type.defaultColour"
								@update:modelValue="option.colour = $event"
							></ColourPicker>
						</td>
						<td v-if="fieldValue.controlSize" class="field">
							<SizePicker
								:modelValue="option.size ?? type.defaultSize"
								@update:modelValue="option.size = $event"
								class="fm-custom-range-with-label"
							></SizePicker>
						</td>
						<td v-if="fieldValue.controlIcon" class="field">
							<IconPicker
								:modelValue="option.icon ?? type.defaultIcon"
								@update:modelValue="option.icon = $event"
							></IconPicker>
						</td>
						<td v-if="fieldValue.controlShape" class="field">
							<ShapePicker
								:modelValue="option.shape ?? type.defaultShape"
								@update:modelValue="option.shape = $event"
							></ShapePicker>
						</td>
						<td v-if="fieldValue.controlWidth" class="field">
							<WidthPicker
								:modelValue="option.width ?? type.defaultWidth"
								@update:modelValue="option.width = $event"
								class="fm-custom-range-with-label"
							></WidthPicker>
						</td>
						<td v-if="fieldValue.controlStroke" class="field">
							<StrokePicker
								:modelValue="option.stroke ?? type.defaultStroke"
								@update:modelValue="option.stroke = $event"
							></StrokePicker>
						</td>
						<td v-if="fieldValue.type != 'checkbox'" class="td-buttons">
							<button type="button" class="btn btn-secondary" @click="deleteOption(option)"><Icon icon="minus" :alt="i18n.t('edit-type-dropdown-dialog.option-remove')"></Icon></button>
						</td>
						<td v-if="fieldValue.type != 'checkbox'" class="td-buttons">
							<button type="button" class="btn btn-secondary fm-drag-handle"><Icon icon="resize-vertical" :alt="i18n.t('edit-type-dropdown-dialog.option-reorder')"></Icon></button>
						</td>
					</tr>
				</template>
			</Draggable>
			<tfoot v-if="fieldValue.type != 'checkbox'">
				<tr>
					<td :colspan="columns">
						<button type="button" class="btn btn-secondary" @click="addOption()"><Icon icon="plus" :alt="i18n.t('edit-type-dropdown-dialog.option-add')"></Icon></button>
					</td>
				</tr>
			</tfoot>
		</table>

		<div class="fm-form-invalid-feedback" v-if="formValidationError">
			{{formValidationError}}
		</div>
	</ModalDialog>
</template>

<style lang="scss">
	.fm-edit-type-dropdown {
		td.field {
			min-width: 10rem;
		}
	}
</style>