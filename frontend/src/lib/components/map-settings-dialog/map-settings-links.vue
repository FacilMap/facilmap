<script setup lang="ts">
	import type { CRU, MapData } from 'facilmap-types';
	import { useI18n } from '../../utils/i18n';

	const props = defineProps<{
		mapData: MapData<CRU.CREATE> | Required<MapData<CRU.UPDATE>>
	}>();

	const i18n = useI18n();
</script>

<template>
	<table class="table table-striped table-hover">
		<thead>
			<tr>
				<th>{{i18n.t("manage-settings-dialog.link-slug")}}</th>
				<th>{{i18n.t("manage-settings-dialog.link-password")}}</th>
				<th>{{i18n.t("manage-settings-dialog.link-comment")}}</th>
				<th></th>
			</tr>
		</thead>

		<tbody>
			<!-- eslint-disable-next-line vue/require-v-for-key -->
			<!-- <tr v-for="link in props.mapData.links">
				<MapSlugEdit
					:mapData="mapData"
					idProp="adminId"
					v-model="mapData.adminId"
					:label="i18n.t('map-settings-dialog.admin-link-label')"
					:description="i18n.t('map-settings-dialog.admin-link-description')"
					:getRandom="() => random('admin')"
				></MapSlugEdit>
			</tr> -->
		</tbody>
	</table>
</template>