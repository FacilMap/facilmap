<script setup lang="ts">
	import WithRender from "./edit-line.vue";
	import Vue from "vue";
	import { ID, Line, Type } from "facilmap-types";
	import { Client, InjectClient, InjectContext } from "../../utils/decorators";
	import { Component, Prop, Watch } from "vue-property-decorator";
	import { canControl, IdType, mergeObject } from "../../utils/utils";
	import { clone } from "facilmap-utils";
	import { isEqual, omit } from "lodash-es";
	import { showErrorToast } from "../../utils/toasts";
	import FormModal from "../ui/form-modal/form-modal";
	import { ValidationProvider } from "vee-validate";
	import ColourField from "../ui/colour-field/colour-field";
	import SymbolField from "../ui/symbol-field/symbol-field";
	import ShapeField from "../ui/shape-field/shape-field";
	import FieldInput from "../ui/field-input/field-input";
	import RouteMode from "../ui/route-mode/route-mode";
	import WidthField from "../ui/width-field/width-field";
	import StringMap from "../../utils/string-map";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({
		components: { ColourField, FieldInput, FormModal, RouteMode, ShapeField, SymbolField, ValidationProvider, WidthField }
	})
	export default class EditLine extends Vue {

		@InjectContext() context!: Context;
		@InjectClient() client!: Client;

		@Prop({ type: String, required: true }) id!: string;
		@Prop({ type: IdType, required: true }) lineId!: ID;

		line: Line<StringMap> = null as any;
		isSaving = false;

		initialize(): void {
			this.line = clone(this.client.lines[this.lineId]);
		}

		clear(): void {
			this.line = null as any;
		}

		get isModified(): boolean {
			return !isEqual(this.line, this.client.lines[this.lineId]);
		}

		get originalLine(): Line<StringMap> | undefined {
			return this.client.lines[this.lineId];
		}

		get types(): Type[] {
			return Object.values(this.client.types).filter((type) => type.type === "line");
		}

		get canControl(): Array<keyof Line> {
			return canControl(this.client.types[this.line.typeId]);
		}

		@Watch("originalLine")
		handleChangeLine(newLine: Line<StringMap> | undefined, oldLine: Line<StringMap>): void {
			if (this.line) {
				if (!newLine) {
					this.$bvModal.hide(this.id);
					// TODO: Show message
				} else {
					mergeObject(oldLine, newLine, this.line);
				}
			}
		}

		async save(): Promise<void> {
			this.isSaving = true;
			this.$bvToast.hide(`fm${this.context.id}-edit-line-error`);

			try {
				await this.client.editLine(omit(this.line, "trackPoints"));
				this.$bvModal.hide(this.id);
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-edit-line-error`, "Error saving line", err);
			} finally {
				this.isSaving = false;
			}
		}


	}
</script>

<template>
	<FormModal
		:id="id"
		title="Edit Line"
		dialog-class="fm-edit-line"
		:is-saving="isSaving"
		:is-modified="isModified"
		@submit="save"
		@hidden="clear"
		@show="initialize"
	>
		<template v-if="line">
			<b-form-group label="Name" :label-for="`${id}-name-input`" label-cols-sm="3">
				<b-form-input :id="`${id}-name-input`" v-model="line.name"></b-form-input>
			</b-form-group>

			<b-form-group label="Routing mode" v-if="canControl.includes('mode') && line.mode != 'track'" label-cols-sm="3">
				<RouteMode v-model="line.mode"></RouteMode>
			</b-form-group>

			<ValidationProvider v-if="canControl.includes('colour')" name="Colour" v-slot="v" rules="required|colour">
				<b-form-group label="Colour" :label-for="`${id}-colour-input`" label-cols-sm="3" :state="v | validationState">
					<ColourField :id="`${id}-colour-input`" v-model="line.colour" :state="v | validationState"></ColourField>
					<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
				</b-form-group>
			</ValidationProvider>

			<ValidationProvider v-if="canControl.includes('width')" name="Width" v-slot="v" rules="width">
				<b-form-group label="Width" :label-for="`${id}-width-input`" label-cols-sm="3">
					<WidthField :id="`${id}-width-input`" v-model="line.width"></WidthField>
				</b-form-group>
			</ValidationProvider>

			<b-form-group v-for="(field, idx in client.types[line.typeId].fields" :label="field.name" :label-for="`fm-edit-line-${idx}-input`" label-cols-sm="3">
				<FieldInput :id="`${id}-${idx}-input`" :field="field" :value="line.data.get(field.name)" @input="line.data.set(field.name, $event)"></FieldInput>
			</b-form-group>
		</template>

		<template #footer-left>
			<b-dropdown dropup v-if="types.length > 1" text="Change type">
				<b-dropdown-item v-for="type in types" :active="type.id == line.typeId" @click="line.typeId = type.id">{{type.name}}</b-dropdown-item>
			</b-dropdown>
		</template>
	</FormModal>
</template>