<script setup lang="ts">
	import { computed, ref } from "vue";
	import type { CRU, ID, MapData } from "facilmap-types";
	import type { CustomSubmitEvent } from "./ui/validated-form/validated-form.vue";
	import { generateRandomMapId, getOrderedTypes, getOrderedViews, normalizeMapName } from "facilmap-utils";
	import { getMarkerHtmlSync } from "facilmap-leaflet";
	import ModalDialog from "./ui/modal-dialog.vue";
	import MapSettingsGeneral from "./map-settings-dialog/map-settings-general.vue";
	import MapSettingsFormulas from "./map-settings-dialog/map-settings-formulas.vue";
	import { injectContextRequired, requireClientContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { getUniqueId } from "../utils/utils";
	import { useI18n } from "../utils/i18n";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import Client from "facilmap-client";
	import { cloneMapStructure, getCloneMapPrefill, type CloneMapClient, type CloneMapSource } from "../utils/clone-map";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const i18n = useI18n();
	// Not scoped to the dialog, since the result toast has to stay visible after the dialog is closed and unmounted
	const toasts = useToasts(true);

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("fm-clone-map");

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const types = computed(() => getOrderedTypes(client.value.types));
	const markerTypes = computed(() => types.value.filter((t) => t.type === "marker"));
	const lineTypes = computed(() => types.value.filter((t) => t.type === "line"));
	const views = computed(() => getOrderedViews(client.value.views));

	const markerHtmls = computed(() => Object.fromEntries(markerTypes.value.map((t) => [t.id, getMarkerHtmlSync(`#${t.defaultColour}`, 24, t.defaultIcon, t.defaultShape)])));

	const deselectedTypes = ref(new Set<ID>());
	const deselectedViews = ref(new Set<ID>());

	function toggle(set: Set<ID>, itemId: ID, checked: boolean): void {
		if (checked) {
			set.delete(itemId);
		} else {
			set.add(itemId);
		}
	}

	const step = ref<1 | 2>(1);
	const activeTab = ref(0);

	/** The data of the new map, edited in step 2. Created when step 2 is first shown, so that going back keeps the changes. */
	const newMapData = ref<MapData<CRU.CREATE>>();

	function getSource(): CloneMapSource {
		return {
			defaultViewId: client.value.mapData!.defaultViewId,
			types: types.value.filter((t) => !deselectedTypes.value.has(t.id)),
			views: views.value.filter((v) => !deselectedViews.value.has(v.id))
		};
	}

	function handleSubmit(event: CustomSubmitEvent): void {
		if (step.value === 1) {
			newMapData.value ??= {
				adminId: generateRandomMapId(16),
				writeId: generateRandomMapId(14),
				id: generateRandomMapId(12),
				...getCloneMapPrefill(client.value.mapData!, i18n.t("clone-map-dialog.default-name", { name: normalizeMapName(client.value.mapData!.name) }))
			};
			step.value = 2;
		} else {
			event.waitUntil(createCopy(newMapData.value!, getSource()));
		}
	}

	/** How long to wait for the connection of the temporary client before giving up. */
	const CONNECT_TIMEOUT = 15_000;

	/**
	 * Socket.io buffers requests while disconnected, so without this, a request would wait forever if the server goes away.
	 * Returns a client whose requests fail as soon as the connection of the given client is lost or cannot be established.
	 */
	function failOnConnectionLoss(tempClient: Client): { client: CloneMapClient; dispose: () => void } {
		let fail!: (err: Error) => void;
		const lost = new Promise<never>((resolve, reject) => {
			fail = reject;
		});
		lost.catch(() => undefined);

		const onLost = () => {
			fail(new Error(i18n.t("clone-map-dialog.connection-lost")));
		};
		tempClient.on("disconnect", onLost);
		tempClient.on("connect_error", onLost);
		const timeout = setTimeout(() => {
			if (tempClient.disconnected) {
				onLost();
			}
		}, CONNECT_TIMEOUT);

		const guard = <A extends any[], R>(fn: (...args: A) => Promise<R>) => (...args: A) => Promise.race([fn(...args), lost]);

		return {
			client: {
				createMap: guard((data) => tempClient.createMap(data)),
				addType: guard((data) => tempClient.addType(data)),
				addView: guard((data) => tempClient.addView(data)),
				editMap: guard((data) => tempClient.editMap(data)),
				deleteMap: guard(() => tempClient.deleteMap())
			},
			dispose: () => {
				clearTimeout(timeout);
				tempClient.removeListener("disconnect", onLost);
				tempClient.removeListener("connect_error", onLost);
			}
		};
	}

	/** Creates the copy through a separate client, since creating it on the current client would leave the current map. */
	async function createCopy(mapData: MapData<CRU.CREATE>, source: CloneMapSource): Promise<void> {
		toasts.hideToast(`fm${context.id}-clone-map`);

		// Has to be opened before the first await, otherwise popup blockers block it
		const newTab = window.open("", "_blank");

		const tempClient = new Client(client.value.server);
		const guarded = failOnConnectionLoss(tempClient);
		try {
			const result = await cloneMapStructure(guarded.client, mapData, source);
			const link = context.baseUrl + encodeURIComponent(mapData.adminId);

			if (newTab) {
				newTab.location.href = link;
			}

			const messages = [
				newTab ? i18n.t("clone-map-dialog.success-message-tab") : i18n.t("clone-map-dialog.success-message-link"),
				...(result.droppedFilters > 0 ? [i18n.t("clone-map-dialog.success-message-dropped-filters", { count: result.droppedFilters })] : [])
			];
			void toasts.showToast(`fm${context.id}-clone-map`, () => i18n.t("clone-map-dialog.success-title"), () => messages.join(" "), {
				variant: "success",
				autoHide: !!newTab && result.droppedFilters === 0,
				actions: [{
					label: i18n.t("clone-map-dialog.open-copy"),
					href: link,
					variant: "primary",
					onClick: (e) => {
						// Open in a new tab, so that the current tab stays on the original map
						e.preventDefault();
						window.open(link, "_blank");
					}
				}]
			});

			modalRef.value?.modal.hide();
		} catch (err) {
			newTab?.close();
			void toasts.showErrorToast(`fm${context.id}-clone-map`, () => i18n.t("clone-map-dialog.error-title"), err);
		} finally {
			guarded.dispose();
			tempClient.disconnect();
		}
	}
</script>

<template>
	<ModalDialog
		:title="step === 1 ? i18n.t('clone-map-dialog.title-step-1') : i18n.t('clone-map-dialog.title-step-2')"
		class="fm-clone-map-dialog"
		:isCreate="true"
		:okLabel="step === 1 ? i18n.t('clone-map-dialog.next') : i18n.t('clone-map-dialog.create')"
		ref="modalRef"
		@submit="handleSubmit($event)"
		@hidden="emit('hidden')"
	>
		<template v-if="step === 1">
			<template v-for="group in [
				{ key: 'marker-types', items: markerTypes, deselected: deselectedTypes },
				{ key: 'line-types', items: lineTypes, deselected: deselectedTypes },
				{ key: 'views', items: views, deselected: deselectedViews }
			] as const" :key="group.key">
				<div v-if="group.items.length > 0" class="row mb-3">
					<div class="col-sm-3 col-form-label">{{i18n.t(`clone-map-dialog.${group.key}`)}}</div>
					<div class="col-sm-9">
						<div v-for="item in group.items" :key="item.id" class="form-check fm-form-check-with-label">
							<input
								class="form-check-input"
								type="checkbox"
								:id="`${id}-${group.key}-${item.id}`"
								:checked="!group.deselected.has(item.id)"
								@change="toggle(group.deselected, item.id, ($event.target as HTMLInputElement).checked)"
							>
							<label class="form-check-label" :for="`${id}-${group.key}-${item.id}`">
								<span v-if="'type' in item && item.type === 'marker'" class="fm-clone-map-icon" v-html="markerHtmls[item.id]"></span>
								<span v-else-if="'type' in item" class="fm-clone-map-icon"><span class="fm-clone-map-line" :style="{ backgroundColor: `#${item.defaultColour}` }"></span></span>
								{{item.name}}
							</label>
						</div>
					</div>
				</div>
			</template>

			<div class="row">
				<div class="col-sm-9 offset-sm-3 form-text mt-0">{{i18n.t("clone-map-dialog.not-copied")}}</div>
			</div>
		</template>

		<template v-else-if="newMapData">
			<ul class="nav nav-tabs mb-2">
				<li class="nav-item">
					<a class="nav-link" :class="{ active: activeTab === 0 }" href="javascript:" @click="activeTab = 0">
						{{i18n.t("map-settings-dialog.tab-general")}}
					</a>
				</li>

				<li class="nav-item">
					<a class="nav-link" :class="{ active: activeTab === 1 }" href="javascript:" @click="activeTab = 1">
						{{i18n.t("map-settings-dialog.tab-formulas")}}
					</a>
				</li>
			</ul>

			<div v-show="activeTab === 0" @invalid.capture="activeTab = 0">
				<MapSettingsGeneral :mapData="newMapData"></MapSettingsGeneral>
			</div>

			<div v-show="activeTab === 1" @invalid.capture="activeTab = 1">
				<MapSettingsFormulas :mapData="newMapData"></MapSettingsFormulas>
			</div>
		</template>

		<template #footer-left="{ formData }">
			<button
				v-if="step === 2"
				type="button"
				class="btn btn-secondary"
				:disabled="formData?.isSubmitting"
				@click="step = 1"
			>{{i18n.t("clone-map-dialog.back")}}</button>
		</template>
	</ModalDialog>
</template>

<style lang="scss">
	.fm-clone-map-dialog {
		.form-check-label {
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			overflow-wrap: anywhere;
		}

		.fm-clone-map-icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			width: 1.5rem;

			svg, img {
				display: block;
			}
		}

		.fm-clone-map-line {
			width: 1.5rem;
			height: 3px;
			border-radius: 2px;
		}
	}
</style>
