<script setup lang="ts">
	import { getCurrentView, getLayers } from "facilmap-leaflet";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { computed, ref } from "vue";
	import { getUniqueId, validateRequired } from "../utils/utils";
	import { round } from "facilmap-utils";
	import { injectContextRequired, requireClientContext, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "./ui/validated-form/validated-field.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);
	const toasts = useToasts();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("fm-save-view");

	const name = ref("");
	const includeOverpass = ref(false);
	const includeFilter = ref(false);
	const makeDefault = ref(false);

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const baseLayer = computed(() => {
		const { baseLayers } = getLayers(mapContext.value.components.map);
		return baseLayers[mapContext.value.layers.baseLayer].options.fmName || mapContext.value.layers.baseLayer;
	});

	const overlays = computed(() => {
		const { overlays } = getLayers(mapContext.value.components.map);
		return mapContext.value.layers.overlays.map((key) => overlays[key].options.fmName || key).join(", ") || "—";
	});

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-save-view-error`);

		try {
			const view = await client.value.addView({
				...getCurrentView(mapContext.value.components.map, {
					includeFilter: includeFilter.value,
					overpassLayer: includeOverpass.value ? mapContext.value.components.overpassLayer : undefined
				}),
				name: name.value
			});

			if (makeDefault.value) {
				await client.value.editPad({ defaultViewId: view.id });
			}

			modalRef.value?.modal.hide();
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-save-view-error`, "Error saving view", err);
		}
	};
</script>

<template>
	<ModalDialog
		title="Save current view"
		class="fm-save-view"
		:isCreate="true"
		ref="modalRef"
		@submit="$event.waitUntil(save())"
		@hidden="emit('hidden')"
	>
		<div class="row mb-3">
			<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">Name</label>
			<ValidatedField
				:value="name"
				:validators="[
					validateRequired
				]"
				class="col-sm-9 position-relative"
			>
				<template #default="slotProps">
					<input
						class="form-control"
						:id="`${id}-name-input`"
						v-model="name"
						:ref="slotProps.inputRef"
					/>
					<div class="invalid-tooltip">
						{{slotProps.validationError}}
					</div>
				</template>
			</ValidatedField>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-topleft-input`" class="col-sm-3 col-form-label">Top left</label>
			<div class="col-sm-9">
				<input
					class="form-control-plaintext"
					readonly
					:id="`${id}-topleft-input`"
					:value="`${round(mapContext.bounds.getNorth(), 5)}, ${round(mapContext.bounds.getWest(), 5)}`"
				/>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-bottomright-input`" class="col-sm-3 col-form-label">Bottom right</label>
			<div class="col-sm-9">
				<input
					class="form-control-plaintext"
					readonly
					:id="`${id}-bottomright-input`"
					:value="`${round(mapContext.bounds.getSouth(), 5)}, ${round(mapContext.bounds.getEast(), 5)}`"
				/>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-base-layer-input`" class="col-sm-3 col-form-label">Base layer</label>
			<div class="col-sm-9">
				<input
					class="form-control-plaintext"
					readonly
					:id="`${id}-base-layer-input`"
					:value="baseLayer"
				/>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-overlays-input`" class="col-sm-3 col-form-label">Overlays</label>
			<div class="col-sm-9">
				<input
					class="form-control-plaintext"
					readonly
					:id="`${id}-overlays-input`"
					:value="overlays"
				/>
			</div>
		</div>

		<template v-if="mapContext.overpassIsCustom ? !mapContext.overpassCustom : mapContext.overpassPresets.length == 0">
			<div class="row mb-3">
				<label :for="`${id}-overpass-input`" class="col-sm-3 col-form-label">POIs</label>
				<div class="col-sm-9">
					<input
						class="form-control-plaintext"
						readonly
						:id="`${id}-overpass-input`"
						value="—"
					/>
				</div>
			</div>
		</template>

		<template v-else>
			<div class="row mb-3">
				<label :for="`${id}-overpass-input`" class="col-sm-3 col-form-label">POIs</label>
				<div class="col-sm-9">
					<div class="form-check fm-form-check-with-label">
						<input
							type="checkbox"
							class="form-check-input"
							:id="`${id}-overpass-input`"
							v-model="includeOverpass"
						/>
						<label class="form-check-label" :for="`${id}-overpass-input`">
							Include POIs (<code v-if="mapContext.overpassIsCustom">{{mapContext.overpassCustom}}</code><template v-else>{{mapContext.overpassPresets.map((p) => p.label).join(', ')}}</template>)
						</label>
					</div>
				</div>
			</div>
		</template>

		<template v-if="!mapContext.filter">
			<div class="row mb-3">
				<label :for="`${id}-filter-input`" class="col-sm-3 col-form-label">Filter</label>
				<div class="col-sm-9">
					<input class="form-control-plaintext" :id="`${id}-filter-input`" value="—" />
				</div>
			</div>
		</template>

		<template v-else>
			<div class="row mb-3">
				<label :for="`${id}-filter-checkbox`" class="col-sm-3 col-form-label">Filter</label>
				<div class="col-sm-9">
					<div class="form-check fm-form-check-with-label">
						<input
							type="checkbox"
							class="form-check-input"
							:id="`${id}-filter-checkbox`"
							v-model="includeFilter"
						/>
						<label :for="`${id}-filter-checkbox`" class="form-check-label">
							Include current filter (<code>{{mapContext.filter}}</code>)
						</label>
					</div>
				</div>
			</div>
		</template>

		<div class="row mb-3">
			<label :for="`${id}-make-default-input`" class="col-sm-3 col-form-label">Default view</label>
			<div class="col-sm-9">
				<div class="form-check fm-form-check-with-label">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-make-default-input`"
						v-model="makeDefault"
					/>
					<label :for="`${id}-make-default-input`" class="form-check-label">Make default view</label>
				</div>
			</div>
		</div>
	</ModalDialog>
</template>

<style lang="scss">
</style>