<script setup lang="ts">
	import Vue, { onMounted, ref, watch } from "vue";
	import FmClient from "facilmap-client";
	import "./client.scss";
	import { PadData, PadId } from "facilmap-types";
	import PadSettings from "./pad-settings/pad-settings.vue";
	import storage from "../utils/storage";
	import { hideToast, showErrorToast, showToast } from "./ui/toasts/toasts.vue";
	import { Client, provideClient } from "../utils/client";
	import { injectContextRequired } from "../utils/context";
	import { onBeforeUnmount } from "vue";

	const context = injectContextRequired();

	const client = ref<Client>();
	const connectingClient = ref<Client>();
	provideClient(client);

	const createId = ref<string>();
	const counter = ref(1);

	async function connect(): Promise<void> {
		const existingClient = connectingClient.value || client.value;
		if (existingClient && existingClient.server == context.serverUrl && existingClient.padId == context.activePadId)
			return;

		hideToast(`fm${context.id}-client-connecting`);
		hideToast(`fm${context.id}-client-error`);
		hideToast(`fm${context.id}-client-deleted`);
		createId.value = undefined;
		if (context.activePadId)
			showToast(`fm${context.id}-client-connecting`, "Loading", "Loading map…", { spinner: true });
		else
			showToast(`fm${context.id}-client-connecting`, "Connecting", "Connecting to server…", { spinner: true });

		const newClient = new FmClient(context.serverUrl, context.activePadId);
		connectingClient.value = newClient;
		newClient.connect();

		let lastPadId: PadId | undefined = undefined;
		let lastPadData: PadData | undefined = undefined;

		newClient.on("padData", () => {
			for (const bookmark of storage.bookmarks) {
				if (lastPadId && bookmark.id == lastPadId)
					bookmark.id = newClient.padId!;

				if (lastPadData && lastPadData.id == bookmark.padId)
					bookmark.padId = newClient.padData!.id;

				if (bookmark.padId == newClient.padData!.id)
					bookmark.name = newClient.padData!.name;
			}

			lastPadId = newClient.padId;
			lastPadData = newClient.padData;
			context.activePadId = newClient.padId;
			context.activePadName = newClient.padData?.name;
		});

		newClient.on("deletePad", () => {
			showToast(`fm${context.id}-client-deleted`, "Map deleted", "This map has been deleted.", {
				variant: "danger",
				actions: context.interactive ? [
					{
						label: "Close map",
						href: context.baseUrl,
						onClick: (e) => {
							if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
								e.preventDefault();
								context.activePadId = undefined;
							}
						}
					}
				] : []
			});
		})

		await new Promise<void>((resolve) => {
			newClient.once(context.activePadId ? "padData" : "connect", () => { resolve(); });
			newClient.on("serverError", () => { resolve(); });
		});

		if (connectingClient.value !== newClient) {
			// Another client has been initiated in the meantime
			newClient.disconnect();
			return;
		}

		// Bootstrap-Vue uses animation frames to show the connecting toast. If the map is loading in a background tab, the toast might not be shown
		// yet when we are trying to hide it, so the hide operation is skipped and once the loading toast is shown, it stays forever.
		// We need to wait for two animation frames to make sure that the toast is shown.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				hideToast(`fm${context.id}-client-connecting`);
			});
		});

		if (newClient.serverError?.message?.includes("does not exist") && context.interactive) {
			createId.value = newClient.padId!;
			newClient.padId = undefined;
			newClient.serverError = undefined;
			setTimeout(() => {
				this.$bvModal.show(`fm${context.id}-client-create-pad`);
			}, 0);
		} else if (newClient.serverError) {
			showErrorToast(`fm${context.id}-client-error`, "Error opening map", newClient.serverError, {
				noCloseButton: true,
				actions: context.interactive ? [
					{
						label: "Close map",
						href: context.baseUrl,
						onClick: (e) => {
							if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
								e.preventDefault();
								context.activePadId = undefined;
							}
						}
					}
				] : []
			});
		}

		counter.value++;
		connectingClient.value = undefined;
		client.value?.disconnect();
		client.value = newClient;
	}

	onMounted(() => {
		connect();
	});

	onBeforeUnmount(() => {
		client.value?.disconnect();
	});

	watch([
		() => context.activePadId,
		() => context.serverUrl
	], () => {
		connect();
	});
</script>

<template>
	<div class="fm-client-provider" :key="counter">
		<slot v-if="client"/>

		<Toast
			v-if="client && client.disconnected"
			:id="`fm${context.id}-client-disconnected`"
			variant="danger"
			title="Disconnected"
			message="The connection to the server was lost. Trying to reconnect…"
			no-auto-hide
			no-close-button visible
			spinner
		/>

		<PadSettings v-if="createId" :id="`fm${context.id}-client-create-pad`" is-create no-cancel :proposed-admin-id="createId"></PadSettings>
	</div>
</template>

<style lang="scss">
	.fm-client-provider {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}
</style>