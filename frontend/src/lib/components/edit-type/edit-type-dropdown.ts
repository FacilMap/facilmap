import WithRender from "./edit-type-dropdown.vue";
import Vue from "vue";
import { Component, Prop, Ref, Watch } from "vue-property-decorator";
import { Field, FieldOptionUpdate, FieldUpdate, Line, Marker, Type } from "facilmap-types";
import { clone } from "facilmap-utils";
import { canControl, mergeObject } from "../../utils/utils";
import { isEqual } from "lodash-es";
import { showErrorToast } from "../../utils/toasts";
import ColourField from "../ui/colour-field/colour-field";
import draggable from "vuedraggable";
import Icon from "../ui/icon/icon";
import FormModal from "../ui/form-modal/form-modal";
import ShapeField from "../ui/shape-field/shape-field";
import SizeField from "../ui/size-field/size-field";
import SymbolField from "../ui/symbol-field/symbol-field";
import WidthField from "../ui/width-field/width-field";
import { extend, ValidationProvider } from "vee-validate";
import "./edit-type-dropdown.scss";
import { Context } from "../facilmap/facilmap";
import { InjectContext } from "../../utils/decorators";

extend("uniqueFieldOptionValue", {
	validate: (value: string, args: any) => {
		const field: Field | undefined = args.field?.field;
		return !field || field.options!.filter((option) => option.value == value).length <= 1;
	},
	message: "Multiple options cannot have the same label.",
	params: ["field"],
	computesRequired: true // To check empty values as well
});

extend("fieldOptionNumber", {
	validate: ({ field, type }: { field: FieldUpdate, type: Type }, args: any) => {
		return getControlNumber(type, field) == 0 || (!!field.options && field.options.length > 0);
	},
	message: "Controlling fields need to have at least one option.",
	params: ["controlNumber"]
});

function getControlNumber(type: Type, field: FieldUpdate): number {
	return [
		field.controlColour,
		...(type.type == "marker" ? [
			field.controlSize,
			field.controlSymbol,
			field.controlShape
		] : []),
		...(type.type == "line" ? [
			field.controlWidth
		] : [])
	].filter((v) => v).length;
}

@WithRender
@Component({
	components: { ColourField, draggable, Icon, FormModal, ShapeField, SizeField, SymbolField, ValidationProvider, WidthField }
})
export default class EditTypeDropdown extends Vue {

	@InjectContext() context!: Context;

	@Prop({ type: String, required: true }) id!: string;
	@Prop({ type: Object, required: true }) type!: Type;
	@Prop({ type: Object, required: true }) field!: Field;

	@Ref() fieldValidationProvider?: InstanceType<typeof ValidationProvider>;

	fieldValue: FieldUpdate = null as any;

	initialize(): void {
		this.fieldValue = clone(this.initialField);
	}

	clear(): void {
		this.fieldValue = null as any;
	}

	get initialField(): FieldUpdate {
		const field: FieldUpdate = clone(this.field);

		if(field.type == 'checkbox') {
			if(!field.options || field.options.length != 2) {
				field.options = [
					{ value: '' },
					{ value: field.name }
				]
			}

			// Convert legacy format
			if(field.options[0].value == "0")
				field.options[0].value = "";
			if(field.options[1].value == "1")
				field.options[1].value = field.name;
		}

		for(let option of (field.options || []))
			option.oldValue = option.value;

		return field;
	}

	@Watch("field", { deep: true })
	handleFieldChange(newField: Field, oldField: Field): void {
		if (this.fieldValue) {
			if (newField == null) {
				this.$bvModal.hide(this.id);
				// TODO: Show message
			} else {
				mergeObject(oldField, newField, this.fieldValue);
			}
		}
	}

	@Watch("fieldValue", { deep: true })
	handleChange(field: FieldUpdate): void {
		this.fieldValidationProvider?.validate({ type: this.type, field });
	}

	get isModified(): boolean {
		return !isEqual(this.fieldValue, this.initialField);
	}

	get canControl(): Array<keyof Marker | keyof Line> {
		return canControl(this.type, this.field);
	}

	addOption(): void {
		if(this.fieldValue.options == null)
			Vue.set(this.fieldValue, "options", [ ]);

		this.fieldValue.options!.push({ value: "" });
	}

	async deleteOption(option: FieldOptionUpdate): Promise<void> {
		if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the option “${option.value}”?`))
			return;

		var idx = this.fieldValue.options!.indexOf(option);
		if(idx != -1)
			this.fieldValue.options!.splice(idx, 1);
	}

	save(): void {
		this.$bvToast.hide(`fm${this.context.id}-edit-type-dropdown-error`);

		const idx = this.type.fields.indexOf(this.field);
		if (idx === -1)
			showErrorToast(this, `fm${this.context.id}-edit-type-dropdown-error`, "Error updating field", new Error("The field cannot be found on the type anymore."));
		else {
			Vue.nextTick(() => {
				Vue.set(this.type.fields, idx, this.fieldValue);
			});
			this.$bvModal.hide(this.id);
		}
	}

	get controlNumber(): number {
		return getControlNumber(this.type, this.fieldValue);
	}

}
