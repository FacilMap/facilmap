<script lang="ts">
	import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from "vue";
	import Client from "facilmap-client";
	import { PadNotFoundError, type PadData, type PadId } from "facilmap-types";
	import PadSettingsDialog from "./pad-settings-dialog/pad-settings-dialog.vue";
	import storage from "../utils/storage";
	import { type ToastAction } from "./ui/toasts/toasts.vue";
	import Toast from "./ui/toasts/toast.vue";
	import type { ClientContext } from "./facil-map-context-provider/client-context";
	import { injectContextRequired } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { isLanguageExplicit, isUnitsExplicit, useI18n } from "../utils/i18n";
	import { getCurrentLanguage, getCurrentUnits } from "facilmap-utils";

	function isPadNotFoundError(serverError: Client["serverError"]): boolean {
		return !!serverError && serverError instanceof PadNotFoundError;
	}
</script>

<script setup lang="ts">
	const context = injectContextRequired();
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

		const newClient = new CustomClient(props.serverUrl, props.padId, {
			query: {
				...isLanguageExplicit() ? { lang: getCurrentLanguage() } : {},
				...isUnitsExplicit() ? { units: getCurrentUnits() } : {}
			}
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

		await new Promise<void>((resolve) => {
			newClient.once(props.padId ? "padData" : "connect", () => { resolve(); });
			newClient.on("serverError", () => { resolve(); });
		});

		if (toRaw(connectingClient.value) !== newClient) {
			// Another client has been initiated in the meantime
			newClient.disconnect();
			return;
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

	const closeMapAction = computed<ToastAction>(() => ({
		label: i18n.t("client-provider.close-map"),
		href: context.baseUrl,
		onClick: (e) => {
			if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				openPad(undefined);
			}
		}
	}));
</script>

<template>
	<template v-if="connectingClient">
		<Toast
			:id="`fm${context.id}-client-connecting`"
			:title="props.padId ? i18n.t('client-provider.loading-map-header') : i18n.t('client-provider.connecting-header')"
			:message="props.padId ? i18n.t('client-provider.loading-map') : i18n.t('client-provider.connecting')"
			spinner
			noCloseButton
		/>
	</template>
	<template v-else-if="client">
		<template v-if="client.serverError && !client.isCreatePad">
			<template v-if="client.disconnected || !props.padId">
				<Toast
					:id="`fm${context.id}-client-error`"
					:title="i18n.t('client-provider.connection-error')"
					:message="client.serverError"
					:noCloseButton="!!props.padId"
				/>
			</template>
			<template v-else>
				<Toast
					:id="`fm${context.id}-client-error`"
					:title="i18n.t('client-provider.open-map-error')"
					:message="client.serverError"
					noCloseButton
					:actions="context.settings.interactive ? [closeMapAction] : []"
				/>
			</template>
		</template>
		<template v-else-if="client.disconnected">
			<Toast
				:id="`fm${context.id}-client-disconnected`"
				variant="danger"
				:title="i18n.t('client-provider.disconnected-header')"
				:message="i18n.t('client-provider.disconnected')"
				no-close-button visible
				spinner
			/>
		</template>
		<template v-else-if="client.deleted">
			<Toast
				:id="`fm${context.id}-client-deleted`"
				variant="danger"
				:title="i18n.t('client-provider.map-deleted-header')"
				:message="i18n.t('client-provider.map-deleted')"
				noCloseButton
				:actions="context.settings.interactive ? [closeMapAction] : []"
			/>
		</template>
	</template>

	<PadSettingsDialog
		v-if="client?.isCreatePad"
		isCreate
		:proposedAdminId="client.padId"
		@hide="handleCreateDialogHide"
	></PadSettingsDialog>
</template>