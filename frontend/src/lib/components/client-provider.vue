<script lang="ts">
	import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from "vue";
	import Client from "facilmap-client";
	import { PadNotFoundError, type MapData, type MapId } from "facilmap-types";
	import MapSettingsDialog from "./map-settings-dialog/map-settings-dialog.vue";
	import storage from "../utils/storage";
	import { type ToastAction } from "./ui/toasts/toasts.vue";
	import Toast from "./ui/toasts/toast.vue";
	import type { ClientContext } from "./facil-map-context-provider/client-context";
	import { injectContextRequired } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { isLanguageExplicit, isUnitsExplicit, useI18n } from "../utils/i18n";
	import { getCurrentLanguage, getCurrentUnits } from "facilmap-utils";

	function isMapNotFoundError(serverError: Client["serverError"]): boolean {
		return !!serverError && serverError instanceof PadNotFoundError;
	}
</script>

<script setup lang="ts">
	const context = injectContextRequired();
	const i18n = useI18n();

	const client = ref<ClientContext>();
	const connectingClient = ref<ClientContext>();

	const props = defineProps<{
		mapId: string | undefined;
		serverUrl: string;
	}>();

	const emit = defineEmits<{
		"update:mapId": [mapId: string | undefined];
	}>();

	function openMap(mapId: string | undefined): void {
		emit("update:mapId", mapId);
	}

	watch([
		() => props.mapId,
		() => props.serverUrl
	], async () => {
		const existingClient = connectingClient.value || client.value;
		if (existingClient && existingClient.server == props.serverUrl && existingClient.mapId == props.mapId)
			return;

		class CustomClient extends Client implements ClientContext {
			_makeReactive<O extends object>(obj: O) {
				return reactive(obj) as O;
			}

			openMap(mapId: string | undefined) {
				openMap(mapId);
			}

			get isCreateMap() {
				return context.settings.interactive && isMapNotFoundError(super.serverError);
			}
		}

		const newClient = new CustomClient(props.serverUrl, props.mapId, {
			query: {
				...isLanguageExplicit() ? { lang: getCurrentLanguage() } : {},
				...isUnitsExplicit() ? { units: getCurrentUnits() } : {}
			}
		});
		connectingClient.value = newClient;

		let lastMapId: MapId | undefined = undefined;
		let lastMapData: MapData | undefined = undefined;

		newClient.on("padData", () => {
			for (const bookmark of storage.bookmarks) {
				if (lastMapId && bookmark.id == lastMapId)
					bookmark.id = newClient.mapId!;

				if (lastMapData && lastMapData.id == bookmark.padId)
					bookmark.padId = newClient.mapData!.id;

				if (bookmark.padId == newClient.mapData!.id)
					bookmark.name = newClient.mapData!.name;
			}

			lastMapId = newClient.mapId;
			lastMapData = newClient.mapData;
		});

		await new Promise<void>((resolve) => {
			newClient.once(props.mapId ? "padData" : "connect", () => { resolve(); });
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
		if (client.value?.isCreateMap) {
			client.value.openMap(undefined);
		}
	}

	const closeMapAction = computed<ToastAction>(() => ({
		label: i18n.t("client-provider.close-map"),
		href: context.baseUrl,
		onClick: (e) => {
			if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				openMap(undefined);
			}
		}
	}));
</script>

<template>
	<template v-if="connectingClient">
		<Toast
			:id="`fm${context.id}-client-connecting`"
			:title="props.mapId ? i18n.t('client-provider.loading-map-header') : i18n.t('client-provider.connecting-header')"
			:message="props.mapId ? i18n.t('client-provider.loading-map') : i18n.t('client-provider.connecting')"
			spinner
			noCloseButton
		/>
	</template>
	<template v-else-if="client">
		<template v-if="client.serverError && !client.isCreateMap">
			<template v-if="client.disconnected || !props.mapId">
				<Toast
					:id="`fm${context.id}-client-error`"
					:title="i18n.t('client-provider.connection-error')"
					:message="client.serverError"
					:noCloseButton="!!props.mapId"
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

	<MapSettingsDialog
		v-if="client?.isCreateMap"
		isCreate
		:proposedAdminId="client.mapId"
		@hide="handleCreateDialogHide"
	></MapSettingsDialog>
</template>