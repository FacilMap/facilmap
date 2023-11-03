<script setup lang="ts">
	import type { Field, ID, Type } from "facilmap-types";
	import { clone } from "facilmap-utils";
	import { canControl, getUniqueId, validateRequired, validations } from "../../utils/utils";
	import { mergeTypeObject } from "./edit-type-utils";
	import { isEqual } from "lodash-es";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import ColourField from "../ui/colour-field.vue";
	import ShapeField from "../ui/shape-field.vue";
	import SymbolField from "../ui/symbol-field.vue";
	import RouteMode from "../ui/route-mode.vue";
	import Draggable from "vuedraggable";
	import FieldInput from "../ui/field-input.vue";
	import Icon from "../ui/icon.vue";
	import WidthField from "../ui/width-field.vue";
	import SizeField from "../ui/size-field.vue";
	import EditTypeDropdownDialog from "./edit-type-dropdown-dialog.vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { computed, ref, watch } from "vue";
	import ModalDialog from "../ui/modal-dialog.vue";
	import vValidity from "../ui/validated-form/validity";
	import { showConfirm } from "../ui/alert.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();

	const toasts = useToasts();

	const props = defineProps<{
		typeId?: ID;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("fm-edit-type-dialog");

	const isCreate = computed(() => props.typeId == null);

	const originalType = computed(() => {
		return props.typeId != null ? client.types[props.typeId] : undefined;
	});

	const initialType = computed<Type>(() => {
		const type = isCreate.value ? { fields: [] } as any : clone(originalType.value)!;

		for(const field of type.fields) {
			field.oldName = field.name;
		}

		return type;
	});

	const type = ref(clone(initialType.value));
	const editField = ref<Field>();
	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const isModified = computed(() => {
		return !isEqual(type.value, initialType.value);
	});

	const resolvedCanControl = computed(() => canControl(type.value, null));

	watch(originalType, (newType, oldType) => {
		if (oldType && type.value) {
			if (!newType) {
				modalRef.value?.modal.hide();
				// TODO: Show message
			} else {
				mergeTypeObject(oldType, newType, type.value);
			}
		}
	});

	function createField(): void {
		type.value.fields.push({ name: "", type: "input", "default": "" });
	}

	async function deleteField(field: Field): Promise<void> {
		if (!await showConfirm({ title: "Delete field", message: `Do you really want to delete the field “${field.name}”?` }))
			return;

		var idx = type.value.fields.indexOf(field);
		if(idx != -1)
			type.value.fields.splice(idx, 1);
	}

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-edit-type-error`);

		for (const prop of [ "defaultWidth", "defaultSize", "defaultColour" ] as const) {
			if(type.value[prop] == "")
				type.value[prop] = undefined;
		}

		try {
			if (isCreate.value)
				await client.addType(type.value);
			else
				await client.editType(type.value);

			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-edit-type-error`, isCreate.value ? "Error creating type" : "Error saving type", err);
		}
	}

	function editDropdown(field: Field): void {
		editField.value = field;
	}

	function handleUpdateField(field: Field) {
		const idx = type.value.fields.indexOf(editField.value!);
		if (idx === -1)
			toasts.showErrorToast(`fm${context.id}-edit-type-dropdown-error`, "Error updating field", new Error("The field cannot be found on the type anymore."));
		type.value.fields[idx] = field;
	}

	const nameValidationError = computed(() => validateRequired(type.value.name));
	const typeValidationError = computed(() => validateRequired(type.value.type));
	const defaultColourValidationError = computed(() => {
		if (type.value.colourFixed) {
			return validateRequired(type.value.defaultColour);
		} else {
			return undefined;
		}
	});
	const defaultSizeValidationError = computed(() => {
		if (type.value.sizeFixed) {
			return validateRequired(type.value.defaultSize);
		} else {
			return undefined;
		}
	});
	const defaultSymbolValidationError = computed(() => {
		if (type.value.symbolFixed) {
			return validateRequired(type.value.defaultSymbol);
		} else {
			return undefined;
		}
	});
	const defaultShapeValidationError = computed(() => {
		if (type.value.shapeFixed) {
			return validateRequired(type.value.defaultShape);
		} else {
			return undefined;
		}
	});
	const defaultWidthValidationError = computed(() => {
		if (type.value.widthFixed) {
			return validateRequired(type.value.defaultWidth);
		} else {
			return undefined;
		}
	});
	const defaultModeValidationError = computed(() => {
		if (type.value.modeFixed) {
			return validateRequired(type.value.defaultMode);
		} else {
			return undefined;
		}
	});
	const fieldValidationErrors = computed(() => type.value.fields.map((field) => ({
		name: validations(field.name, [
			validateRequired,
			(name) => {
				if (type.value.fields.filter((field) => field.name == name).length > 1) {
					return "Multiple fields cannot have the same name.";
				}
			}
		])
	})));
</script>

<template>
	<ModalDialog
		title="Edit Type"
		class="fm-edit-type"
		:isModified="isModified"
		:isCreate="isCreate"
		@submit="$event.waitUntil(save())"
		@hidden="emit('hidden')"
	>
		<div class="row mb-3">
			<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">Name</label>
			<div class="col-sm-9">
				<input class="form-control" :id="`${id}-name-input`" v-model="type.name" v-validity="nameValidationError" />
				<div class="invalid-feedback" v-if="nameValidationError">
					{{nameValidationError}}
				</div>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-type-input`" class="col-sm-3 col-form-label">Type</label>
			<div class="col-sm-9">
				<select
					:id="`${id}-type-input`"
					v-model="type.type"
					class="form-select"
					:disabled="!isCreate"
					v-validity="typeValidationError"
				>
					<option value="marker">Marker</option>
					<option value="line">Line</option>
				</select>
				<div class="invalid-feedback" v-if="typeValidationError">
					{{typeValidationError}}
				</div>
			</div>
		</div>

		<template v-if="resolvedCanControl.length > 0">
			<hr/>

			<p class="text-muted">
				These styles are applied when a new object of this type is created. If “Fixed” is enabled, the style is applied to all objects
				of this type and cannot be changed for an individual object anymore. For more complex style control, dropdown or checkbox fields
				can be configured below to change the style based on their selected value.
			</p>

			<template v-if="resolvedCanControl.includes('colour')">
				<div class="row mb-3">
					<label :for="`${id}-default-colour-input`" class="col-sm-3 col-form-label">Default colour</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<ColourField
									:id="`${id}-default-colour-input`"
									v-model="type.defaultColour"
									:validationError="defaultColourValidationError"
								></ColourField>
							</div>
							<div class="col-sm-3">
								<input
									type="checkbox"
									class="form-check-input"
									:id="`${id}-default-colour-fixed`"
									v-model="type.colourFixed"
								/>
								<label :for="`${id}-default-colour-fixed`" class="form-check-label">Fixed</label>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('size')">
				<div class="row mb-3">
					<label :for="`${id}-default-size-input`" class="col-sm-3 col-form-label">Default size</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<SizeField
									:id="`${id}-default-size-input`"
									v-model="type.defaultSize"
									:validationError="defaultSizeValidationError"
								></SizeField>
							</div>
							<div class="col-sm-3">
								<input
									type="checkbox"
									class="form-check-input"
									:id="`${id}-default-size-fixed`"
									v-model="type.sizeFixed"
								/>
								<label :for="`${id}-default-size-fixed`" class="form-check-label">Fixed</label>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('symbol')">
				<div class="row mb-3">
					<label :for="`${id}-default-symbol-input`" class="col-sm-3 col-form-label">Default icon</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<SymbolField
									:id="`${id}-default-symbol-input`"
									v-model="type.defaultSymbol"
									:validationError="defaultSymbolValidationError"
								></SymbolField>
							</div>
							<div class="col-sm-3">
								<input
									type="checkbox"
									class="form-check-input"
									:id="`${id}-default-symbol-fixed`"
									v-model="type.symbolFixed"
								/>
								<label :for="`${id}-default-symbol-fixed`" class="form-check-label">Fixed</label>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('shape')">
				<div class="row mb-3">
					<label :for="`${id}-default-shape-input`" class="col-sm-3 col-form-label">Default shape</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<ShapeField
									:id="`${id}-default-shape-input`"
									v-model="type.defaultShape"
									:validationError="defaultShapeValidationError"
								></ShapeField>
							</div>
							<div class="col-sm-3">
								<input
									type="checkbox"
									class="form-check-input"
									:id="`${id}-default-shape-fixed`"
									v-model="type.shapeFixed"
								/>
								<label :for="`${id}-default-shape-fixed`" class="form-check-label">Fixed</label>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('width')">
				<div class="row mb-3">
					<label :for="`${id}-default-width-input`" class="col-sm-3 col-form-label">Default width</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<WidthField
									:id="`${id}-default-width-input`"
									v-model="type.defaultWidth"
									:validationError="defaultWidthValidationError"
								></WidthField>
							</div>
							<div class="col-sm-3">
								<input
									type="checkbox"
									class="form-check-input"
									:id="`${id}-default-width-fixed`"
									v-model="type.widthFixed"
								/>
								<label :for="`${id}-default-width-fixed`" class="form-check-label">Fixed</label>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('mode')">
				<div class="row mb-3">
					<label :for="`${id}-default-mode-input`" class="col-sm-3 col-form-label">Default routing mode</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<RouteMode
									:id="`${id}-default-mode-input`"
									v-model="type.defaultMode"
									:validationError="defaultModeValidationError"
								></RouteMode>
							</div>
							<div class="col-sm-3">
								<input
									type="checkbox"
									class="form-check-input"
									:id="`${id}-default-mode-fixed`"
									v-model="type.modeFixed"
								/>
								<label :for="`${id}-default-mode-fixed`" class="form-check-label">Fixed</label>
							</div>
						</div>
					</div>
				</div>
			</template>

			<hr/>
		</template>

		<div class="row mb-3">
			<label :for="`${id}-show-in-legend-input`" class="col-sm-3 col-form-label">Legend</label>
			<div class="col-sm-9">
				<input
					type="checkbox"
					class="form-check-input"
					:id="`${id}-show-in-legend-input`"
					v-model="type.showInLegend"
				/>
				<label :for="`${id}-show-in-legend-input`" class="form-check-label">Show in legend</label>
				<div class="form-text">
					An item for this type will be shown in the legend. Any fixed style attributes are applied to it. Dropdown or checkbox fields that control the style generate additional legend items.
				</div>
			</div>
		</div>

		<h2>Fields</h2>
		<div class="table-responseive">
			<table class="table table-hover table-striped">
				<thead>
					<tr>
						<th style="width: 35%; min-width: 150px">Name</th>
						<th style="width: 35%; min-width: 120px">Type</th>
						<th style="width: 35%; min-width: 150px">Default value</th>
						<th>Delete</th>
						<th></th>
					</tr>
				</thead>
				<Draggable
					v-model="type.fields"
					tag="tbody"
					handle=".fm-drag-handle"
					itemKey="(field: any) => type.fields.indexOf(field)"
				>
					<template #item="{ element: field, index: idx }">
						<tr>
							<td>
								<input
									class="form-control"
									v-model="field.name"
									v-validity="fieldValidationErrors[idx].name"
								/>
								<div class="invalid-feedback" v-if="fieldValidationErrors[idx].name">
									{{fieldValidationErrors[idx].name}}
								</div>
							</td>
							<td>
								<div class="input-group">
									<select class="form-select" v-model="field.type">
										<option value="input">Text field</option>
										<option value="textarea">Text area</option>
										<option value="dropdown">Dropdown</option>
										<option value="checkbox">Checkbox</option>
									</select>
									<template v-if="['dropdown', 'checkbox'].includes(field.type)">
										<button type="button" class="btn btn-secondary" @click="editDropdown(field)">Edit</button>
									</template>
								</div>
							</td>
							<td class="text-center">
								<FieldInput :field="field" v-model="field.default" ignore-default></FieldInput>
							</td>
							<td class="td-buttons">
								<button type="button" class="btn btn-secondary" @click="deleteField(field)">Delete</button>
							</td>
							<td class="td-buttons">
								<button type="button" class="btn btn-secondary fm-drag-handle"><Icon icon="resize-vertical" alt="Reorder"></Icon></button>
							</td>
						</tr>
					</template>
				</Draggable>
				<tfoot>
					<tr>
						<td colspan="4">
							<button type="button" class="btn btn-secondary" @click="createField()"><Icon icon="plus" alt="Add"></Icon></button>
						</td>
						<td class="move"></td>
					</tr>
				</tfoot>
			</table>
		</div>

		<EditTypeDropdownDialog
			v-if="editField != null"
			:type="type"
			:field="editField"
			@update:field="handleUpdateField($event)"
			@hidden="editField = undefined"
		></EditTypeDropdownDialog>
	</ModalDialog>
</template>