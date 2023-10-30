<script lang="ts">
	import { defineComponent, onMounted, reactive, ref, toRaw, watch } from "vue";
	import FmClient from "facilmap-client";
	import { PadData, PadId } from "facilmap-types";
	import PadSettings from "./pad-settings/pad-settings.vue";
	import storage from "../utils/storage";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { injectContextRequired } from "../utils/context";
	import { onBeforeUnmount } from "vue";
	import Toast from "./ui/toasts/toast.vue";
	import { InjectionKey, Ref, inject, provide } from "vue";

	export type Client = FmClient;

	export type ClientContext = {
		openPad(padId: string | undefined): void;
	};

	const clientInject = Symbol("clientInject") as InjectionKey<Client>;
	const clientContextInject = Symbol("clientContextInject") as InjectionKey<ClientContext>;

	export function injectClientOptional(): Client | undefined {
		return inject(clientInject);
	}

	export function injectClientRequired(): Client {
		const client = injectClientOptional();
		if (!client) {
			throw new Error("No client injected.");
		}
		return client;
	}

	export function injectClientContextOptional(): ClientContext | undefined {
		return inject(clientContextInject);
	}

	export function injectClientContextRequired(): ClientContext {
		const clientContext = injectClientContextOptional();
		if (!clientContext) {
			throw new Error("No client context injected.");
		}
		return clientContext;
	}
</script>

<script setup lang="ts">
	const context = injectContextRequired();

	const toasts = useToasts();

	const client = ref<Client>();
	const connectingClient = ref<Client>();

	const props = defineProps<{
		padId: string | undefined;
		serverUrl: string;
	}>();

	const emit = defineEmits<{
		(type: "update:padId", padId: string | undefined): void;
	}>();

	const clientContext = reactive<ClientContext>({
		openPad: (padId) => {
			emit("update:padId", padId);
		}
	});

	const createId = ref<string>();
	const counter = ref(1);

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

		const newClient = new FmClient(props.serverUrl, props.padId);
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
		});

		newClient.on("deletePad", () => {
			toasts.showToast(`fm${context.id}-client-deleted`, "Map deleted", "This map has been deleted.", {
				variant: "danger",
				actions: context.interactive ? [
					{
						label: "Close map",
						href: context.baseUrl,
						onClick: (e) => {
							if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
								e.preventDefault();
								clientContext.openPad(undefined);
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

		if (newClient.serverError?.message?.includes("does not exist") && context.interactive) {
			createId.value = newClient.padId!;
			newClient.padId = undefined;
			newClient.serverError = undefined;
		} else if (newClient.serverError) {
			toasts.showErrorToast(`fm${context.id}-client-error`, "Error opening map", newClient.serverError, {
				noCloseButton: true,
				actions: context.interactive ? [
					{
						label: "Close map",
						href: context.baseUrl,
						onClick: (e) => {
							if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey) {
								e.preventDefault();
								clientContext.openPad(undefined);
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

	const ClientProvider = defineComponent({
		setup(props, { slots }) {
			provide(clientInject, client.value!);
			return slots.default;
		}
	});

	defineExpose({
		client,
		clientContext
	});
</script>

<template>
	<div class="fm-client-provider">
		<ClientProvider v-if="client" :key="counter">
			<slot />
		</ClientProvider>

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

		<ClientProvider v-if="client" :key="counter">
			<PadSettings
				v-if="createId"
				is-create
				no-cancel
				:proposed-admin-id="createId"
			></PadSettings>
		</ClientProvider>
	</div>
</template>

<style lang="scss">
	.fm-client-provider {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}
</style>