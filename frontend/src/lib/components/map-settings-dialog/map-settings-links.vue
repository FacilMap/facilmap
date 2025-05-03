<script setup lang="ts">
	import type { CRU, MapData, MapLink } from 'facilmap-types';
	import { useI18n } from '../../utils/i18n';
	import MapSlugEdit from "./map-slug-edit.vue";
	import MapSettingsEditLinkDialog from "./map-settings-edit-link-dialog.vue";
	import { overwriteObject } from "facilmap-utils";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { ref } from "vue";

	const props = defineProps<{
		mapData: MapData<CRU.CREATE> | Required<MapData<CRU.UPDATE>>
	}>();

	const i18n = useI18n();
	const toasts = useToasts();

	const context = injectContextRequired();

	const editLink = ref<MapLink>();

	function handleUpdateLink(link: MapLink) {
		const idx = props.mapData.fields.indexOf(editLink.value!);
		if (idx === -1) {
			toasts.showErrorToast(
				`fm${context.id}-map-settings-links-error`,
				() => i18n.t("map-settings-dialog.link-update-error"),
				() => i18n.t("map-settings-dialog.link-disappeared-error")
			);
		}
		type.value.fields[idx] = field;
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
				<td class="align-middle">
					{{link.comment}}
				</td>
				<td>
					<MapSlugEdit
						:mapData="mapData"
						v-model="link.slug"
						readonly
					></MapSlugEdit>
				</td>
				<td>
					<button type="button" class="btn btn-secondary" @click="editLink = link">{{i18n.t("map-settings-dialog.edit-link")}}</button>
				</td>
			</tr>
		</tbody>
	</table>

	<MapSettingsEditLinkDialog
		v-if="editLink"
		:mapData="mapData"
		:mapLink="editLink"
		@update:mapLink="overwriteObject($event, editLink)"
		@hidden=""
	></MapSettings>
</template>