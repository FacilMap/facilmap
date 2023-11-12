<script setup lang="ts">
	import type { ID } from "facilmap-types";
	import { canControl, getUniqueId, mergeObject, validateRequired } from "../utils/utils";
	import { cloneDeep, isEqual, omit } from "lodash-es";
	import ModalDialog from "./ui/modal-dialog.vue";
	import ColourPicker from "./ui/colour-picker.vue";
	import FieldInput from "./ui/field-input.vue";
	import RouteMode from "./ui/route-mode.vue";
	import WidthPicker from "./ui/width-picker.vue";
	import { computed, ref, toRef, watch } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import DropdownMenu from "./ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext } from "./facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const toasts = useToasts();

	const props = defineProps<{
		lineId: ID;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("fm-edit-line-dialog");

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const originalLine = toRef(() => client.value.lines[props.lineId]);

	const line = ref(cloneDeep(originalLine.value));

	const isModified = computed(() => !isEqual(line.value, originalLine.value));

	const types = computed(() => Object.values(client.value.types).filter((type) => type.type === "line"));

	const resolvedCanControl = computed(() => canControl(client.value.types[line.value.typeId]));

	watch(originalLine, (newLine, oldLine) => {
		if (!newLine) {
			modalRef.value?.modal.hide();
			// TODO: Show message
		} else {
			mergeObject(oldLine, newLine, line.value);
		}
	});

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-edit-line-error`);

		try {
			await client.value.editLine(omit(line.value, "trackPoints"));
			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-edit-line-error`, "Error saving line", err);
		}
	}
</script>

<template>
	<ModalDialog
		title="Edit Line"
		class="fm-edit-line"
		:isModified="isModified"
		@submit="$event.waitUntil(save())"
		@hidden="emit('hidden')"
		ref="modalRef"
	>
		<template #default>
			<div class="row mb-3">
				<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">Name</label>
				<div class="col-sm-9">
					<input class="form-control" :id="`${id}-name-input`" v-model="line.name" />
				</div>
			</div>

			<div v-if="resolvedCanControl.includes('mode') && line.mode !== 'track'" class="row mb-3">
				<label class="col-sm-3 col-form-label">Routing mode</label>
				<div class="col-sm-9">
					<RouteMode v-model="line.mode"></RouteMode>
				</div>
			</div>

			<template v-if="resolvedCanControl.includes('colour')">
				<div class="row mb-3">
					<label :for="`${id}-colour-input`" class="col-sm-3 col-form-label">Colour</label>
					<div class="col-sm-9">
						<ColourPicker
							:id="`${id}-colour-input`"
							v-model="line.colour"
							:validators="[validateRequired]"
						></ColourPicker>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('width')">
				<div class="row mb-3">
					<label :for="`${id}-width-input`" class="col-sm-3 col-form-label">Width</label>
					<div class="col-sm-9">
						<WidthPicker
							:id="`${id}-width-input`"
							v-model="line.width"
							class="fm-custom-range-with-label"
						></WidthPicker>
					</div>
				</div>
			</template>

			<template v-for="(field, idx) in client.types[line.typeId].fields" :key="field.name">
				<div class="row mb-3">
					<label :for="`${id}-${idx}-input`" class="col-sm-3 col-form-label">{{field.name}}</label>
					<div class="col-sm-9">
						<FieldInput
							:id="`${id}-${idx}-input`"
							:field="field"
							v-model="line.data[field.name]"
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
							:class="{ active: type.id == line.typeId }"
							@click="line.typeId = type.id"
						>{{type.name}}</a>
					</li>
				</template>
			</DropdownMenu>
		</template>
	</ModalDialog>
</template>