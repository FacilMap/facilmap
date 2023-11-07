<script lang="ts">
	import { onBeforeUnmount, reactive, ref, toRaw, watch } from "vue";
	import Client from "facilmap-client";
	import type { PadData, PadId } from "facilmap-types";
	import PadSettingsDialog from "./pad-settings-dialog/pad-settings-dialog.vue";
	import storage from "../utils/storage";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import Toast from "./ui/toasts/toast.vue";
	import type { ClientContext } from "./facil-map-context-provider/client-context";
	import { injectContextRequired } from "./facil-map-context-provider/facil-map-context-provider.vue";

	class ReactiveClient extends Client {
		_makeReactive<O extends object>(obj: O) {
			return reactive(obj) as O;
		}
	};
</script>

<script setup lang="ts">
	const context = injectContextRequired();
	const toasts = useToasts();

	const client = ref<ClientContext>();
	const connectingClient = ref<ClientContext>();

	const props = defineProps<{
		padId: string | undefined;
		serverUrl: string;
	}>();

	const emit = defineEmits<{
		"update:padId": [padId: string | undefined];
	}>();

	const createId = ref<string>();
	const counter = ref(1);

	function openPad(padId: string | undefined): void {
		emit("update:padId", padId);
	}

	watch([
		() => props.padId,
		() => props.serverUrl
	], async () => {
		const existingClient = connectingClient.value || client.value;
		if (existingClient && existingClient.server == props.serverUrl && existingClient.padId == props.padId)
			return;

		toasts.hideToast(`fm${context.id}-client-connecting`);
		toasts.hideToast(`fm${context.id}-client-error`);
		toasts.hideToast(`fm${context.id}-client-deleted`);
		createId.value = undefined;
		if (props.padId)
			toasts.showToast(`fm${context.id}-client-connecting`, "Loading", "Loading map…", { spinner: true });
		else
			toasts.showToast(`fm${context.id}-client-connecting`, "Connecting", "Connecting to server…", { spinner: true });

		const newClient: ClientContext = Object.assign(new ReactiveClient(props.serverUrl, props.padId), {
			openPad
		});
		connectingClient.value = newClient;

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
		});

		newClient.on("deletePad", () => {
			toasts.showToast(`fm${context.id}-client-deleted`, "Map deleted", "This map has been deleted.", {
				variant: "danger",
				actions: context.settings.interactive ? [
					{
						label: "Close map",
						href: context.baseUrl,
						onClick: (e) => {
							if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
								e.preventDefault();
								openPad(undefined);
							}
						}
					}
				] : []
			});
		})

		await new Promise<void>((resolve) => {
			newClient.once(props.padId ? "padData" : "connect", () => { resolve(); });
			newClient.on("serverError", () => { resolve(); });
		});

		if (toRaw(connectingClient.value) !== newClient) {
			// Another client has been initiated in the meantime
			newClient.disconnect();
			return;
		}

		// Bootstrap-Vue uses animation frames to show the connecting toast. If the map is loading in a background tab, the toast might not be shown
		// yet when we are trying to hide it, so the hide operation is skipped and once the loading toast is shown, it stays forever.
		// We need to wait for two animation frames to make sure that the toast is shown.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				toasts.hideToast(`fm${context.id}-client-connecting`);
			});
		});

		if (newClient.serverError?.message?.includes("does not exist") && context.settings.interactive) {
			createId.value = newClient.padId!;
		} else if (newClient.serverError) {
			toasts.showErrorToast(`fm${context.id}-client-error`, "Error opening map", newClient.serverError, {
				noCloseButton: true,
				actions: context.settings.interactive ? [
					{
						label: "Close map",
						href: context.baseUrl,
						onClick: (e) => {
							if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
								e.preventDefault();
								newClient.openPad(undefined);
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
	}, { immediate: true });

	onBeforeUnmount(() => {
		client.value?.disconnect();
	});

	context.provideComponent("client", client);
</script>

<template>
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

	<PadSettingsDialog
		v-if="createId"
		is-create
		no-cancel
		:proposed-admin-id="createId"
	></PadSettingsDialog>
</template>