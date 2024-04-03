<script lang="ts">
	import { onBeforeUnmount, reactive, ref, toRaw, watch } from "vue";
	import Client from "facilmap-client";
	import { PadNotFoundError, type PadData, type PadId } from "facilmap-types";
	import PadSettingsDialog from "./pad-settings-dialog/pad-settings-dialog.vue";
	import storage from "../utils/storage";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import Toast from "./ui/toasts/toast.vue";
	import type { ClientContext } from "./facil-map-context-provider/client-context";
	import { injectContextRequired } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../utils/i18n";

	function isPadNotFoundError(serverError: Client["serverError"]): boolean {
		return !!serverError && serverError instanceof PadNotFoundError;
	}
</script>

<script setup lang="ts">
	const context = injectContextRequired();
	const toasts = useToasts();
	const i18n = useI18n();

	const client = ref<ClientContext>();
	const connectingClient = ref<ClientContext>();

	const props = defineProps<{
		padId: string | undefined;
		serverUrl: string;
	}>();

	const emit = defineEmits<{
		"update:padId": [padId: string | undefined];
	}>();

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
		if (props.padId)
			toasts.showToast(`fm${context.id}-client-connecting`, i18n.t("client-provider.loading-map-header"), i18n.t("client-provider.loading-map"), { spinner: true, noCloseButton: true });
		else
			toasts.showToast(`fm${context.id}-client-connecting`, i18n.t("client-provider.connecting-header"), i18n.t("client-provider.connecting"), { spinner: true, noCloseButton: true });

		class CustomClient extends Client implements ClientContext {
			_makeReactive<O extends object>(obj: O) {
				return reactive(obj) as O;
			}

			openPad(padId: string | undefined) {
				openPad(padId);
			}

			get isCreatePad() {
				return context.settings.interactive && isPadNotFoundError(super.serverError);
			}
		}

		const newClient = new CustomClient(props.serverUrl, props.padId);
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
			toasts.showToast(`fm${context.id}-client-deleted`, i18n.t("client-provider.map-deleted-header"), i18n.t("client-provider.map-deleted"), {
				noCloseButton: true,
				variant: "danger",
				actions: context.settings.interactive ? [
					{
						label: i18n.t("client-provider.close-map"),
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

		if (newClient.serverError && !newClient.isCreatePad) {
			if (newClient.disconnected || !props.padId) {
				toasts.showErrorToast(`fm${context.id}-client-error`, i18n.t("client-provider.connection-error"), newClient.serverError, {
					noCloseButton: !!props.padId
				});
			} else {
				toasts.showErrorToast(`fm${context.id}-client-error`, i18n.t("client-provider.open-map-error"), newClient.serverError, {
					noCloseButton: true,
					actions: context.settings.interactive ? [
						{
							label: i18n.t("client-provider.close-map"),
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
		}

		connectingClient.value = undefined;
		client.value?.disconnect();
		client.value = newClient;
	}, { immediate: true });

	onBeforeUnmount(() => {
		client.value?.disconnect();
	});

	context.provideComponent("client", client);

	function handleCreateDialogHide() {
		if (client.value?.isCreatePad) {
			client.value.openPad(undefined);
		}
	}
</script>

<template>
	<Toast
		v-if="client && client.disconnected && !client.serverError"
		:id="`fm${context.id}-client-disconnected`"
		variant="danger"
		:title="i18n.t('client-provider.disconnected-header')"
		:message="i18n.t('client-provider.disconnected')"
		auto-hide
		no-close-button visible
		spinner
	/>

	<PadSettingsDialog
		v-if="client?.isCreatePad"
		isCreate
		:proposedAdminId="client.padId"
		@hide="handleCreateDialogHide"
	></PadSettingsDialog>
</template>