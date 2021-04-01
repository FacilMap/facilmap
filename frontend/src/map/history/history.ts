import WithRender from "./history.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Client, InjectClient } from "../../utils/decorators";
import { showErrorToast } from "../../utils/toasts";
import { getLabelsForHistoryEntry, HistoryEntryLabels } from "./history-utils";
import { HistoryEntry } from "facilmap-types";
import { orderBy } from "lodash";
import Icon from "../ui/icon/icon";
import "./history.scss";

type HistoryEntryWithLabels = HistoryEntry & {
	labels: HistoryEntryLabels;
};

@WithRender
@Component({
	components: { Icon }
})
export default class History extends Vue {

	@InjectClient() client!: Client;

	@Prop({ type: String, required: true }) id!: string;

	popover: { entry: HistoryEntryWithLabels; target: HTMLElement } | null = null;

	async handleShow(): Promise<void> {
		this.$bvToast.hide("fm-history-error");

		try {
			await this.client.listenToHistory();
		} catch (err) {
			showErrorToast(this, "fm-history-error", "Error loading history", err);
		}
	}

	async handleHidden(): Promise<void> {
		try {
			await this.client.stopListeningToHistory();
		} catch (err) {
			console.error("Error stopping listening to history", err);
		}
	}

	async revert(entry: HistoryEntryWithLabels): Promise<void> {
		this.$bvToast.hide("fm-history-error");

		if (!await this.$bvModal.msgBoxConfirm(entry.labels.confirm))
			return;
		
		try {
			this.client.revertHistoryEntry({ id: entry.id });
		} catch (err) {
			showErrorToast(this, "fm-history-error", "Error loading history", err);
		}
	}

	get history(): HistoryEntryWithLabels[] {
		return orderBy(
			Object.values(this.client.history).map((entry) => ({
				...entry,
				time: entry.time.replace(/\.\d+/, ""),
				labels: getLabelsForHistoryEntry(this.client, entry)
			})),
			["time"],
			["desc"]
		);
	}

	handleInfoClick(target: HTMLElement, entry: HistoryEntryWithLabels): void {
		this.popover = { target, entry };
	}

	handleInfoBlur(): void {
		this.popover = null;
	}

}