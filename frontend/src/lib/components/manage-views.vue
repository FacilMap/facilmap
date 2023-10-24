<script setup lang="ts">
	import WithRender from "./manage-views.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { Client, InjectClient, InjectContext, InjectMapComponents } from "../../utils/decorators";
	import { ID, View } from "facilmap-types";
	import { displayView } from "facilmap-leaflet";
	import { showErrorToast } from "../../utils/toasts";
	import { MapComponents } from "../leaflet-map/leaflet-map";
	import { Context } from "../facilmap/facilmap";

	@WithRender
	@Component({})
	export default class ManageViews extends Vue {

		const context = injectContextRequired();
		const client = injectClientRequired();
		const mapComponents = injectMapComponentsRequired();

		@Prop({ type: String, required: true }) id!: string;

		isSavingDefaultView: ID | null = null;
		isDeleting: Record<ID, boolean> = {};

		isBusy(): boolean {
			return this.isSavingDefaultView != null || Object.values(this.isDeleting).some((v) => v);
		}

		display(view: View): void {
			displayView(this.mapComponents.map, view, { overpassLayer: this.mapComponents.overpassLayer });
		};

		async makeDefault(view: View): Promise<void> {
			this.isSavingDefaultView = view.id;
			this.$bvToast.hide(`fm${this.context.id}-save-view-error-default`);

			try {
				await this.client.editPad({ defaultViewId: view.id });
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-save-view-error-default`, "Error setting default view", err);
			} finally {
				this.isSavingDefaultView = null;
			}
		};

		async deleteView(view: View): Promise<void> {
			this.$bvToast.hide(`fm${this.context.id}-save-view-error-${view.id}`);

			try {
				if (!await this.$bvModal.msgBoxConfirm(`Do you really want to delete the view “${view.name}”?`))
					return;

				Vue.set(this.isDeleting, view.id, true);

				await this.client.deleteView({ id: view.id });
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-save-view-error-${view.id}`, `Error deleting view “${view.name}”`, err);
			} finally {
				Vue.delete(this.isDeleting, view.id);
			}
		};
	}

</script>

<template>
	<b-modal :id="id" title="Manage Views" ok-only ok-title="Close" :busy="isBusy()" size="lg" dialog-class="fm-manage-views">
		<b-table-simple striped hover>
			<b-tbody>
				<b-tr v-for="view in client.views">
					<b-td :class="{ 'font-weight-bold': client.padData.defaultView && view.id == client.padData.defaultView.id }"><a href="javascript:" @click="display(view)">{{view.name}}</a></b-td>
					<b-td class="td-buttons text-right">
						<button
							type="button"
							class="btn btn-light"
							v-show="!client.padData.defaultView || view.id !== client.padData.defaultView.id"
							@click="makeDefault(view)"
							:disabled="!!isSavingDefaultView || isDeleting[view.id]"
						>
							<div v-if="isSavingDefaultView == view.id" class="spinner-border spinner-border-sm"></div>
							Make default
						</button>
						<button
							type="button"
							class="btn btn-light"
							@click="deleteView(view)"
							:disabled="isDeleting[view.id] || isSavingDefaultView == view.id"
						>
							<div v-if="isDeleting[view.id]" class="spinner-border spinner-border-sm"></div>
							Delete
						</button>
					</b-td>
				</b-tr>
			</b-tbody>
		</b-table-simple>
	</b-modal>
</template>