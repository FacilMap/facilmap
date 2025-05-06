<!-- eslint-disable vue/no-mutating-props -->
<script setup lang="ts">
	import type { CRU, MapData, MapLink, MergedUnion } from 'facilmap-types';
	import { useI18n } from '../../utils/i18n';
	import MapSlugEdit from "./map-slug-edit.vue";
	import MapSettingsEditLinkDialog from "./map-settings-edit-link-dialog.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { ref } from "vue";

	const props = defineProps<{
		mapData: MergedUnion<[MapData<CRU.CREATE>, Required<MapData<CRU.UPDATE>>]>;
	}>();

	const i18n = useI18n();
	const toasts = useToasts();

	const context = injectContextRequired();

	const editLink = ref<MapLink<CRU.CREATE | CRU.UPDATE>>();

	function handleUpdateLink(link: MapLink<CRU.CREATE | CRU.UPDATE>) {
		const idx = props.mapData.links.indexOf(editLink.value!);
		if (idx === -1) {
			toasts.showErrorToast(
				`fm${context.id}-map-settings-links-error`,
				() => i18n.t("map-settings-dialog.link-update-error"),
				() => i18n.t("map-settings-dialog.link-disappeared-error")
			);
		}
		props.mapData.links[idx] = link;
		editLink.value = link;
	}
</script>

<template>
	<table class="table table-striped table-hover">
		<thead>
			<tr>
				<th>{{i18n.t("map-settings-dialog.link-comment")}}</th>
				<th>{{i18n.t("map-settings-dialog.link-url")}}</th>
				<th></th>
			</tr>
		</thead>

		<tbody>
			<!-- eslint-disable-next-line vue/require-v-for-key -->
			<tr v-for="link in props.mapData.links">
				<td class="align-middle text-break">
					{{link.comment}}
				</td>
				<td>
					<MapSlugEdit
						:mapData="mapData"
						v-model="link.slug"
						readonly
					></MapSlugEdit>
				</td>
				<td class="td-buttons text-right">
					<button type="button" class="btn btn-secondary" @click="editLink = link">{{i18n.t("map-settings-dialog.edit-link")}}</button>
				</td>
			</tr>
		</tbody>
	</table>

	<MapSettingsEditLinkDialog
		v-if="editLink"
		:mapData="mapData"
		:mapLink="editLink"
		@update:mapLink="(link) => handleUpdateLink(link)"
		@hidden="editLink = undefined"
	></MapSettingsEditLinkDialog>
</template>