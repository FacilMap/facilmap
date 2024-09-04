<script setup lang="ts">
	import { getLayers } from "facilmap-leaflet";
	import { getLegendItems } from "./legend/legend-utils";
	import { Writable } from "facilmap-types";
	import { formatCoordinates, quoteHtml } from "facilmap-utils";
	import { computed, ref } from "vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { getUniqueId } from "../utils/utils";
	import { getClientSub, injectContextRequired, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import CopyToClipboardInput from "./ui/copy-to-clipboard-input.vue";
	import { T, useI18n } from "../utils/i18n";

	const context = injectContextRequired();
	const clientSub = getClientSub(context);
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("fm-share-dialog");

	const includeMapView = ref(true);
	const showToolbox = ref(true);
	const showSearch = ref(true);
	const showRoute = ref(true);
	const showPois = ref(true);
	const showLegend = ref(true);
	const showLocate = ref(true);
	const mapSlugType = ref<Writable>(2);
	const activeShareTab = ref(0);

	const layers = computed(() => {
		const { baseLayers, overlays } = getLayers(mapContext.value.components.map);
		return [
			baseLayers[mapContext.value.layers.baseLayer]?.options.fmName || mapContext.value.layers.baseLayer,
			...mapContext.value.layers.overlays.map((key) => overlays[key].options.fmName || key)
		].join(i18n.t("share-dialog.include-view-interpolation-layers-joiner"));
	});

	const hasLegend = computed(() => {
		return !!clientSub.value && getLegendItems(context).length > 0;
	});

	const mapSlugTypes = computed(() => {
		return [
			{ value: 2, text: i18n.t("share-dialog.type-admin") },
			{ value: 1, text: i18n.t("share-dialog.type-write") },
			{ value: 0, text: i18n.t("share-dialog.type-read") }
		].filter((option) => clientSub.value && option.value <= clientSub.value.data.mapData!.writable);
	});

	const url = computed(() => {
		const params = new URLSearchParams();
		if (!showToolbox.value) {
			params.set("toolbox", "false");
		}
		if (!showSearch.value) {
			params.set("search", "false");
		} else {
			if (!showRoute.value) {
				params.set("route", "false");
			}
			if (!showPois.value) {
				params.set("pois", "false");
			}
		}
		if (!showLegend.value) {
			params.set("legend", "false");
		}
		if (!showLocate.value) {
			params.set("locate", "false");
		}
		const paramsStr = params.toString();

		return context.baseUrl
			+ (clientSub.value ? encodeURIComponent(
				mapSlugType.value == 2 && clientSub.value.data.mapData!.writable === Writable.ADMIN ? clientSub.value.data.mapData!.adminId :
				mapSlugType.value == 1 && clientSub.value.data.mapData!.writable !== Writable.READ ? clientSub.value.data.mapData!.writeId :
				mapSlugType.value == 0 ? clientSub.value.data.mapData!.readId
				: ""
			) : "")
			+ (paramsStr ? `?${paramsStr}` : '')
			+ (includeMapView.value && mapContext.value.hash ? `#${mapContext.value.hash}` : '');
	});

	const embedCode = computed(() => {
		return `<iframe style="height:500px; width:100%; border:none;" src="${quoteHtml(url.value)}"></iframe>`;
	});
</script>

<template>
	<ModalDialog
		:title="i18n.t('share-dialog.title')"
		size="lg"
		class="fm-share-dialog"
		@hidden="emit('hidden')"
	>
		<div class="row mb-3">
			<label class="col-sm-3 col-form-label">{{i18n.t("share-dialog.settings")}}</label>
			<div class="col-sm-9">
				<div class="form-check fm-form-check-with-label">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-include-map-view-input`"
						v-model="includeMapView"
						:disabled="!clientSub"
					/>
					<label :for="`${id}-include-map-view-input`" class="form-check-label">
						<T k="share-dialog.include-view">
							<template #centre>
								<code>{{formatCoordinates({ lat: mapContext.center.lat, lon: mapContext.center.lng })}}</code>
							</template>
							<template #zoom>
								<code>{{mapContext.zoom}}</code>
							</template>
							<template #layers>
								{{layers}}
							</template>
							<template #conditionalPois>
								<template v-if="mapContext.overpassIsCustom ? !!mapContext.overpassCustom : mapContext.overpassPresets.length > 0">
									<T k="share-dialog.include-view-interpolation-conditionalPois">
										<template #pois>
											<code v-if="mapContext.overpassIsCustom">{{mapContext.overpassCustom}}</code>
											<template v-else>{{mapContext.overpassPresets.map((p) => p.label).join(i18n.t("share-dialog.include-view-interpolation-conditionalPois-interpolation-pois-joiner"))}}</template>
										</template>
									</T>
								</template>
							</template>
							<template #conditionalSelection>
								<template v-if="mapContext.activeQuery">
									<T k="share-dialog.include-view-interpolation-conditionalSelection">
										<template #description>
											<template v-if="mapContext.activeQuery.description">{{mapContext.activeQuery.description}}</template>
											<code v-else>{{mapContext.activeQuery.query}}</code>
										</template>
									</T>
								</template>
							</template>
							<template #conditionalFilter>
								<template v-if="mapContext.filter">
									<T k="share-dialog.include-view-interpolation-conditionalFilter">
										<template #filter>
											<code>{{mapContext.filter}}</code>
										</template>
									</T>
								</template>
							</template>
						</T>
					</label>
				</div>
			</div>
		</div>

		<div class="row mb-3">
			<label class="col-sm-3 col-form-label">{{i18n.t("share-dialog.show-controls")}}</label>
			<div class="col-sm-9 checkbox-grid">
				<div class="form-check fm-form-check-with-label">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-toolbox-input`"
						v-model="showToolbox"
					/>
					<label :for="`${id}-show-toolbox-input`" class="form-check-label">
						{{i18n.t("share-dialog.show-toolbox")}}
					</label>
				</div>

				<div class="form-check">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-search-input`"
						v-model="showSearch"
					/>
					<label :for="`${id}-show-search-input`" class="form-check-label">
						{{i18n.t("share-dialog.show-search-box")}}
					</label>
				</div>

				<div class="form-check">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-route-input`"
						:disabled="!showSearch"
						:checked="showSearch && showRoute"
						@change="showRoute = ($event.target as HTMLInputElement).checked"
					/>
					<label :for="`${id}-show-route-input`" class="form-check-label">
						{{i18n.t("share-dialog.show-route")}}
					</label>
				</div>

				<div class="form-check">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-pois-input`"
						:disabled="!showSearch"
						:checked="showSearch && showPois"
						@change="showPois = ($event.target as HTMLInputElement).checked"
					/>
					<label :for="`${id}-show-pois-input`" class="form-check-label">
						{{i18n.t("share-dialog.show-pois")}}
					</label>
				</div>

				<div class="form-check" v-if="hasLegend">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-legend-input`"
						v-model="showLegend"
					/>
					<label :for="`${id}-show-legend-input`" class="form-check-label">
						{{i18n.t("share-dialog.show-legend")}}
					</label>
				</div>

				<div class="form-check">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-locate-input`"
						v-model="showLocate"
					/>
					<label :for="`${id}-show-locate-input`" class="form-check-label">
						{{i18n.t("share-dialog.show-locate")}}
					</label>
				</div>
			</div>
		</div>

		<template v-if="clientSub">
			<div class="row mb-3">
				<label :for="`${id}-mapSlugType-input`" class="col-sm-3 col-form-label">{{i18n.t("share-dialog.link-type")}}</label>
				<div class="col-sm-9">
					<select :id="`${id}-mapSlugType-input`" class="form-select" v-model="mapSlugType">
						<option v-for="type in mapSlugTypes" :key="type.value" :value="type.value">{{type.text}}</option>
					</select>
				</div>
			</div>
		</template>

		<ul class="nav nav-tabs">
			<li class="nav-item">
				<a
					class="nav-link"
					href="javascript:"
					:class="{ active: activeShareTab === 0 }"
					@click="activeShareTab = 0"
				>{{i18n.t("share-dialog.share-link")}}</a>
			</li>

			<li class="nav-item">
				<a
					class="nav-link"
					href="javascript:"
					:class="{ active: activeShareTab === 1 }"
					@click="activeShareTab = 1"
				>{{i18n.t("share-dialog.embed")}}</a>
			</li>
		</ul>

		<template v-if="activeShareTab === 0">
			<CopyToClipboardInput
				class="mt-2"
				:modelValue="url"
				readonly
				:successTitle="i18n.t('share-dialog.link-copied-title')"
				:successMessage="i18n.t('share-dialog.link-copied-message')"
			></CopyToClipboardInput>
		</template>

		<template v-else-if="activeShareTab === 1">
			<CopyToClipboardInput
				class="mt-2"
				:modelValue="embedCode"
				readonly
				:successTitle="i18n.t('share-dialog.embed-copied-title')"
				:successMessage="i18n.t('share-dialog.embed-copied-message', { appName: context.appName })"
				:rows="2"
				noQr
			></CopyToClipboardInput>

			<p class="mt-2">
				<T k="share-dialog.embed-explanation">
					<template #appName>
						{{context.appName}}
					</template>
					<template #learnMore>
						<a href="https://docs.facilmap.org/developers/embed.html" target="_blank">{{i18n.t("share-dialog.embed-explanation-interpolation-learnMore")}}</a>
					</template>
				</T>
			</p>
		</template>
	</ModalDialog>
</template>

<style lang="scss">
	.fm-share-dialog {
		.checkbox-grid {
			column-width: 160px;
		}
	}
</style>