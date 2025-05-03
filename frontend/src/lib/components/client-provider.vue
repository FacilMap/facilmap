<script lang="ts">
	import { computed, onBeforeUnmount, reactive, shallowReactive, watch, type ComputedRef } from "vue";
	import { ClientStateType, SocketClient, SocketClientStorage } from "facilmap-client";
	import MapSettingsDialog from "./map-settings-dialog/map-settings-dialog.vue";
	import storage from "../utils/storage";
	import { type ToastAction } from "./ui/toasts/toasts.vue";
	import Toast from "./ui/toasts/toast.vue";
	import { ClientContextMapState, type ClientContext, type ClientContextMap } from "./facil-map-context-provider/client-context";
	import { injectContextRequired } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { isLanguageExplicit, isUnitsExplicit, useI18n } from "../utils/i18n";
	import { getCurrentLanguage, getCurrentUnits } from "facilmap-utils";
	import { VueReactiveObjectProvider, computedWithDeps } from "../utils/vue";
	import type { SocketClientMapSubscription } from "facilmap-client/src/socket-client-map-subscription";
	import { getMainAdminLink, type CRU, type MapData } from "facilmap-types";

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

	const clientContext: ComputedRef<ClientContext> = computedWithDeps(() => props.serverUrl, (serverUrl, oldValue, onCleanup): ClientContext => {
		const client = new SocketClient(serverUrl, {
			reactiveObjectProvider: new VueReactiveObjectProvider(),
			query: {
				...isLanguageExplicit() ? { lang: getCurrentLanguage() } : {},
				...isUnitsExplicit() ? { units: getCurrentUnits() } : {}
			}
		});

		const storage = new SocketClientStorage(client, {
			reactiveObjectProvider: new VueReactiveObjectProvider()
		});

		onCleanup(() => {
			storage.dispose();
			client.disconnect();
		});

		const result = shallowReactive<ClientContext>({
			client,
			storage,
			openMap,
			createAndOpenMap
		});

		client.on("deleteMap", (mapSlug) => {
			if (result.map && result.map.mapSlug === mapSlug) {
				// Replace whole map object so that other state changes below don't have an effect
				result.map = reactive<ClientContextMap>({
					mapSlug,
					subscription: result.map.subscription,
					get data() {
						return undefined;
					},
					get activeLink() {
						return undefined;
					},
					state: ClientContextMapState.DELETED
				}) as ClientContextMap;
			}
		});

		return result;
	});

	watch(() => props.mapSlug, async (mapSlug) => {
		if (clientContext.value.map && (!mapSlug || clientContext.value.map.mapSlug !== mapSlug)) {
			clientContext.value.map.subscription.unsubscribe().catch(() => undefined);
			clientContext.value.map = undefined;
		}

		if (mapSlug && (!clientContext.value.map || clientContext.value.map.mapSlug !== mapSlug)) {
			await setSubscription(clientContext.value.client.subscribeToMap({
				mapSlug,
				// identity: storage.identities?.[mapSlug]
			}));
		}
	}, { immediate: true });

	onBeforeUnmount(() => {
		clientContext.value.map?.subscription.unsubscribe().catch(() => undefined);
	});

	watch(() => clientContext.value.map?.data?.mapData, (mapData) => {
		if (mapData) {
			for (const favourite of storage.favourites) {
				// Update map name and set mapId on legacy favourites that don't have it set yet
				const mapLinkBySlug = mapData.links.find((l) => l.slug === favourite.mapSlug);
				if (mapLinkBySlug) {
					favourite.mapId = mapData.id;
					favourite.linkId = mapLinkBySlug.id;
					favourite.name = mapData.name;
				}

				// If map slug was changed, update it in favourites
				const mapLinkById = mapData.links.find((l) => favourite.linkId != null && favourite.linkId === l.id);
				if (mapLinkById) {
					favourite.mapSlug = mapLinkById.slug;
				}
			}
		}
	}, { immediate: true });

	context.provideComponent("client", clientContext);

	function openMap(mapSlug: string | undefined): void {
		emit("update:mapSlug", mapSlug);
	}

	async function setSubscription(subscription: SocketClientMapSubscription) {
		const mapObj = clientContext.value.map = reactive({
			mapSlug: subscription.mapSlug,
			get data() {
				return clientContext.value.storage.maps[subscription.mapSlug];
			},
			get activeLink() {
				return clientContext.value.storage.maps[subscription.mapSlug].mapData?.activeLink;
			},
			state: ClientContextMapState.OPENING,
			subscription
		}) as ClientContextMap;

		try {
			await mapObj.subscription.subscribePromise;
			mapObj.state = ClientContextMapState.OPEN;
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

	async function createAndOpenMap(data: MapData<CRU.CREATE>) {
		const promise = setSubscription(clientContext.value.client.createMapAndSubscribe(data));
		emit("update:mapSlug", getMainAdminLink(data.links).slug);
		await promise;
	}

	function handleCreateDialogHide() {
		// If the dialog was canceled, we are still in CREATE state. Otherwise, we have already created and opened a map.
		if (clientContext.value.map?.state === ClientContextMapState.CREATE) {
			clientContext.value.openMap(undefined);
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
	<template v-if="clientContext.client.state.type === ClientStateType.INITIAL">
		<Toast
			:id="`fm${context.id}-client-connecting`"
			:title="i18n.t('client-provider.connecting-header')"
			:message="i18n.t('client-provider.connecting')"
			spinner
			noCloseButton
		/>
	</template>
	<template v-else-if="clientContext.client.state.type === ClientStateType.RECONNECTING">
		<Toast
			:id="`fm${context.id}-client-disconnected`"
			variant="danger"
			:title="i18n.t('client-provider.disconnected-header')"
			:message="i18n.t('client-provider.disconnected')"
			no-close-button
			spinner
		/>
	</template>
	<template v-else-if="clientContext.client.state.type === ClientStateType.FATAL_ERROR">
		<Toast
			:id="`fm${context.id}-client-error`"
			:title="i18n.t('client-provider.connection-error')"
			:message="clientContext.client.state.error"
			:noCloseButton="!!props.mapSlug"
		/>
	</template>
	<template v-else-if="clientContext.map?.state === ClientContextMapState.OPENING">
		<Toast
			:id="`fm${context.id}-client-connecting`"
			:title="i18n.t('client-provider.loading-map-header')"
			:message="i18n.t('client-provider.loading-map')"
			spinner
			noCloseButton
		/>
	</template>
	<template v-else-if="clientContext.map?.state === ClientContextMapState.CREATE">
		<MapSettingsDialog
			isCreate
			:proposedAdminId="clientContext.map.mapSlug"
			@hide="handleCreateDialogHide"
		></MapSettingsDialog>
	</template>
	<template v-else-if="clientContext.map?.state === ClientContextMapState.DELETED">
		<Toast
			:id="`fm${context.id}-client-deleted`"
			variant="danger"
			:title="i18n.t('client-provider.map-deleted-header')"
			:message="i18n.t('client-provider.map-deleted')"
			noCloseButton
			:actions="context.settings.interactive ? [closeMapAction] : []"
		/>
	</template>
	<template v-else-if="clientContext.map?.state === ClientContextMapState.ERROR">
		<Toast
			:id="`fm${context.id}-client-error`"
			:title="i18n.t('client-provider.open-map-error')"
			:message="clientContext.map.error"
			noCloseButton
			:actions="context.settings.interactive ? [closeMapAction] : []"
		/>
	</template>
</template>