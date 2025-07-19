<script setup lang="ts">
	import { computed } from "vue";
	import {  useI18n } from "../../utils/i18n";
	import { xor } from "lodash-es";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { getLayers } from "facilmap-leaflet";
	import { isPresetLink, type ExternalLinkSetting } from "../../utils/external-links";
	import Icon from "../ui/icon.vue";
	import Draggable from "vuedraggable";
	import { useImmutableModel } from "../../utils/vue";
	import { markdownInline } from "facilmap-utils";
	import vTooltip from "../../utils/tooltip";
	import HelpPopover from "../ui/help-popover.vue";

	const i18n = useI18n();
	const context = injectContextRequired();
	const mapContext = requireMapContext(context);

	const baseLayer = defineModel<string>("baseLayer", { required: true });
	const overlays = defineModel<string[]>("overlays", { required: true });
	const externalLinksModel = defineModel<ExternalLinkSetting[]>("externalLinks", { required: true });
	const externalLinks = useImmutableModel(externalLinksModel);

	const availableBaseLayers = computed(() => {
		const { baseLayers } = getLayers(mapContext.value.components.map);
		return Object.keys(baseLayers).map((key) => ({
			key,
			name: baseLayers[key].options.fmGetName!()
		}));
	});

	const availableOverlays = computed(() => {
		const { overlays } = getLayers(mapContext.value.components.map);
		return Object.keys(overlays).map((key) => ({
			key,
			name: overlays[key].options.fmGetName?.() ?? overlays[key].options.fmName!
		}));
	});

	const selectedLayersLabel = computed(() => [
		...availableBaseLayers.value.filter((l) => baseLayer.value === l.key),
		...availableOverlays.value.filter((l) => overlays.value.includes(l.key))
	].map((l) => l.name).join("; "));

	const createExternalLink = () => {
		externalLinks.value.push({
			key: `new-${new Date().getTime()}`,
			label: "",
			map: "",
			marker: ""
		});
	};
</script>

<template>
	<div class="row mb-3">
		<label class="col-sm-3 col-form-label">{{i18n.t("user-preferences-dialog.default-map-style")}}</label>

		<DropdownMenu :label="selectedLayersLabel" class="col-sm-9">
			<li v-for="layerInfo in availableBaseLayers" :key="layerInfo.key">
				<a
					class="dropdown-item"
					:class="{ active: baseLayer === layerInfo.key }"
					href="javascript:"
					@click.capture.stop="baseLayer = layerInfo.key"
					draggable="false"
				>{{layerInfo.name}}</a>
			</li>

			<li v-if="availableBaseLayers.length > 0 && availableOverlays.length > 0">
				<hr class="dropdown-divider">
			</li>

			<li v-for="layerInfo in availableOverlays" :key="layerInfo.key">
				<a
					class="dropdown-item"
					:class="{ active: overlays.includes(layerInfo.key) }"
					href="javascript:"
					@click.capture.stop="overlays = xor(overlays, [layerInfo.key])"
					draggable="false"
				>{{layerInfo.name}}</a>
			</li>
		</DropdownMenu>

		<hr class="mt-2" />
		<h5>{{i18n.t("user-preferences-dialog.external-links")}}</h5>

		<p>
			<span v-html="markdownInline(i18n.t('user-preferences-dialog.external-links-description'), true)"></span>
			<HelpPopover>
				<p>{{i18n.t("user-preferences-dialog.external-links-placeholders")}}</p>
				<table class="table table-condensed table-striped">
					<tbody>
						<tr>
							<th><code>%LAT%</code>, <code>%LON%</code></th>
							<td v-html="markdownInline(i18n.t('user-preferences-dialog.external-links-placeholder-coords'), true)"></td>
						</tr>
						<tr>
							<th><code>%LAT#####%</code>,<br /><code>%LON#####%</code></th>
							<td v-html="markdownInline(i18n.t('user-preferences-dialog.external-links-placeholder-coords-proj'), true)"></td>
						</tr>
						<tr>
							<th><code>%ZOOM%</code></th>
							<td v-html="markdownInline(i18n.t('user-preferences-dialog.external-links-placeholder-zoom'), true)"></td>
						</tr>
						<tr>
							<th><code>%ZOOM+#%</code>,<br /><code>%ZOOM-#%</code></th>
							<td v-html="markdownInline(i18n.t('user-preferences-dialog.external-links-placeholder-zoom-modified'), true)"></td>
						</tr>
					</tbody>
				</table>
			</HelpPopover>
		</p>

		<table class="table table-condensed table-striped">
			<thead>
				<tr>
					<th></th>
					<th>{{i18n.t("user-preferences-dialog.external-links-label")}}</th>
					<th>{{i18n.t("user-preferences-dialog.external-links-map-url")}}</th>
					<th>{{i18n.t("user-preferences-dialog.external-links-marker-url")}}</th>
					<th></th>
				</tr>
			</thead>
			<Draggable
				v-model="externalLinks"
				tag="tbody"
				handle=".fm-drag-handle"
				itemKey="key"
			>
				<template #item="{ element: link, index }">
					<tr>
						<td class="align-middle text-center">
							<input
								v-if="isPresetLink(link)"
								class="form-check-input fm-large-checkbox"
								type="checkbox"
								v-model="link.enabled"
							/>
						</td>

						<td>
							<input type="text" class="form-control" v-model="link.label" :readonly="isPresetLink(link)" />
						</td>

						<td>
							<input type="url" class="form-control" v-model="link.map" :readonly="isPresetLink(link)" />
						</td>

						<td>
							<input type="url" class="form-control" v-model="link.marker" :readonly="isPresetLink(link)" />
						</td>

						<td class="td-buttons">
							<button
								type="button"
								class="btn btn-secondary fm-drag-handle"
							>
								<Icon icon="resize-vertical" :alt="i18n.t('user-preferences-dialog.external-links-reorder-alt')"></Icon>
							</button>

							<button
								v-if="!isPresetLink(link)"
								type="button"
								class="btn btn-secondary"
								v-tooltip="i18n.t('user-preferences-dialog.external-links-delete-tooltip')"
								@click="externalLinks.splice(index, 1)"
							>
								<Icon icon="trash" :alt="i18n.t('user-preferences-dialog.external-links-delete-tooltip')"></Icon>
							</button>
						</td>
					</tr>
				</template>
			</Draggable>
			<tfoot>
				<tr>
					<td colspan="5">
						<button type="button" class="btn btn-secondary" @click="createExternalLink()">
							{{i18n.t("user-preferences-dialog.external-links-create")}}
						</button>
					</td>
				</tr>
			</tfoot>
		</table>
	</div>
</template>