<script setup lang="ts">
	import { typeValidator, type Field, type ID, type Type, type CRU } from "facilmap-types";
	import { canControl } from "facilmap-utils";
	import { getUniqueId, getZodValidator, validateRequired } from "../../utils/utils";
	import { mergeTypeObject } from "./edit-type-utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import ColourPicker from "../ui/colour-picker.vue";
	import ShapePicker from "../ui/shape-picker.vue";
	import SymbolPicker from "../ui/symbol-picker.vue";
	import RouteMode from "../ui/route-mode.vue";
	import Draggable from "vuedraggable";
	import FieldInput from "../ui/field-input.vue";
	import Icon from "../ui/icon.vue";
	import WidthPicker from "../ui/width-picker.vue";
	import SizePicker from "../ui/size-picker.vue";
	import EditTypeDropdownDialog from "./edit-type-dropdown-dialog.vue";
	import { computed, ref, watch } from "vue";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { showConfirm } from "../ui/alert.vue";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "../ui/validated-form/validated-field.vue";
	import StrokePicker from "../ui/stroke-picker.vue";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const client = requireClientContext(context);

	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		typeId: ID | "createMarkerType" | "createLineType";
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("fm-edit-type-dialog");

	const isCreate = computed(() => props.typeId === "createMarkerType" || props.typeId === "createLineType");

	const originalType = computed(() => {
		return typeof props.typeId === "number" ? client.value.types[props.typeId] : undefined;
	});

	const initialType = computed<Type<CRU.CREATE_VALIDATED | CRU.READ>>(() => {
		let type: Type<CRU.CREATE_VALIDATED | CRU.READ>;
		if (props.typeId === "createMarkerType") {
			type = {
				...typeValidator.create.parse({ name: "-", type: "marker" } satisfies Type<CRU.CREATE>),
				name: ""
			};
		} else if (props.typeId === "createLineType") {
			type = {
				...typeValidator.create.parse({ name: "-", type: "line" } satisfies Type<CRU.CREATE>),
				name: ""
			};
		} else {
			type = cloneDeep(originalType.value)!;
		}

		for(const field of type.fields) {
			(field as any).oldName = field.name;
		}

		return type;
	});

	const type = ref(cloneDeep(initialType.value));
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
		if (!await showConfirm({
			title: i18n.t("edit-type-dialog.delete-field-title"),
			message: i18n.t("edit-type-dialog.delete-field-message", { fieldName: field.name }),
			variant: "danger",
			okLabel: i18n.t("edit-type-dialog.delete-field-button")
		}))
			return;

		var idx = type.value.fields.indexOf(field);
		if(idx != -1)
			type.value.fields.splice(idx, 1);
	}

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-edit-type-error`);

		try {
			if (isCreate.value)
				await client.value.addType(type.value);
			else
				await client.value.editType(type.value as Type);

			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(
				`fm${context.id}-edit-type-error`,
				isCreate.value ? i18n.t("edit-type-dialog.create-type-error") : i18n.t("edit-type-dialog.save-type-error"),
				err
			);
		}
	}

	function editDropdown(field: Field): void {
		editField.value = field;
	}

	function handleUpdateField(field: Field) {
		const idx = type.value.fields.indexOf(editField.value!);
		if (idx === -1) {
			toasts.showErrorToast(
				`fm${context.id}-edit-type-dropdown-error`,
				i18n.t("edit-type-dialog.field-update-error"),
				new Error(i18n.t("edit-type-dialog.field-disappeared-error"))
			);
		}
		type.value.fields[idx] = field;
	}

	function validateFieldName(name: string) {
		if (type.value.fields.filter((field) => field.name == name).length > 1) {
			return i18n.t("edit-type-dialog.unique-field-name-error");
		}
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('edit-type-dialog.title')"
		class="fm-edit-type"
		:isModified="isModified"
		:isCreate="isCreate"
		ref="modalRef"
		@submit="$event.waitUntil(save())"
		@hidden="emit('hidden')"
	>
		<div class="row mb-3">
			<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.name")}}</label>
			<ValidatedField
				:value="type.name"
				:validators="[validateRequired, getZodValidator(typeValidator.update.shape.name)]"
				class="col-sm-9 position-relative"
			>
				<template #default="slotProps">
					<input class="form-control" :id="`${id}-name-input`" v-model="type.name" :ref="slotProps.inputRef" />
					<div class="invalid-tooltip">
						{{slotProps.validationError}}
					</div>
				</template>
			</ValidatedField>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-type-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.type")}}</label>
			<div class="col-sm-9">
				<select
					:id="`${id}-type-input`"
					v-model="type.type"
					class="form-select"
					disabled
				>
					<option value="marker">{{i18n.t("edit-type-dialog.type-marker")}}</option>
					<option value="line">{{i18n.t("edit-type-dialog.type-line")}}</option>
				</select>
			</div>
		</div>

		<template v-if="resolvedCanControl.length > 0">
			<hr/>

			<p class="text-muted">
				{{i18n.t("edit-type-dialog.styles-introduction")}}
			</p>

			<template v-if="resolvedCanControl.includes('colour')">
				<div class="row mb-3">
					<label :for="`${id}-default-colour-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.default-colour")}}</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<ColourPicker
									:id="`${id}-default-colour-input`"
									v-model="type.defaultColour"
								></ColourPicker>
							</div>
							<div class="col-sm-3">
								<div class="form-check">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-colour-fixed`"
										v-model="type.colourFixed"
									/>
									<label :for="`${id}-default-colour-fixed`" class="form-check-label">{{i18n.t("edit-type-dialog.fixed")}}</label>
								</div>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('size')">
				<div class="row mb-3">
					<label :for="`${id}-default-size-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.default-size")}}</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<SizePicker
									:id="`${id}-default-size-input`"
									v-model="type.defaultSize"
									class="fm-custom-range-with-label"
								></SizePicker>
							</div>
							<div class="col-sm-3">
								<div class="form-check fm-form-check-with-label">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-size-fixed`"
										v-model="type.sizeFixed"
									/>
									<label :for="`${id}-default-size-fixed`" class="form-check-label">{{i18n.t("edit-type-dialog.fixed")}}</label>
								</div>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('symbol')">
				<div class="row mb-3">
					<label :for="`${id}-default-symbol-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.default-icon")}}</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<SymbolPicker
									:id="`${id}-default-symbol-input`"
									v-model="type.defaultSymbol"
								></SymbolPicker>
							</div>
							<div class="col-sm-3">
								<div class="form-check">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-symbol-fixed`"
										v-model="type.symbolFixed"
									/>
									<label :for="`${id}-default-symbol-fixed`" class="form-check-label">{{i18n.t("edit-type-dialog.fixed")}}</label>
								</div>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('shape')">
				<div class="row mb-3">
					<label :for="`${id}-default-shape-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.default-shape")}}</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<ShapePicker
									:id="`${id}-default-shape-input`"
									v-model="type.defaultShape"
								></ShapePicker>
							</div>
							<div class="col-sm-3">
								<div class="form-check">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-shape-fixed`"
										v-model="type.shapeFixed"
									/>
									<label :for="`${id}-default-shape-fixed`" class="form-check-label">{{i18n.t("edit-type-dialog.fixed")}}</label>
								</div>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('width')">
				<div class="row mb-3">
					<label :for="`${id}-default-width-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.default-width")}}</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<WidthPicker
									:id="`${id}-default-width-input`"
									v-model="type.defaultWidth"
									class="fm-custom-range-with-label"
								></WidthPicker>
							</div>
							<div class="col-sm-3">
								<div class="form-check fm-form-check-with-label">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-width-fixed`"
										v-model="type.widthFixed"
									/>
									<label :for="`${id}-default-width-fixed`" class="form-check-label">{{i18n.t("edit-type-dialog.fixed")}}</label>
								</div>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('stroke')">
				<div class="row mb-3">
					<label :for="`${id}-default-stroke-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.default-stroke")}}</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<StrokePicker
									:id="`${id}-default-stroke-input`"
									v-model="type.defaultStroke"
								></StrokePicker>
							</div>
							<div class="col-sm-3">
								<div class="form-check fm-form-check-with-label">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-stroke-fixed`"
										v-model="type.strokeFixed"
									/>
									<label :for="`${id}-default-stroke-fixed`" class="form-check-label">{{i18n.t("edit-type-dialog.fixed")}}</label>
								</div>
							</div>
						</div>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('mode')">
				<div class="row mb-3">
					<label :for="`${id}-default-mode-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.default-route-mode")}}</label>
					<div class="col-sm-9">
						<div class="row align-items-center">
							<div class="col-sm-9">
								<RouteMode
									:id="`${id}-default-mode-input`"
									v-model="type.defaultMode"
								></RouteMode>
							</div>
							<div class="col-sm-3">
								<div class="form-check">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`${id}-default-mode-fixed`"
										v-model="type.modeFixed"
									/>
									<label :for="`${id}-default-mode-fixed`" class="form-check-label">{{i18n.t("edit-type-dialog.fixed")}}</label>
								</div>
							</div>
						</div>
					</div>
				</div>
			</template>

			<hr/>
		</template>

		<div class="row mb-3">
			<label :for="`${id}-show-in-legend-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-type-dialog.legend")}}</label>
			<div class="col-sm-9">
				<div class="form-check fm-form-check-with-label">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-in-legend-input`"
						v-model="type.showInLegend"
					/>
					<label :for="`${id}-show-in-legend-input`" class="form-check-label">{{i18n.t("edit-type-dialog.show-in-legend")}}</label>
				</div>
				<div class="form-text">
					{{i18n.t("edit-type-dialog.show-in-legend-description")}}
				</div>
			</div>
		</div>

		<h2>Fields</h2>
		<div class="table-responsive">
			<table class="table table-hover table-striped">
				<thead>
					<tr>
						<th style="width: 35%; min-width: 150px">{{i18n.t("edit-type-dialog.field-name")}}</th>
						<th style="width: 35%; min-width: 120px">{{i18n.t("edit-type-dialog.field-type")}}</th>
						<th style="width: 35%; min-width: 150px">{{i18n.t("edit-type-dialog.field-default-value")}}</th>
						<th>{{i18n.t("edit-type-dialog.field-delete")}}</th>
						<th></th>
					</tr>
				</thead>
				<Draggable
					v-model="type.fields"
					tag="tbody"
					handle=".fm-drag-handle"
					:itemKey="(field: any) => type.fields.indexOf(field)"
				>
					<template #item="{ element: field }">
						<tr>
							<ValidatedField
								tag="td"
								class="position-relative"
								:value="field.name"
								:validators="[validateRequired, validateFieldName]"
							>
								<template #default="slotProps">
									<input
										class="form-control"
										v-model="field.name"
										:ref="slotProps.inputRef"
									/>
									<div class="invalid-tooltip">
										{{slotProps.validationError}}
									</div>
								</template>
							</ValidatedField>
							<td>
								<div class="input-group">
									<select class="form-select" v-model="field.type">
										<option value="input">{{i18n.t("edit-type-dialog.field-type-input")}}</option>
										<option value="textarea">{{i18n.t("edit-type-dialog.field-type-textarea")}}</option>
										<option value="dropdown">{{i18n.t("edit-type-dialog.field-type-dropdown")}}</option>
										<option value="checkbox">{{i18n.t("edit-type-dialog.field-type-checkbox")}}</option>
									</select>
									<template v-if="['dropdown', 'checkbox'].includes(field.type)">
										<button type="button" class="btn btn-secondary" @click="editDropdown(field)">{{i18n.t("edit-type-dialog.field-edit")}}</button>
									</template>
								</div>
							</td>
							<td class="text-center">
								<FieldInput :field="field" v-model="field.default" ignore-default></FieldInput>
							</td>
							<td class="td-buttons">
								<button type="button" class="btn btn-secondary" @click="deleteField(field)">{{i18n.t("edit-type-dialog.field-delete")}}</button>
							</td>
							<td class="td-buttons">
								<button type="button" class="btn btn-secondary fm-drag-handle"><Icon icon="resize-vertical" :alt="i18n.t('edit-type-dialog.field-reorder')"></Icon></button>
							</td>
						</tr>
					</template>
				</Draggable>
				<tfoot>
					<tr>
						<td colspan="4">
							<button type="button" class="btn btn-secondary" @click="createField()"><Icon icon="plus" :alt="i18n.t('edit-type-dialog.field-add')"></Icon></button>
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