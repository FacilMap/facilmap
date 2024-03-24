<script setup lang="ts">
	import { markerValidator, type ID } from "facilmap-types";
	import { canControl, getOrderedTypes, mergeObject } from "facilmap-utils";
	import { getUniqueId, getZodValidator, validateRequired } from "../utils/utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "./ui/modal-dialog.vue";
	import ColourPicker from "./ui/colour-picker.vue";
	import SymbolPicker from "./ui/symbol-picker.vue";
	import ShapePicker from "./ui/shape-picker.vue";
	import FieldInput from "./ui/field-input.vue";
	import SizePicker from "./ui/size-picker.vue";
	import { computed, ref, toRef, watch } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import DropdownMenu from "./ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "./ui/validated-form/validated-field.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const toasts = useToasts();

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
			toasts.showErrorToast(`fm${context.id}-edit-marker-error`, "Error saving marker", err);
		}
	}
</script>

<template>
	<ModalDialog
		title="Edit Marker"
		class="fm-edit-marker"
		:isModified="isModified"
		ref="modalRef"
		@submit="$event.waitUntil(save())"
		@hidden="emit('hidden')"
	>
		<template #default>
			<div class="row mb-3">
				<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">Name</label>
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
					<label :for="`${id}-colour-input`" class="col-sm-3 col-form-label">Colour</label>
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
					<label :for="`${id}-size-input`" class="col-sm-3 col-form-label">Size</label>
					<div class="col-sm-9">
						<SizePicker
							:id="`${id}-size-input`"
							v-model="marker.size"
							class="fm-custom-range-with-label"
						></SizePicker>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('symbol')">
				<div class="row mb-3">
					<label :for="`${id}-symbol-input`" class="col-sm-3 col-form-label">Icon</label>
					<div class="col-sm-9">
						<SymbolPicker :id="`${id}-symbol-input`" v-model="marker.symbol"></SymbolPicker>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('shape')">
				<div class="row mb-3">
					<label :for="`${id}-shape-input`" class="col-sm-3 col-form-label">Shape</label>
					<div class="col-sm-9">
						<ShapePicker :id="`${id}-shape-input`" v-model="marker.shape"></ShapePicker>
					</div>
				</div>
			</template>

			<template v-for="(field, idx) in client.types[marker.typeId].fields" :key="field.name">
				<div class="row mb-3">
					<label :for="`${id}-${idx}-input`" class="col-sm-3 col-form-label text-break">{{field.name}}</label>
					<div class="col-sm-9">
						<FieldInput
							:id="`fm-edit-marker-${idx}-input`"
							:field="field"
							v-model="marker.data[field.name]"
						></FieldInput>
					</div>
				</div>
			</template>
		</template>

		<template #footer-left>
			<DropdownMenu v-if="types.length > 1" class="dropup" label="Change type">
				<template v-for="type in types" :key="type.id">
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							:class="{ active: type.id == marker.typeId }"
							@click="marker.typeId = type.id"
						>{{type.name}}</a>
					</li>
				</template>
			</DropdownMenu>
		</template>
	</ModalDialog>
</template>