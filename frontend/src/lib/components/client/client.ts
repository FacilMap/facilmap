import { Component, ProvideReactive, Watch } from "vue-property-decorator";
import Vue from "vue";
import FmClient from "facilmap-client";
import "./client.scss";
import WithRender from "./client.vue";
import { PadData, PadId } from "facilmap-types";
import PadSettings from "../pad-settings/pad-settings";
import { Client, CLIENT_INJECT_KEY, InjectContext } from "../../utils/decorators";
import StringMap from "../../utils/string-map";
import storage from "../../utils/storage";
import { Context } from "../facilmap/facilmap";
import { showErrorToast, showToast } from "../../utils/toasts";

@WithRender
@Component({
	components: { PadSettings }
})
export class ClientProvider extends Vue {

	@InjectContext() readonly context!: Context;

	@ProvideReactive(CLIENT_INJECT_KEY) client: Client | null = null;

	counter = 1;
	newClient: Client | null = null;
	createId: string | null = null;

	created(): void {
		this.connect();
	}

	beforeDestroy(): void {
		this.client?.disconnect();
	}

	async connect(): Promise<void> {
		const existingClient = this.newClient || this.client;
		if (existingClient && existingClient.server == this.context.serverUrl && existingClient.padId == this.context.activePadId)
			return;

		this.$bvToast.hide(`fm${this.context.id}-client-connecting`);
		this.$bvToast.hide(`fm${this.context.id}-client-error`);
		this.$bvToast.hide(`fm${this.context.id}-client-deleted`);
		this.createId = null;
		if (this.context.activePadId)
			showToast(this, `fm${this.context.id}-client-connecting`, "Loading", "Loading map…", { spinner: true });
		else
			showToast(this, `fm${this.context.id}-client-connecting`, "Connecting", "Connecting to server…", { spinner: true });

		const client = new FmClient<StringMap>(this.context.serverUrl, this.context.activePadId);
		client._set = Vue.set;
		client._delete = Vue.delete;
		client._encodeData = (data) => data.toObject();
		client._decodeData = (data) => new StringMap(data);

		this.newClient = client;

		let lastPadId: PadId | undefined = undefined;
		let lastPadData: PadData | undefined = undefined;

		client.on("padData", () => {
			for (const bookmark of storage.bookmarks) {
				if (lastPadId && bookmark.id == lastPadId)
					bookmark.id = client.padId!;

				if (lastPadData && lastPadData.id == bookmark.padId)
					bookmark.padId = client.padData!.id;

				if (bookmark.padId == client.padData!.id)
					bookmark.name = client.padData!.name;
			}

			lastPadId = client.padId;
			lastPadData = client.padData;
			this.context.activePadId = client.padId;
			this.context.activePadName = client.padData?.name;
		});

		client.on("deletePad", () => {
			showToast(this, `fm${this.context.id}-client-deleted`, "Map deleted", "This map has been deleted.", {
				variant: "danger",
				actions: this.context.interactive ? [
					{
						label: "Close map",
						href: this.context.baseUrl,
						onClick: (e) => {
							if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
								e.preventDefault();
								this.context.activePadId = undefined;
							}
						}
					}
				] : []
			});
		})

		await new Promise<void>((resolve) => {
			client.once(this.context.activePadId ? "padData" : "connect", () => { resolve(); });
			client.on("serverError", () => { resolve(); });
		});

		if (this.newClient !== client) {
			// Another client has been initiated in the meantime
			client.disconnect();
			return;
		}

		// Bootstrap-Vue uses animation frames to show the connecting toast. If the map is loading in a background tab, the toast might not be shown
		// yet when we are trying to hide it, so the hide operation is skipped and once the loading toast is shown, it stays forever.
		// We need to wait for two animation frames to make sure that the toast is shown.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				this.$bvToast.hide(`fm${this.context.id}-client-connecting`);
			});
		});

		if (client.serverError?.message?.includes("does not exist") && this.context.interactive) {
			this.createId = client.padId!;
			client.padId = undefined;
			client.serverError = undefined;
			setTimeout(() => {
				this.$bvModal.show(`fm${this.context.id}-client-create-pad`);
			}, 0);
		} else if (client.serverError) {
			showErrorToast(this, `fm${this.context.id}-client-error`, "Error opening map", client.serverError, {
				noCloseButton: true,
				actions: this.context.interactive ? [
					{
						label: "Close map",
						href: this.context.baseUrl,
						onClick: (e) => {
							if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
								e.preventDefault();
								this.context.activePadId = undefined;
							}
						}
					}
				] : []
			});
		}

		this.counter++;
		this.newClient = null;
		this.client?.disconnect();
		this.client = client;
	}

	@Watch("context.activePadId")
	handlePadIdChange(): void {
		this.connect();
	}

	@Watch("context.serverUrl")
	handleServerUrlChange(): void {
		this.connect();
	}

}