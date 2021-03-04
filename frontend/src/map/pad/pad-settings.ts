import { Component, Prop, Watch } from "vue-property-decorator";
import WithRender from "./pad-settings.vue";
import Vue from "vue";
import { ValidationObserver, ValidationProvider } from "vee-validate";
import context from "../context";
import { PadData, PadDataCreate, PadDataUpdate } from "facilmap-types";
import { clone, generateRandomPadId } from "facilmap-utils";
import Client from "facilmap-client";
import { InjectClient } from "../client/client";
import { mergeObject } from "../../utils/utils";
import { isEqual } from "lodash";
import { getValidationState } from "../../utils/validation";
import copyToClipboard from "copy-to-clipboard";
import FormModal from "../ui/form-modal/form-modal";

@WithRender
@Component({
    components: { FormModal, ValidationObserver, ValidationProvider }
})
export default class PadSettings extends Vue {

	@InjectClient() client!: Client;

	@Prop({ type: String, required: true }) readonly id!: string;
	@Prop({ type: String }) readonly proposedAdminId?: string;
	@Prop({ type: Boolean }) readonly noCancel?: boolean;
	@Prop({ type: Boolean }) readonly isCreate?: boolean;

	isSaving = false;
	deleteConfirmation = "";
	padData: PadDataCreate | PadDataUpdate = null as any;

	handleShow(): void {
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

	get isModified(): boolean {
		return !isEqual(this.padData, this.client.padData);
	}

	get urlPrefix(): string {
		return context.urlPrefix;
	}

	@Watch("client.padData", { deep: true })
	handlePadDataChange(newPadData: PadData, oldPadData: PadData): void {
		if (!this.isCreate)
			mergeObject(oldPadData, newPadData, this.padData);
	}

	getValidationState = getValidationState;

	/*
	$scope.copyPadId = fmUtils.generateRandomPadId();
	$scope.copyPad = function() {
		socket.copyPad({ toId: $scope.copyPadId }, function(err) {
			if(err) {
				$scope.dialogError = err;
				return;
			}

			$scope.closeDialog();
			var url = $scope.urlPrefix + $scope.copyPadId;
			$scope.showMessage("success", "The pad has been copied to", [ { label: url, url: url } ]);
			$scope.copyPadId = fmUtils.generateRandomPadId();
		});
	};
	*/

	async save(): Promise<void> {
		this.isSaving = true;
		this.$bvToast.hide("fm-pad-settings-error");

		try {
			if(this.isCreate)
				await this.client.createPad(this.padData as PadDataCreate);
				// this.client.updateBbox(leafletToFmBbox(map.map.getBounds(), map.map.getZoom()));
			else
				await this.client.editPad(this.padData);

			this.$bvModal.hide(this.id);
		} catch (err) {
			console.error(err.stack || err);
			this.$bvToast.toast(err.message || err, {
				id: "fm-pad-settings-error",
				title: this.isCreate ? "Error creating map" : "Error saving map settings",
				variant: "danger",
				noAutoHide: true
			});
		} finally {
			this.isSaving = false;
		}
	};

	copy(text: string): void {
		copyToClipboard(text);
	}

	async deletePad(): Promise<void> {
		this.isSaving = true;
		this.$bvToast.hide("fm-pad-settings-error");

		try {
			await this.client.deletePad();
			this.$bvModal.hide(this.id);
		} catch (err) {
			console.error(err.stack || err);
			this.$bvToast.toast(err.message || err, {
				id: "fm-pad-settings-error",
				title: "Error deleting map",
				variant: "danger",
				noAutoHide: true
			});
		} finally {
			this.isSaving = false;
		}
	};
}
