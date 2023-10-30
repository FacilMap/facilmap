<script setup lang="ts">
	import WithRender from "./edit-marker.vue";
	import Vue from "vue";
	import { ID, Marker, Type } from "facilmap-types";
	import { Client, InjectClient, InjectContext } from "../../utils/decorators";
	import { Component, Prop, Watch } from "vue-property-decorator";
	import { canControl, IdType, mergeObject } from "../../utils/utils";
	import { clone } from "facilmap-utils";
	import { isEqual } from "lodash-es";
	import { showErrorToast } from "../../utils/toasts";
	import FormModal from "../ui/modal/modal";
	import { ValidationProvider } from "vee-validate";
	import ColourField from "../ui/colour-field/colour-field";
	import SymbolField from "../ui/symbol-field/symbol-field";
	import ShapeField from "../ui/shape-field/shape-field";
	import FieldInput from "../ui/field-input/field-input";
	import SizeField from "../ui/size-field/size-field";
	import StringMap from "../../utils/string-map";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({
		components: { ColourField, FieldInput, FormModal, ShapeField, SizeField, SymbolField, ValidationProvider }
	})
	export default class EditMarker extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();

		@Prop({ type: String, required: true }) id!: string;
		@Prop({ type: IdType, required: true }) markerId!: ID;

		marker: Marker<StringMap> = null as any;
		isSaving = false;

		initialize(): void {
			this.marker = clone(this.client.markers[this.markerId]);
		}

		clear(): void {
			this.marker = null as any;
		}

		get isModified(): boolean {
			return !isEqual(this.marker, this.client.markers[this.markerId]);
		}

		get originalMarker(): Marker<StringMap> | undefined {
			return this.client.markers[this.markerId];
		}

		get types(): Type[] {
			return Object.values(this.client.types).filter((type) => type.type === "marker");
		}

		get canControl(): Array<keyof Marker> {
			return canControl(this.client.types[this.marker.typeId]);
		}

		@Watch("originalMarker")
		handleChangeMarker(newMarker: Marker<StringMap> | undefined, oldMarker: Marker<StringMap>): void {
			if (this.marker) {
				if (!newMarker) {
					this.$bvModal.hide(this.id);
					// TODO: Show message
				} else {
					mergeObject(oldMarker, newMarker, this.marker);
				}
			}
		}

		async save(): Promise<void> {
			this.isSaving = true;
			this.$bvToast.hide(`fm${this.context.id}-edit-marker-error`);

			try {
				await this.client.editMarker(this.marker);
				this.$bvModal.hide(this.id);
			} catch (err) {
				toasts.showErrorToast(this, `fm${this.context.id}-edit-marker-error`, "Error saving marker", err);
			} finally {
				this.isSaving = false;
			}
		}


	}
</script>

<template>
	<FormModal
		:id="id"
		title="Edit Marker"
		class="fm-edit-marker"
		:is-saving="isSaving"
		:is-modified="isModified"
		@submit="$event.waitUntil(save)"
		@show="initialize"
		@hidden="clear"
	>
		<template v-if="marker">
			<div class="row mb-3">
				<label :for="`${id}-name-input`" class="col-sm-3 col-form-label">Name</label>
				<div class="col-sm-9">
					<input class="form-control" :id="`${id}-name-input`" v-model="marker.name" />
				</div>
			</div>

			<ValidationProvider v-if="canControl.includes('colour')" name="Colour" v-slot="v" rules="required|colour">
				<div class="row mb-3">
					<label :for="`${id}-colour-input`" class="col-sm-3 col-form-label">Colour</label>
					<div class="col-sm-9">
						<ColourField :id="`${id}-colour-input`" v-model="marker.colour" :state="v | validationState"></ColourField>
						<div class="invalid-feedback" v-if="v.errors[0]"><span v-html="v.errors[0]"></span></div>
					</div>
				</div>
			</ValidationProvider>

			<ValidationProvider v-if="canControl.includes('size')" name="Size" v-slot="v" rules="size">
				<div class="row mb-3">
					<label :for="`${id}-size-input`" class="col-sm-3 col-form-label">Size</label>
					<div class="col-sm-9">
						<SizeField :id="`${id}-size-input`" v-model="marker.size"></SizeField>
					</div>
				</div>
			</ValidationProvider>

			<ValidationProvider v-if="canControl.includes('symbol')" name="Icon" v-slot="v" rules="symbol">
				<div class="row mb-3">
					<label :for="`${id}-symbol-input`" class="col-sm-3 col-form-label">Icon</label>
					<div class="col-sm-9">
						<SymbolField :id="`${id}-symbol-input`" v-model="marker.symbol" :state="v | validationState"></SymbolField>
						<div class="invalid-feedback" v-if="v.errors[0]"><span v-html="v.errors[0]"></span></div>
					</div>
				</div>
			</ValidationProvider>

			<ValidationProvider v-if="canControl.includes('shape')" name="Shape" v-slot="v" rules="shape">
				<div class="row mb-3">
					<label :for="`${id}-shape-input`" class="col-sm-3 col-form-label">Shape</label>
					<div class="col-sm-9">
						<ShapeField :id="`${id}-shape-input`" v-model="marker.shape" :state="v | validationState"></ShapeField>
						<div class="invalid-feedback" v-if="v.errors[0]"><span v-html="v.errors[0]"></span></div>
					</div>
				</div>
			</ValidationProvider>

			<template v-for="(field, idx) in client.types[marker.typeId].fields">
				<div class="row mb-3" :key="field.name">
					<label :for="`${id}-${idx}-input`" class="col-sm-3 col-form-label">{{field.name}}</label>
					<div class="col-sm-9">
						<FieldInput :id="`fm-edit-marker-${idx}-input`" :field="field" :value="marker.data.get(field.name)" @input="marker.data.set(field.name, $event)"></FieldInput>
					</div>
				</div>
			</template>
		</template>

		<template #footer-left>
			<div v-if="types.length > 1" class="dropup">
				<button type="button" class="btn btn-light dropdown-toggle">Change type</button>
				<ul class="dropdown-menu">
					<template v-for="type in types">
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
	</FormModal>
</template>