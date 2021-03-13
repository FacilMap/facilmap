import WithRender from "./edit-line.vue";
import Vue from "vue";
import { ID, Line, Type } from "facilmap-types";
import Client from "facilmap-client";
import { InjectClient } from "../../utils/decorators";
import { Component, Prop, Watch } from "vue-property-decorator";
import { canControl, IdType, mergeObject } from "../../utils/utils";
import { clone } from "facilmap-utils";
import { isEqual, omit } from "lodash";
import { showErrorToast } from "../../utils/toasts";
import FormModal from "../ui/form-modal/form-modal";
import { ValidationProvider } from "vee-validate";
import ColourField from "../ui/colour-field/colour-field";
import SymbolField from "../ui/symbol-field/symbol-field";
import ShapeField from "../ui/shape-field/shape-field";
import FieldInput from "../ui/field-input/field-input";
import RouteMode from "../ui/route-mode/route-mode";
import WidthField from "../ui/width-field/width-field";

@WithRender
@Component({
	components: { ColourField, FieldInput, FormModal, RouteMode, ShapeField, SymbolField, ValidationProvider, WidthField }
})
export default class EditLine extends Vue {

	@InjectClient() client!: Client;

	@Prop({ type: String, required: true }) id!: string;
	@Prop({ type: IdType, required: true }) lineId!: ID;

	line: Line = null as any;
	isSaving = false;

	initialize(): void {
		this.line = clone(this.client.lines[this.lineId]);
	}

	get isModified(): boolean {
		return !isEqual(this.line, this.client.lines[this.lineId]);
	}

	get originalLine(): Line | undefined {
		return this.client.lines[this.lineId];
	}

	get types(): Type[] {
		return Object.values(this.client.types).filter((type) => type.type === "line");
	}

	@Watch("originalLine", { deep: true })
	handleChangeLine(newLine: Line | undefined, oldLine: Line): void {
		if (this.line) {
			if (!newLine) {
				this.$bvModal.hide(this.id);
				// TODO: Show message
			} else {
				mergeObject(oldLine, newLine, this.line);
			}
		}
	}

	canControl(what: keyof Line): boolean {
		return canControl(this.client.types[this.line.typeId], what);
	}

	async save(): Promise<void> {
		this.isSaving = true;
		this.$bvToast.hide("fm-edit-line-error");

		try {
			await this.client.editLine(omit(this.line, "trackPoints"));
			this.$bvModal.hide(this.id);
		} catch (err) {
			showErrorToast(this, "fm-edit-line-error", "Error saving line", err);
		} finally {
			this.isSaving = false;
		}
	}


}
