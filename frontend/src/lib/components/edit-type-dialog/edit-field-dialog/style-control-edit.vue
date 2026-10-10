<script setup lang="ts">
	import type { CRU, FieldUpdate, Type } from "facilmap-types";
	import { canControl, getDefaultFieldShowInLegend } from "facilmap-utils";
	import { getUniqueId } from "../../../utils/utils";
	import { computed, watch } from "vue";
	import { useI18n } from "../../../utils/i18n";
	import { useImmutableModel } from "../../../utils/vue";

	const i18n = useI18n();

	const props = defineProps<{
		type: Type<CRU.READ | CRU.CREATE_VALIDATED>;
	}>();

	const fieldModel = defineModel<FieldUpdate>({ required: true});
	const field = useImmutableModel(fieldModel);

	const id = getUniqueId("fm-edit-field-dialog-style-control-edit");

	const originalField = computed(() => props.type.fields.find((f) => f.name === (field.value.oldName ?? field.value.name)));
	const resolvedCanControl = computed(() => canControl(props.type, originalField.value));

	const typeInterpolation = computed(() => {
		if (props.type.type === "marker") {
			return i18n.t("edit-field-dialog.control-interpolation-marker");
		} else {
			return i18n.t("edit-field-dialog.control-interpolation-line");
		}
	});

	const defaultShowInLegend = computed(() => getDefaultFieldShowInLegend(props.type, field.value));

	const showInLegend = computed({
		get: () => field.value.showInLegend ?? defaultShowInLegend.value,
		set: (v) => {
			if (v === defaultShowInLegend.value) {
				delete field.value.showInLegend;
			} else {
				field.value.showInLegend = v;
			}
		}
	});

	watch(defaultShowInLegend, () => {
		delete field.value.showInLegend;
	});
</script>

<template>
	<div class="fm-edit-field-dialog-style-control-edit">
		<div class="row mb-3">
			<label class="col-sm-3 col-form-label">{{i18n.t("edit-field-dialog.control")}}</label>
			<div class="col-sm-9">
				<div class="form-check fm-form-check-with-label">
					<input
						:id="`${id}-control-colour`"
						class="form-check-input"
						type="checkbox"
						v-model="field.controlColour"
						:disabled="!resolvedCanControl.includes('colour')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-colour`"
					>
						{{i18n.t("edit-field-dialog.control-colour", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="props.type.type == 'marker'" class="form-check">
					<input
						:id="`${id}-control-size`"
						class="form-check-input"
						type="checkbox"
						v-model="field.controlSize"
						:disabled="!resolvedCanControl.includes('size')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-size`"
					>
						{{i18n.t("edit-field-dialog.control-size", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="props.type.type == 'marker'" class="form-check">
					<input
						:id="`${id}-control-icon`"
						class="form-check-input"
						type="checkbox"
						v-model="field.controlIcon"
						:disabled="!resolvedCanControl.includes('icon')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-icon`"
					>
						{{i18n.t("edit-field-dialog.control-icon", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="props.type.type == 'marker'" class="form-check">
					<input
						:id="`${id}-control-shape`"
						class="form-check-input"
						type="checkbox"
						v-model="field.controlShape"
						:disabled="!resolvedCanControl.includes('shape')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-shape`"
					>
						{{i18n.t("edit-field-dialog.control-shape", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="props.type.type == 'line'" class="form-check">
					<input
						:id="`${id}-control-width`"
						class="form-check-input"
						type="checkbox"
						v-model="field.controlWidth"
						:disabled="!resolvedCanControl.includes('width')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-width`"
					>
						{{i18n.t("edit-field-dialog.control-width", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="props.type.type == 'line'" class="form-check">
					<input
						:id="`${id}-control-stroke`"
						class="form-check-input"
						type="checkbox"
						v-model="field.controlStroke"
						:disabled="!resolvedCanControl.includes('stroke')"
					/>
					<label
						class="form-check-label"
						:for="`${id}-control-stroke`"
					>
						{{i18n.t("edit-field-dialog.control-stroke", { type: typeInterpolation })}}
					</label>
				</div>

				<div v-if="props.type.showInLegend" class="form-check">
					<input
						:id="`${id}-showInLegend`"
						class="form-check-input"
						type="checkbox"
						v-model="showInLegend"
					/>
					<label
						class="form-check-label"
						:for="`${id}-showInLegend`"
					>
						{{i18n.t("edit-field-dialog.show-in-legend")}}
					</label>
				</div>
			</div>
		</div>
	</div>
</template>