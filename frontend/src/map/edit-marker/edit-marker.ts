import WithRender from "./edit-marker.vue";
import Vue from "vue";
import { ID, Marker } from "facilmap-types";
import Client from "facilmap-client";
import { InjectClient } from "../client/client";
import { Component, Prop, Watch } from "vue-property-decorator";
import { canControl, IdType, mergeObject } from "../../utils/utils";
import { clone } from "facilmap-utils";
import { isEqual } from "lodash";
import { showErrorToast } from "../../utils/toasts";
import FormModal from "../ui/form-modal/form-modal";
import { ValidationProvider } from "vee-validate";
import ColourField from "../ui/colour-field/colour-field";

@WithRender
@Component({
	components: { ColourField, FormModal, ValidationProvider }
})
export default class EditMarker extends Vue {

	@InjectClient() client!: Client;

	@Prop({ type: String, required: true }) id!: string;
	@Prop({ type: IdType, required: true }) markerId!: ID;

	marker: Marker = null as any;
	isSaving = false;

	initialize(): void {
		this.marker = clone(this.client.markers[this.markerId]);
	}

	get isModified(): boolean {
		return !isEqual(this.marker, this.client.markers[this.markerId]);
	}

	get originalMarker(): Marker | undefined {
		return this.client.markers[this.markerId];
	}

	@Watch("originalMarker", { deep: true })
	handleChangeMarker(newMarker: Marker | undefined, oldMarker: Marker): void {
		if (!newMarker) {
			this.$bvModal.hide(this.id);
			// TODO: Show message
		} else {
			mergeObject(oldMarker, newMarker, this.marker);
		}
	}

	canControl(what: keyof Marker): boolean {
		return canControl(this.client.types[this.marker.typeId], what);
	}

	async save(): Promise<void> {
		this.isSaving = true;
		this.$bvToast.hide("fm-edit-marker-error");

		try {
			await this.client.editMarker(this.marker);
			this.$bvModal.hide(this.id);
		} catch (err) {
			showErrorToast(this, "fm-edit-marker-error", "Error saving marker", err);
		} finally {
			this.isSaving = false;
		}
	}


}
