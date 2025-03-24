<script setup lang="ts">
	import { lineValidator, type ID } from "facilmap-types";
	import { canControl, canEditType, cloneDeep, formatFieldName, formatTypeName, getOrderedTypes, mergeObject } from "facilmap-utils";
	import { getUniqueId, getZodValidator, validateRequired } from "../utils/utils";
	import { isEqual, omit } from "lodash-es";
	import ModalDialog from "./ui/modal-dialog.vue";
	import ColourPicker from "./ui/colour-picker.vue";
	import FieldInput from "./ui/field-input.vue";
	import RouteMode from "./ui/route-mode.vue";
	import WidthPicker from "./ui/width-picker.vue";
	import { computed, ref, toRef, watch } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import DropdownMenu from "./ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext, requireClientSub } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "./ui/validated-form/validated-field.vue";
	import StrokePicker from "./ui/stroke-picker.vue";
	import { useI18n } from "../utils/i18n";
	import { useMaxBreakpoint } from "../utils/bootstrap";
	import EditTypeDialog from "./edit-type-dialog/edit-type-dialog.vue";

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = requireClientSub(context);
	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		lineId: ID;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("fm-edit-line-dialog");

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const originalLine = toRef(() => clientSub.value.data.lines[props.lineId]);

	const line = ref(cloneDeep(originalLine.value));

	const isModified = computed(() => !isEqual(line.value, originalLine.value));

	const types = computed(() => getOrderedTypes(clientSub.value.data.types).filter((type) => type.type === "line"));

	const resolvedCanControl = computed(() => canControl(clientSub.value.data.types[line.value.typeId]));

	const isXs = useMaxBreakpoint("xs");

	const showEditTypeDialog = ref<ID>();

	const resolvedCanEditType = computed(() => !!clientSub.value.data.types[line.value.typeId] && canEditType(clientSub.value.data.mapData, clientSub.value.data.types[line.value.typeId]));

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
			await clientContext.value.client.updateLine(clientSub.value.mapSlug, line.value.id, omit(line.value, "trackPoints"));
			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-edit-line-error`, () => i18n.t("edit-line-dialog.save-error"), err);
		}
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('edit-line-dialog.title')"
		class="fm-edit-line"
		:isModified="isModified"
		@submit="$event.waitUntil(save())"
		@hidden="emit('hidden')"
		ref="modalRef"
	>
		<template #default>
			<div class="row mb-3">
				<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-line-dialog.name")}}</label>
				<ValidatedField
					:value="line.name"
					:validators="[getZodValidator(lineValidator.update.shape.name)]"
					class="col-sm-9 position-relative"
				>
					<template #default="slotProps">
						<input class="form-control" :id="`${id}-name-input`" v-model="line.name" :ref="slotProps.inputRef" />
						<div class="invalid-tooltip">
							{{slotProps.validationError}}
						</div>
					</template>
				</ValidatedField>
			</div>

			<div v-if="resolvedCanControl.includes('mode') && line.mode !== 'track' && context.settings.routing" class="row mb-3">
				<label class="col-sm-3 col-form-label">{{i18n.t("edit-line-dialog.routing-mode")}}</label>
				<div class="col-sm-9">
					<RouteMode v-model="line.mode"></RouteMode>
				</div>
			</div>

			<template v-if="resolvedCanControl.includes('colour')">
				<div class="row mb-3">
					<label :for="`${id}-colour-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-line-dialog.colour")}}</label>
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
					<label :for="`${id}-width-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-line-dialog.width")}}</label>
					<div class="col-sm-9">
						<WidthPicker
							:id="`${id}-width-input`"
							v-model="line.width"
							class="fm-custom-range-with-label"
						></WidthPicker>
					</div>
				</div>
			</template>

			<template v-if="resolvedCanControl.includes('stroke')">
				<div class="row mb-3">
					<label :for="`${id}-stroke-input`" class="col-sm-3 col-form-label">{{i18n.t("edit-line-dialog.stroke")}}</label>
					<div class="col-sm-9">
						<StrokePicker
							:id="`${id}-stroke-input`"
							v-model="line.stroke"
						></StrokePicker>
					</div>
				</div>
			</template>

			<template v-for="(field, idx) in clientSub.data.types[line.typeId].fields" :key="field.name">
				<template v-if="field.type !== 'checkbox' || !isXs">
					<div class="row mb-3">
						<label :for="`${id}-${idx}-input`" class="col-sm-3 col-form-label text-break">{{formatFieldName(field.name)}}</label>
						<div class="col-sm-9" :class="{ 'fm-form-check-with-label': field.type === 'checkbox' }">
							<FieldInput
								:id="`${id}-${idx}-input`"
								:field="field"
								v-model="line.data[field.name]"
							></FieldInput>
						</div>
					</div>
				</template>
				<template v-else>
					<FieldInput
						:id="`${id}-${idx}-input`"
						:field="field"
						v-model="line.data[field.name]"
						showCheckboxLabel
					></FieldInput>
				</template>
			</template>
		</template>

		<template #footer-left>
			<DropdownMenu v-if="types.length > 1 || resolvedCanEditType" class="dropup" :label="i18n.t('edit-line-dialog.change-type')">
				<template v-for="type in types" :key="type.id">
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							:class="{ active: type.id == line.typeId }"
							@click="line.typeId = type.id"
						>{{formatTypeName(type.name)}}</a>
					</li>
				</template>

				<template v-if="resolvedCanEditType">
					<li><hr class="dropdown-divider"></li>
					<li>
						<a
							href="javascript:"
							class="dropdown-item"
							@click="showEditTypeDialog = line.typeId"
						>{{i18n.t("edit-marker-dialog.edit-type", { type: clientSub.data.types[line.typeId].name })}}</a>
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