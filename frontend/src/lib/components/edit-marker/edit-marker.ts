import WithRender from "./edit-marker.vue";
import Vue from "vue";
import { ID, Marker, Type } from "facilmap-types";
import { Client, InjectClient, InjectContext } from "../../utils/decorators";
import { Component, Prop, Watch } from "vue-property-decorator";
import { canControl, IdType, mergeObject } from "../../utils/utils";
import { clone } from "facilmap-utils";
import { isEqual } from "lodash";
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
