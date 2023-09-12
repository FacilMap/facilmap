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
	import FormModal from "../ui/form-modal/form-modal";
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

		@InjectContext() context!: Context;
		@InjectClient() client!: Client;

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
				showErrorToast(this, `fm${this.context.id}-edit-marker-error`, "Error saving marker", err);
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
		dialog-class="fm-edit-marker"
		:is-saving="isSaving"
		:is-modified="isModified"
		@submit="save"
		@show="initialize"
		@hidden="clear"
	>
		<template v-if="marker">
			<b-form-group label="Name" label-for="`${id}-name-input`" label-cols-sm="3">
				<b-form-input :id="`${id}-name-input`" v-model="marker.name"></b-form-input>
			</b-form-group>

			<ValidationProvider v-if="canControl.includes('colour')" name="Colour" v-slot="v" rules="required|colour">
				<b-form-group label="Colour" :label-for="`${id}-colour-input`" label-cols-sm="3" :state="v | validationState">
					<ColourField :id="`${id}-colour-input`" v-model="marker.colour" :state="v | validationState"></ColourField>
					<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
				</b-form-group>
			</ValidationProvider>

			<ValidationProvider v-if="canControl.includes('size')" name="Size" v-slot="v" rules="size">
				<b-form-group label="Size" :label-for="`${id}-size-input`" label-cols-sm="3">
					<SizeField :id="`${id}-size-input`" v-model="marker.size"></SizeField>
				</b-form-group>
			</ValidationProvider>

			<ValidationProvider v-if="canControl.includes('symbol')" name="Icon" v-slot="v" rules="symbol">
				<b-form-group label="Icon" :label-for="`${id}-symbol-input`" label-cols-sm="3" :state="v | validationState">
					<SymbolField :id="`${id}-symbol-input`" v-model="marker.symbol" :state="v | validationState"></SymbolField>
					<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
				</b-form-group>
			</ValidationProvider>

			<ValidationProvider v-if="canControl.includes('shape')" name="Shape" v-slot="v" rules="shape">
				<b-form-group label="Shape" :label-for="`${id}-shape-input`" label-cols-sm="3" :state="v | validationState">
					<ShapeField :id="`${id}-shape-input`" v-model="marker.shape" :state="v | validationState"></ShapeField>
					<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
				</b-form-group>
			</ValidationProvider>

			<b-form-group v-for="(field, idx in client.types[marker.typeId].fields" :label="field.name" :label-for="`fm-edit-marker-${idx}-input`" label-cols-sm="3">
				<FieldInput :id="`fm-edit-marker-${idx}-input`" :field="field" :value="marker.data.get(field.name)" @input="marker.data.set(field.name, $event)"></FieldInput>
			</b-form-group>
		</template>

		<template #footer-left>
			<b-dropdown dropup v-if="types.length > 1" text="Change type">
				<b-dropdown-item v-for="type in types" :active="type.id == marker.typeId" @click="marker.typeId = type.id">{{type.name}}</b-dropdown-item>
			</b-dropdown>
		</template>
	</FormModal>
</template>