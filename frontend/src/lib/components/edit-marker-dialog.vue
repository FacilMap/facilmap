<script setup lang="ts">
	import { Writable, markerValidator, type ID } from "facilmap-types";
	import { canControl, formatFieldName, formatTypeName, getOrderedTypes, mergeObject } from "facilmap-utils";
	import { getUniqueId, getZodValidator, validateRequired } from "../utils/utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "./ui/modal-dialog.vue";
	import ColourPicker from "./ui/colour-picker.vue";
	import IconPicker from "./ui/icon-picker.vue";
	import ShapePicker from "./ui/shape-picker.vue";
	import FieldInput from "./ui/field-input.vue";
	import SizePicker from "./ui/size-picker.vue";
	import { computed, ref, toRef, watch } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import DropdownMenu from "./ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "./ui/validated-form/validated-field.vue";
	import { useI18n } from "../utils/i18n";
	import { useMaxBreakpoint } from "../utils/bootstrap";
	import EditTypeDialog from "./edit-type-dialog/edit-type-dialog.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		markerId: ID;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("edit-marker-dialog");
	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const originalMarker = toRef(() => client.value.markers[props.markerId]);

	const marker = ref(cloneDeep(originalMarker.value));

	const isModified = computed(() => !isEqual(marker.value, client.value.markers[props.markerId]));

	const types = computed(() => getOrderedTypes(client.value.types).filter((type) => type.type === "marker"));

	const resolvedCanControl = computed(() => canControl(client.value.types[marker.value.typeId]));

	const isXs = useMaxBreakpoint("xs");

	const showEditTypeDialog = ref<ID>();

	watch(originalMarker, (newMarker, oldMarker) => {
		if (!newMarker) {
			modalRef.value?.modal.hide();
			// TODO: Show message
		} else {
			mergeObject(oldMarker, newMarker, marker.value);
		}
	});

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-edit-marker-error`);

		try {
			await client.value.editMarker(marker.value);
			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-edit-marker-error`, () => i18n.t("edit-marker-dialog.save-error"), err);
		}
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('edit-marker-dialog.title')"
		class="fm-edit-marker"
		:isModified="isModified"
		ref="modalRef"
		@submit="$event.waitUntil(save())"
		@hidden="emit('hidden')"
	>
		<template #default>
			<div class="row mb-3">
				<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-marker-dialog.name")}}</label>
				<ValidatedField
					:value="marker.name"
					:validators="[getZodValidator(markerValidator.update.shape.name)]"
					class="col-sm-9 position-relative"
				>
					<template #default="slotProps">
						<input class="form-control" :id="`${id}-name-input`" v-model="marker.name" :ref="slotProps.inputRef" />
						<div class="invalid-tooltip">
							{{slotProps.validationError}}
						</div>
					</template>
				</ValidatedField>
			</div>

			<template v-if="resolvedCanControl.includes('colour')">
				<div class="row mb-3">
					<label :for="`${id}-colour-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-marker-dialog.colour")}}</label>
					<div class="col-sm-9">
						<ColourPicker
							:id="`${id}-colour-input`"
							v-model="marker.colour"
							:validators="[validateRequired]"
						></ColourPicker>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('size')">
				<div class="row mb-3">
					<label :for="`${id}-size-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-marker-dialog.size")}}</label>
					<div class="col-sm-9">
						<SizePicker
							:id="`${id}-size-input`"
							v-model="marker.size"
							class="fm-custom-range-with-label"
						></SizePicker>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('icon')">
				<div class="row mb-3">
					<label :for="`${id}-icon-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-marker-dialog.icon")}}</label>
					<div class="col-sm-9">
						<IconPicker :id="`${id}-icon-input`" v-model="marker.icon"></IconPicker>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('shape')">
				<div class="row mb-3">
					<label :for="`${id}-shape-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-marker-dialog.shape")}}</label>
					<div class="col-sm-9">
						<ShapePicker :id="`${id}-shape-input`" v-model="marker.shape"></ShapePicker>
					</div>
				</div>
			</template>

			<template v-for="(field, idx) in client.types[marker.typeId].fields" :key="field.name">
				<template v-if="field.type !== 'checkbox' || !isXs">
					<div class="row mb-3">
						<label :for="`${id}-${idx}-input`" class="col-sm-3 col-form-label text-break">{{formatFieldName(field.name)}}</label>
						<div class="col-sm-9" :class="{ 'fm-form-check-with-label': field.type === 'checkbox' }">
							<FieldInput
								:id="`${id}-${idx}-input`"
								:field="field"
								v-model="marker.data[field.name]"
							></FieldInput>
						</div>
					</div>
				</template>
				<template v-else>
					<FieldInput
						:id="`${id}-${idx}-input`"
						:field="field"
						v-model="marker.data[field.name]"
						showCheckboxLabel
					></FieldInput>
				</template>
			</template>
		</template>

		<template #footer-left>
			<DropdownMenu v-if="types.length > 1 || client.writable === Writable.ADMIN" class="dropup" :label="i18n.t('edit-marker-dialog.change-type')">
				<template v-for="type in types" :key="type.id">
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							:class="{ active: type.id == marker.typeId }"
							@click="marker.typeId = type.id"
						>{{formatTypeName(type.name)}}</a>
					</li>
				</template>

				<template v-if="client.writable === Writable.ADMIN && client.types[marker.typeId]">
					<li><hr class="dropdown-divider"></li>
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="showEditTypeDialog = marker.typeId"
						>{{i18n.t("edit-marker-dialog.edit-type", { type: client.types[marker.typeId].name })}}</a>
					</li>
				</template>
			</DropdownMenu>

			<EditTypeDialog
				v-if="showEditTypeDialog"
				:typeId="showEditTypeDialog"
				@hidden="showEditTypeDialog = undefined"
			></EditTypeDialog>
		</template>
	</ModalDialog>
</template>