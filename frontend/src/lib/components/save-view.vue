<script setup lang="ts">
	import WithRender from "./save-view.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { getCurrentView, getLayers } from "facilmap-leaflet";
	import FormModal from "../ui/modal/modal";
	import { ValidationProvider } from "vee-validate";
	import { showErrorToast } from "../../utils/toasts";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({
		components: { FormModal, ValidationProvider }
	})
	export default class SaveView extends Vue {

		const context = injectContextRequired();
		const mapComponents = injectMapComponentsRequired();
		const mapContext = injectMapContextRequired();
		const client = injectClientRequired();

		@Prop({ type: String, required: true }) id!: string;

		isSaving = false;

		name = "";
		includeOverpass = false;
		includeFilter = false;
		makeDefault = false;

		initialize(): void {
			this.name = "";
			this.includeOverpass = false;
			this.includeFilter = false;
			this.makeDefault = false;
		}

		get baseLayer(): string {
			const { baseLayers } = getLayers(this.mapComponents.map);
			return baseLayers[this.mapContext.layers.baseLayer].options.fmName || this.mapContext.layers.baseLayer;
		}

		get overlays(): string {
			const { overlays } = getLayers(this.mapComponents.map);
			return this.mapContext.layers.overlays.map((key) => overlays[key].options.fmName || key).join(", ") || "—";
		}

		async save(): Promise<void> {
			this.isSaving = true;
			this.$bvToast.hide(`fm${this.context.id}-save-view-error`);

			try {
				const view = await this.client.addView({
					...getCurrentView(this.mapComponents.map, {
						includeFilter: this.includeFilter,
						overpassLayer: this.includeOverpass ? this.mapComponents.overpassLayer : undefined
					}),
					name: this.name
				});

				if (this.makeDefault) {
					await this.client.editPad({ defaultViewId: view.id });
				}

				this.$bvModal.hide(this.id);
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-save-view-error`, "Error saving view", err);
			} finally {
				this.isSaving = false;
			}
		};
	}
</script>

<template>
	<FormModal
		:id="id"
		title="Save current view"
		dialog-class="fm-save-view"
		:is-saving="isSaving"
		:is-create="true"
		@submit="save"
		@show="initialize"
	>
		<ValidationProvider name="Editable link" v-slot="v" rules="required">
			<b-form-group label="Name" :label-for="`${id}-name-input`" label-cols-sm="3" :state="v | validationState">
				<input class="form-control" :id="`${id}-name-input`" v-model="name" :state="v | validationState" autofocus />
				<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
			</b-form-group>
		</ValidationProvider>

		<b-form-group label="Top left" :label-for="`${id}-topleft-input`" label-cols-sm="3">
			<input class="form-control" :id="`${id}-topleft-input`" :value="`${$options.filters.round(mapContext.bounds.getNorth(), 5)}, ${$options.filters.round(mapContext.bounds.getWest(), 5)}`" plaintext />
		</b-form-group>

		<b-form-group label="Bottom right" :label-for="`${id}-bottomright-input`" label-cols-sm="3">
			<input class="form-control" :id="`${id}-bottomright-input`" :value="`${$options.filters.round(mapContext.bounds.getSouth(), 5)}, ${$options.filters.round(mapContext.bounds.getEast(), 5)}`" plaintext />
		</b-form-group>

		<b-form-group label="Base layer" :label-for="`${id}-base-layer-input`" label-cols-sm="3">
			<input class="form-control" :id="`${id}-base-layer-input`" :value="baseLayer" plaintext />
		</b-form-group>

		<b-form-group label="Overlays" :label-for="`${id}-overlays-input`" label-cols-sm="3">
			<input class="form-control" :id="`${id}-overlays-input`" :value="overlays" plaintext />
		</b-form-group>

		<b-form-group
			v-if="mapContext.overpassIsCustom ? !mapContext.overpassCustom : mapContext.overpassPresets.length == 0"
			label="POIs"
			:label-for="`${id}-overpass-input`"
			label-cols-sm="3"
		>
			<input class="form-control" :id="`${id}-overpass-input`" value="—" plaintext />
		</b-form-group>

		<b-form-group v-else label="POIs" :label-for="`${id}-overpass-input`" label-cols-sm="3" label-class="pt-0">
			<b-form-checkbox :id="`${id}-overpass-input`" v-model="includeOverpass">
				Include POIs (<code v-if="mapContext.overpassIsCustom">{{mapContext.overpassCustom}}</code><template v-else>{{mapContext.overpassPresets.map((p) => p.label).join(', ')}}</template>)
			</b-form-checkbox>
		</b-form-group>

		<b-form-group v-if="!mapContext.filter" label="Filter" :label-for="`${id}-filter-input`" label-cols-sm="3">
			<input class="form-control" :id="`${id}-filter-input`" value="—" plaintext />
		</b-form-group>

		<b-form-group v-else label="Filter" :label-for="`${id}-filter-checkbox`" label-cols-sm="3" label-class="pt-0">
			<b-form-checkbox :id="`${id}-filter-checkbox`" v-model="includeFilter">
				Include current filter (<code>{{mapContext.filter}}</code>)
			</b-form-checkbox>
		</b-form-group>

		<b-form-group label="Default view" :label-for="`${id}-make-default-input`" label-cols-sm="3" label-class="pt-0">
			<b-form-checkbox :id="`${id}-make-default-input`" v-model="makeDefault">Make default view</b-form-checkbox>
		</b-form-group>
	</FormModal>
</template>

<style lang="scss">
</style>