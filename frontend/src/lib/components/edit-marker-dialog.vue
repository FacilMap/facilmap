<script setup lang="ts">
	import type { ID } from "facilmap-types";
	import { canControl, getUniqueId, mergeObject, validateRequired } from "../utils/utils";
	import { clone } from "facilmap-utils";
	import { isEqual } from "lodash-es";
	import ModalDialog from "./ui/modal-dialog.vue";
	import ColourField from "./ui/colour-field.vue";
	import SymbolField from "./ui/symbol-field.vue";
	import ShapeField from "./ui/shape-field.vue";
	import FieldInput from "./ui/field-input.vue";
	import SizeField from "./ui/size-field.vue";
	import { computed, ref, toRef, watch } from "vue";
	import { injectContextRequired } from "../utils/context";
	import { injectClientRequired } from "./client-context.vue";
	import { useToasts } from "./ui/toasts/toasts.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const toasts = useToasts();

	const props = defineProps<{
		markerId: ID;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("edit-marker-dialog");
	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const originalMarker = toRef(() => client.markers[props.markerId]);

	const marker = ref(clone(originalMarker.value));

	const isModified = computed(() => !isEqual(marker.value, client.markers[props.markerId]));

	const types = computed(() => Object.values(client.types).filter((type) => type.type === "marker"));

	const resolvedCanControl = computed(() => canControl(client.types[marker.value.typeId]));

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
			await client.editMarker(marker.value);
			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-edit-marker-error`, "Error saving marker", err);
		}
	}

	const colourValidationError = computed(() => validateRequired(marker.value.colour));
</script>

<template>
	<ModalDialog
		title="Edit Marker"
		class="fm-edit-marker"
		:isModified="isModified"
		@submit="$event.waitUntil(save())"
		@hidden="emit('hidden')"
	>
		<template #default>
			<div class="row mb-3">
				<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">Name</label>
				<div class="col-sm-9">
					<input class="form-control" :id="`${id}-name-input`" v-model="marker.name" />
				</div>
			</div>

			<template v-if="resolvedCanControl.includes('colour')">
				<div class="row mb-3">
					<label :for="`${id}-colour-input`" class="col-sm-3 col-form-label">Colour</label>
					<div class="col-sm-9">
						<ColourField :id="`${id}-colour-input`" v-model="marker.colour" :validationError="colourValidationError"></ColourField>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('size')">
				<div class="row mb-3">
					<label :for="`${id}-size-input`" class="col-sm-3 col-form-label">Size</label>
					<div class="col-sm-9">
						<SizeField :id="`${id}-size-input`" v-model="marker.size"></SizeField>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('symbol')">
				<div class="row mb-3">
					<label :for="`${id}-symbol-input`" class="col-sm-3 col-form-label">Icon</label>
					<div class="col-sm-9">
						<SymbolField :id="`${id}-symbol-input`" v-model="marker.symbol"></SymbolField>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('shape')">
				<div class="row mb-3">
					<label :for="`${id}-shape-input`" class="col-sm-3 col-form-label">Shape</label>
					<div class="col-sm-9">
						<ShapeField :id="`${id}-shape-input`" v-model="marker.shape"></ShapeField>
					</div>
				</div>
			</template>

			<template v-for="(field, idx) in client.types[marker.typeId].fields" :key="field.name">
				<div class="row mb-3">
					<label :for="`${id}-${idx}-input`" class="col-sm-3 col-form-label">{{field.name}}</label>
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
			<div v-if="types.length > 1" class="dropup">
				<button type="button" class="btn btn-light dropdown-toggle">Change type</button>
				<ul class="dropdown-menu">
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
				</ul>
			</div>
		</template>
	</ModalDialog>
</template>