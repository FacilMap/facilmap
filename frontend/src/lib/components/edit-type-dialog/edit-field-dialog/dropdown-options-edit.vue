<script setup lang="ts">
	import type { CRU, FieldOptionUpdate, FieldUpdate, Type } from "facilmap-types";
	import { formatCheckboxValue, getControlNumber, getDefaultFieldShowInLegend } from "facilmap-utils";
	import ColourPicker from "../../ui/colour-picker.vue";
	import Draggable from "vuedraggable";
	import Icon from "../../ui/icon.vue";
	import ShapePicker from "../../ui/shape-picker.vue";
	import SizePicker from "../../ui/size-picker.vue";
	import IconPicker from "../../ui/icon-picker.vue";
	import WidthPicker from "../../ui/width-picker.vue";
	import { computed } from "vue";
	import { showConfirm } from "../../ui/alert.vue";
	import ValidatedField from "../../ui/validated-form/validated-field.vue";
	import StrokePicker from "../../ui/stroke-picker.vue";
	import { useI18n } from "../../../utils/i18n";
	import { useImmutableModel } from "../../../utils/vue";

	const i18n = useI18n();

	const props = defineProps<{
		type: Type<CRU.READ | CRU.CREATE_VALIDATED>;
	}>();

	const fieldModel = defineModel<FieldUpdate>({ required: true});
	const field = useImmutableModel(fieldModel, (f) => {
		if (f.type == 'checkbox') {
			if (!f.options || f.options.length != 2) {
				f.options = [
					{ value: "", oldValue: "" },
					{ value: f.name, oldValue: f.name }
				];
			}

			// Convert legacy format
			if (f.options[0].value == "0") {
				f.options[0].value = "";
			}
			if (f.options[1].value == "1") {
				f.options[1].value = f.name;
			}
		}
		return f;
	});

	const controlNumber = computed(() => getControlNumber(props.type, field.value));
	const columns = computed(() => controlNumber.value + (field.value.type === "checkbox" ? 2 : 3));

	const showInLegend = computed(() => props.type.showInLegend && (field.value.showInLegend ?? getDefaultFieldShowInLegend(props.type, field.value)));

	function validateOptionValue(value: string): string | undefined {
		if (field.value.type !== "checkbox" && field.value.options!.filter((op) => op.value === value).length > 1) {
			return i18n.t("edit-field-dialog.unique-value-error");
		}
	}

	function addOption(): void {
		if(field.value.options == null)
			field.value.options = [ ];

		field.value.options!.push({ value: "" });
	}

	async function deleteOption(option: FieldOptionUpdate): Promise<void> {
		if (!await showConfirm({
			title: i18n.t("edit-field-dialog.delete-option-title"),
			message: i18n.t("edit-field-dialog.delete-option-message", { value: option.value }),
			variant: "danger",
			okLabel: i18n.t("edit-field-dialog.delete-option-button")
		}))
			return;

		var idx = field.value.options!.indexOf(option);
		if(idx != -1)
			field.value.options!.splice(idx, 1);
	}
</script>

<template>
	<div v-if="field.type != 'checkbox' || controlNumber > 0 || showInLegend" class="fm-edit-field-dialog-dropdown-field-edit">
		<h2>{{i18n.t("edit-field-dialog.options")}}</h2>

		<table class="table table-striped table-hover">
			<thead>
				<tr>
					<th>{{i18n.t("edit-field-dialog.option")}}</th>
					<th v-if="field.type == 'checkbox' && showInLegend">{{i18n.t("edit-field-dialog.label")}}</th>
					<th v-if="field.controlColour">{{i18n.t("edit-field-dialog.colour")}}</th>
					<th v-if="field.controlSize">{{i18n.t("edit-field-dialog.size")}}</th>
					<th v-if="field.controlIcon">{{i18n.t("edit-field-dialog.icon")}}</th>
					<th v-if="field.controlShape">{{i18n.t("edit-field-dialog.shape")}}</th>
					<th v-if="field.controlWidth">{{i18n.t("edit-field-dialog.width")}}</th>
					<th v-if="field.controlStroke">{{i18n.t("edit-field-dialog.stroke")}}</th>
					<th v-if="field.type != 'checkbox'"></th>
					<th v-if="field.type != 'checkbox'" class="move"></th>
				</tr>
			</thead>
			<Draggable
				v-model="field.options"
				tag="tbody"
				handle=".fm-drag-handle"
				:itemKey="(option: any) => field.options!.indexOf(option)"
			>
				<template #item="{ element: option, index: idx }">
					<tr>
						<td v-if="field.type == 'checkbox'" class="align-middle">
							<strong>{{formatCheckboxValue(idx === 0 ? "0" : "1")}}</strong>
						</td>
						<ValidatedField
							v-if="field.type !== 'checkbox' || showInLegend"
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
						<td v-if="field.controlColour" class="field">
							<ColourPicker
								:modelValue="option.colour ?? props.type.defaultColour"
								@update:modelValue="option.colour = $event"
							></ColourPicker>
						</td>
						<td v-if="field.controlSize" class="field">
							<SizePicker
								:modelValue="option.size ?? props.type.defaultSize"
								@update:modelValue="option.size = $event"
							></SizePicker>
						</td>
						<td v-if="field.controlIcon" class="field">
							<IconPicker
								:modelValue="option.icon ?? props.type.defaultIcon"
								@update:modelValue="option.icon = $event"
							></IconPicker>
						</td>
						<td v-if="field.controlShape" class="field">
							<ShapePicker
								:modelValue="option.shape ?? props.type.defaultShape"
								@update:modelValue="option.shape = $event"
							></ShapePicker>
						</td>
						<td v-if="field.controlWidth" class="field">
							<WidthPicker
								:modelValue="option.width ?? props.type.defaultWidth"
								@update:modelValue="option.width = $event"
							></WidthPicker>
						</td>
						<td v-if="field.controlStroke" class="field">
							<StrokePicker
								:modelValue="option.stroke ?? props.type.defaultStroke"
								@update:modelValue="option.stroke = $event"
							></StrokePicker>
						</td>
						<td v-if="field.type != 'checkbox'" class="td-buttons">
							<button type="button" class="btn btn-secondary" @click="deleteOption(option)"><Icon icon="minus" :alt="i18n.t('edit-field-dialog.option-remove')"></Icon></button>
						</td>
						<td v-if="field.type != 'checkbox'" class="td-buttons">
							<button type="button" class="btn btn-secondary fm-drag-handle"><Icon icon="resize-vertical" :alt="i18n.t('edit-field-dialog.option-reorder')"></Icon></button>
						</td>
					</tr>
				</template>
			</Draggable>
			<tfoot v-if="field.type != 'checkbox'">
				<tr>
					<td :colspan="columns">
						<button type="button" class="btn btn-secondary" @click="addOption()"><Icon icon="plus" :alt="i18n.t('edit-field-dialog.option-add')"></Icon></button>
					</td>
				</tr>
			</tfoot>
		</table>
	</div>
</template>