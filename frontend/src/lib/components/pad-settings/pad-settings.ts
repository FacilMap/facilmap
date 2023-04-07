import { Component, Prop, Ref, Watch } from "vue-property-decorator";
import WithRender from "./pad-settings.vue";
import Vue from "vue";
import { extend, ValidationProvider } from "vee-validate";
import { PadData, PadDataCreate, PadDataUpdate } from "facilmap-types";
import { clone, generateRandomPadId } from "facilmap-utils";
import { Client, InjectClient, InjectContext } from "../../utils/decorators";
import { mergeObject } from "../../utils/utils";
import { isEqual } from "lodash-es";
import copyToClipboard from "copy-to-clipboard";
import FormModal from "../ui/form-modal/form-modal";
import { showErrorToast } from "../../utils/toasts";
import "./pad-settings.scss";
import { Context } from "../facilmap/facilmap";

extend("padId", {
	validate: (id: string) => !id.includes("/"),
	message: "May not contain a slash."
});

extend("padIdUnique", {
	validate: (id: string, args: any) => {
		const padData: PadData = args.padData;
		return !padData || [padData.id, padData.writeId, padData.adminId].filter((v) => v == id).length <= 1;
	},
	message: "The same link cannot be used for different access levels.",
	params: ["padData"]
})

@WithRender
@Component({
	components: { FormModal, ValidationProvider }
})
export default class PadSettings extends Vue {

	@InjectContext() context!: Context;
	@InjectClient() client!: Client;

	@Ref() padDataValidationProvider?: InstanceType<typeof ValidationProvider>;

	@Prop({ type: String, required: true }) readonly id!: string;
	@Prop({ type: String }) readonly proposedAdminId?: string;
	@Prop({ type: Boolean }) readonly noCancel?: boolean;
	@Prop({ type: Boolean }) readonly isCreate?: boolean;

	isSaving = false;
	isDeleting = false;
	deleteConfirmation = "";
	padData: PadDataCreate | PadDataUpdate = null as any;

	initialize(): void {
		if(this.isCreate) {
			this.padData = {
				name: "New FacilMap",
				searchEngines: false,
				description: "",
				clusterMarkers: false,
				adminId: (this.proposedAdminId || generateRandomPadId(16)),
				writeId: generateRandomPadId(14),
				id: generateRandomPadId(12),
				legend1: "",
				legend2: "",
				defaultViewId: null
			};
		} else {
			this.padData = clone(this.client.padData as PadDataUpdate);
		}
	}

	clear(): void {
		this.padData = null as any;
	}

	get isModified(): boolean {
		return !isEqual(this.padData, this.client.padData);
	}

	@Watch("client.padData", { deep: true })
	handlePadDataChange(newPadData: PadData, oldPadData: PadData): void {
		if (!this.isCreate && this.padData)
			mergeObject(oldPadData, newPadData, this.padData);
	}

	@Watch("padData", { deep: true })
	handleChange(padData: PadDataCreate | PadDataUpdate): void {
		this.padDataValidationProvider?.validate({ ...padData });
	}

	async save(): Promise<void> {
		this.isSaving = true;
		this.$bvToast.hide(`fm${this.context.id}-pad-settings-error`);

		try {
			if(this.isCreate)
				await this.client.createPad(this.padData as PadDataCreate);
			else
				await this.client.editPad(this.padData);

			this.$bvModal.hide(this.id);
		} catch (err) {
			showErrorToast(this, `fm${this.context.id}-pad-settings-error`, this.isCreate ? "Error creating map" : "Error saving map settings", err);
		} finally {
			this.isSaving = false;
		}
	};

	copy(text: string): void {
		copyToClipboard(text);
		this.$bvToast.toast("The map link was copied to the clipboard.", { variant: "success", title: "Map link copied" });
	}

	async deletePad(): Promise<void> {
		this.$bvToast.hide(`fm${this.context.id}-pad-settings-error`);

		if (!await this.$bvModal.msgBoxConfirm(`Are you sure you want to delete the map “${this.padData.name}”? Deleted maps cannot be restored!`))
				return;

		this.isDeleting = true;

		try {
			await this.client.deletePad();
			this.$bvModal.hide(this.id);
		} catch (err) {
			showErrorToast(this, `fm${this.context.id}-pad-settings-error`, "Error deleting map", err);
		} finally {
			this.isDeleting = false;
		}
	};
}
