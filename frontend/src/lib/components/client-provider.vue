<script lang="ts">
	import { computed, reactive, shallowReactive, watch, type ComputedRef } from "vue";
	import { ClientStateType, SocketClient, SocketClientStorage } from "facilmap-client";
	import MapSettingsDialog from "./map-settings-dialog/map-settings-dialog.vue";
	import storage from "../utils/storage";
	import { type ToastAction } from "./ui/toasts/toasts.vue";
	import Toast from "./ui/toasts/toast.vue";
	import { ClientContextMapState, type ClientContext, type ClientContextMap } from "./facil-map-context-provider/client-context";
	import { injectContextRequired } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { isLanguageExplicit, isUnitsExplicit, useI18n } from "../utils/i18n";
	import { getCurrentLanguage, getCurrentUnits } from "facilmap-utils";
	import { VueReactiveObjectProvider, computedWithDeps, fixOnCleanup, withoutTracking } from "../utils/vue";

	function isMapNotFoundError(fatalError: Error): boolean {
		return (fatalError as any).status === 404;
	}
</script>

<script setup lang="ts">
	const context = injectContextRequired();
	const i18n = useI18n();

	const props = defineProps<{
		mapSlug: string | undefined;
		serverUrl: string;
	}>();

	const emit = defineEmits<{
		"update:mapSlug": [mapSlug: string | undefined];
	}>();

	function openMap(mapSlug: string | undefined): void {
		emit("update:mapSlug", mapSlug);
	}

	const client: ComputedRef<ClientContext> = computedWithDeps(() => props.serverUrl, (serverUrl, oldValue, onCleanup): ClientContext => {
		const client = new SocketClient(serverUrl, {
			reactiveObjectProvider: new VueReactiveObjectProvider(),
			query: {
				...isLanguageExplicit() ? { lang: getCurrentLanguage() } : {},
				...isUnitsExplicit() ? { units: getCurrentUnits() } : {}
			}
		});

		const clientStorage = shallowReactive<ClientContext>(Object.assign(new SocketClientStorage(client, {
			reactiveObjectProvider: new VueReactiveObjectProvider()
		}), { openMap }));

		onCleanup(() => {
			clientStorage.dispose();
			client.disconnect();
		});

		client.on("deleteMap", (mapSlug) => {
			if (clientStorage.map && clientStorage.map.mapSlug === mapSlug) {
				// Replace whole map object so that other state changes below don't have an effect
				clientStorage.map = reactive<ClientContextMap>({
					mapSlug,
					state: ClientContextMapState.DELETED
				});
			}
		});

		return clientStorage;
	});

	watch([
		() => client.value,
		() => props.mapSlug
	], async ([client, mapSlug], oldValue, onCleanup_) => {
		const onCleanup = fixOnCleanup(onCleanup_);
		if (mapSlug) {
			const mapObj: ClientContextMap = reactive({
				mapSlug,
				get data() {
					return client.maps[mapSlug];
				},
				state: ClientContextMapState.OPENING
			});

			client.map = mapObj;

			onCleanup(() => {
				client.map = undefined;
				client.unsubscribeFromMap(mapSlug).catch(() => undefined);
			});

			try {
				await client.subscribeToMap(mapSlug);
				Object.assign(mapObj, {
					state: ClientContextMapState.OPEN,

					mapData: client.maps[mapSlug].mapData
				});
			} catch(err: any) {
				if (context.settings.interactive && isMapNotFoundError(err)) {
					mapObj.state = ClientContextMapState.CREATE;
				} else {
					Object.assign(mapObj, {
						state: ClientContextMapState.ERROR,
						error: err
					});
				}
			}
		}
	}, { immediate: true });

	const mapData = computed(() => client.value.map ? client.value.maps[client.value.map.mapSlug]?.mapData : undefined);

	watch(mapData, (mapData) => {
		withoutTracking(() => {
			if (mapData && client.value.map?.state === ClientContextMapState.OPEN) {
				client.value.map.mapData = mapData;
			}
		});
	}, { immediate: true, flush: "sync" });

	watch(mapData, (mapData, oldMapData) => {
		if (mapData) {
			// Update map name and set mapId on legacy bookmarks that don't have it set yet
			for (const bookmark of storage.bookmarks) {
				if (bookmark.mapSlug === mapData.readId || ("writeId" in mapData && bookmark.mapSlug === mapData.writeId) || ("adminId" in mapData && bookmark.mapSlug === mapData.adminId)) {
					bookmark.mapId = mapData.id;
					bookmark.name = mapData.name;
				}
			}
		}

		if (mapData && oldMapData && oldMapData.id === mapData.id) {
			// If map slug was changed, update it in bookmarks
			for (const bookmark of storage.bookmarks) {
				if (bookmark.mapSlug === oldMapData.readId) {
					bookmark.mapSlug = mapData.readId;
				} else if ("writeId" in oldMapData && bookmark.mapSlug === oldMapData.writeId && "writeId" in mapData) {
					bookmark.mapSlug = mapData.writeId;
				} else if ("adminId" in oldMapData && bookmark.mapSlug === oldMapData.adminId && "adminId" in mapData) {
					bookmark.mapSlug = mapData.adminId;
				}
			}
		}
	}, { immediate: true });

	context.provideComponent("client", client);

	function handleCreateDialogHide() {
		// If the dialog was canceled, we are still in CREATE state. Otherwise, we have already created and opened a map.
		if (client.value.map?.state === ClientContextMapState.CREATE) {
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
	<template v-if="client.client.state.type === ClientStateType.INITIAL">
		<Toast
			:id="`fm${context.id}-client-connecting`"
			:title="i18n.t('client-provider.connecting-header')"
			:message="i18n.t('client-provider.connecting')"
			spinner
			noCloseButton
		/>
	</template>
	<template v-else-if="client.client.state.type === ClientStateType.DISCONNECTED">
		<Toast
			:id="`fm${context.id}-client-disconnected`"
			variant="danger"
			:title="i18n.t('client-provider.disconnected-header')"
			:message="i18n.t('client-provider.disconnected')"
			no-close-button
			spinner
		/>
	</template>
	<template v-else-if="client.client.state.type === ClientStateType.FATAL_ERROR">
		<Toast
			:id="`fm${context.id}-client-error`"
			:title="i18n.t('client-provider.connection-error')"
			:message="client.client.state.error"
			:noCloseButton="!!props.mapSlug"
		/>
	</template>
	<template v-else-if="client.map?.state === ClientContextMapState.OPENING">
		<Toast
			:id="`fm${context.id}-client-connecting`"
			:title="i18n.t('client-provider.loading-map-header')"
			:message="i18n.t('client-provider.loading-map')"
			spinner
			noCloseButton
		/>
	</template>
	<template v-else-if="client.map?.state === ClientContextMapState.CREATE">
		<MapSettingsDialog
			isCreate
			:proposedAdminId="client.map.mapSlug"
			@hide="handleCreateDialogHide"
		></MapSettingsDialog>
	</template>
	<template v-else-if="client.map?.state === ClientContextMapState.DELETED">
		<Toast
			:id="`fm${context.id}-client-deleted`"
			variant="danger"
			:title="i18n.t('client-provider.map-deleted-header')"
			:message="i18n.t('client-provider.map-deleted')"
			noCloseButton
			:actions="context.settings.interactive ? [closeMapAction] : []"
		/>
	</template>
	<template v-else-if="client.map?.state === ClientContextMapState.ERROR">
		<Toast
			:id="`fm${context.id}-client-error`"
			:title="i18n.t('client-provider.open-map-error')"
			:message="client.map.error"
			noCloseButton
			:actions="context.settings.interactive ? [closeMapAction] : []"
		/>
	</template>
</template>