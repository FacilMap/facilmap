import WithRender from "./edit-type.vue";
import Vue from "vue";
import { Component, Prop, Ref, Watch } from "vue-property-decorator";
import { Client, InjectClient, InjectContext } from "../../utils/decorators";
import { Field, ID, Line, Marker, Type, TypeUpdate } from "facilmap-types";
import { clone } from "facilmap-utils";
import { canControl, IdType } from "../../utils/utils";
import { mergeTypeObject } from "./edit-type-utils";
import { isEqual } from "lodash-es";
import { showErrorToast } from "../../utils/toasts";
import FormModal from "../ui/form-modal/form-modal";
import { extend, ValidationProvider } from "vee-validate";
import ColourField from "../ui/colour-field/colour-field";
import ShapeField from "../ui/shape-field/shape-field";
import SymbolField from "../ui/symbol-field/symbol-field";
import RouteMode from "../ui/route-mode/route-mode";
import draggable from "vuedraggable";
import FieldInput from "../ui/field-input/field-input";
import Icon from "../ui/icon/icon";
import WidthField from "../ui/width-field/width-field";
import SizeField from "../ui/size-field/size-field";
import EditTypeDropdown from "./edit-type-dropdown";
import { Context } from "../facilmap/facilmap";

extend("uniqueFieldName", {
	validate: (value: string, args: any) => {
		const type: Type | undefined = args.type;
		return !type || type.fields.filter((field) => field.name == value).length <= 1;
	},
	message: "Multiple fields cannot have the same name.",
	params: ["type"]
});

@WithRender
@Component({
	components: { ColourField, draggable, EditTypeDropdown, FieldInput, FormModal, Icon, RouteMode, ShapeField, SizeField, SymbolField, ValidationProvider, WidthField }
})
export default class EditType extends Vue {

	@InjectContext() context!: Context;
	@InjectClient() client!: Client;

	@Ref() typeValidationProvider?: InstanceType<typeof ValidationProvider>;

	@Prop({ type: String, required: true }) id!: string;
	@Prop({ type: IdType }) typeId?: ID;

	type: Type & TypeUpdate = null as any;
	isSaving = false;
	editField: Field | null = null;

	setTimeout(func: () => void): void {
		setTimeout(func, 0);
	}

	initialize(): void {
		this.type = clone(this.initialType);
	}

	clear(): void {
		this.type = null as any;
	}

	get initialType(): Type & TypeUpdate {
		const type = this.isCreate ? { fields: [] } as any : clone(this.originalType)!;

		for(const field of type.fields) {
			field.oldName = field.name;
		}

		return type;
	}

	get isModified(): boolean {
		return !isEqual(this.type, this.initialType);
	}

	get isCreate(): boolean {
		return this.typeId == null;
	}

	get originalType(): Type | undefined {
		return this.typeId != null ? this.client.types[this.typeId] : undefined;
	}

	get canControl(): Array<keyof Marker | keyof Line> {
		return canControl(this.type, null);
	}

	@Watch("originalType")
	handleChangeType(newType: Type | undefined, oldType: Type): void {
		if (this.type) {
			if (!newType) {
				this.$bvModal.hide(this.id);
				// TODO: Show message
			} else {
				mergeTypeObject(oldType, newType, this.type);
			}
		}
	}

	@Watch("type", { deep: true })
	handleChange(type: TypeUpdate): void {
		this.typeValidationProvider?.validate({ ...type });
	}

	createField(): void {
		this.type.fields.push({ name: "", type: "input", "default": "" });
	}

	async deleteField(field: Field): Promise<void> {
		if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the field “${field.name}”?`))
			return;

		var idx = this.type.fields.indexOf(field);
		if(idx != -1)
			this.type.fields.splice(idx, 1);
	}

	async save(): Promise<void> {
		this.$bvToast.hide(`fm${this.context.id}-edit-type-error`);
		this.isSaving = true;

		for (const prop of [ "defaultWidth", "defaultSize", "defaultColour" ] as Array<"defaultWidth" | "defaultSize" | "defaultColour">) {
			if(this.type[prop] == "")
				this.type[prop] = null;
		}

		try {
			if (this.isCreate)
				await this.client.addType(this.type);
			else
				await this.client.editType(this.type);

			this.$bvModal.hide(this.id);
		} catch (err) {
			showErrorToast(this, `fm${this.context.id}-edit-type-error`, this.isCreate ? "Error creating type" : "Error saving type", err);
		} finally {
			this.isSaving = false;
		}
	}

	editDropdown(field: Field): void {
		this.editField = field;
		setTimeout(() => { this.$bvModal.show(`${this.id}-dropdown`); }, 0);
	}

}
