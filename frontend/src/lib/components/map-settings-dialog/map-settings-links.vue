<!-- eslint-disable vue/no-mutating-props -->
<script setup lang="ts">
	import { getMainAdminLinkCandidates, type CRU, type MapData, type MapLink, type MergedUnion } from 'facilmap-types';
	import { useI18n } from '../../utils/i18n';
	import MapSlugEdit from "./map-slug-edit.vue";
	import MapSettingsEditLinkDialog from "./map-settings-edit-link-dialog.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { injectContextRequired, requireClientSub } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { computed, ref } from "vue";
	import { pull } from "lodash-es";
	import { generateRandomMapSlug } from "facilmap-utils";

	const props = defineProps<{
		mapData: MergedUnion<[MapData<CRU.CREATE>, Required<MapData<CRU.UPDATE>>]>;
	}>();

	const i18n = useI18n();
	const toasts = useToasts();

	const context = injectContextRequired();
	const clientSub = requireClientSub(context);

	const editLink = ref<MapLink<CRU.CREATE | CRU.UPDATE>>();
	const createLink = ref(false);

	const potentialAdminLinks = computed(() => getMainAdminLinkCandidates(props.mapData.links));

	function handleUpdateLink(link: MapLink<CRU.CREATE | CRU.UPDATE>) {
		const idx = props.mapData.links.indexOf(editLink.value!);
		if (idx !== -1) {
			props.mapData.links[idx] = link;
		} else if (createLink.value) {
			props.mapData.links.push(link);
		} else {
			toasts.showErrorToast(
				`fm${context.id}-map-settings-links-error`,
				() => i18n.t("map-settings-dialog.link-update-error"),
				() => i18n.t("map-settings-dialog.link-disappeared-error")
			);
		}
		editLink.value = link;
	}

	function deleteLink(link: MapLink<CRU.CREATE | CRU.UPDATE>) {
		pull(props.mapData.links, link);
	}

	function addLink() {
		editLink.value = {
			comment: "",
			slug: generateRandomMapSlug(),
			password: false,
			searchEngines: false,
			permissions: { admin: false, settings: false, update: false, read: true }
		};
		createLink.value = true;
	}

	function handleEditLinkHidden() {
		editLink.value = undefined;
		createLink.value = false;
	}
</script>

<template>
	<table class="table table-striped table-hover">
		<thead>
			<tr>
				<th>{{i18n.t("map-settings-dialog.link-description")}}</th>
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
					{{/* TODO: Disable deleting current link when map is open through token derived from it. */""}}
					<button
						v-if="(!('id' in link) || link.id !== clientSub.data.mapData.activeLink.id) && (potentialAdminLinks.length > 1 || link !== potentialAdminLinks[0])"
						type="button"
						@click="deleteLink(link)"
						class="btn btn-secondary"
					>
						{{i18n.t("map-settings-dialog.delete-link")}}
					</button>
				</td>
			</tr>
		</tbody>
		<tfoot>
			<tr>
				<td colspan="3">
					<button type="button" @click="addLink()" class="btn btn-secondary">
						{{i18n.t("map-settings-dialog.add-link")}}
					</button>
				</td>
			</tr>
		</tfoot>
	</table>

	<MapSettingsEditLinkDialog
		v-if="editLink"
		:mapData="mapData"
		:mapLink="editLink"
		:isCreate="createLink"
		@update:mapLink="(link) => handleUpdateLink(link)"
		@hidden="handleEditLinkHidden()"
	></MapSettingsEditLinkDialog>
</template>