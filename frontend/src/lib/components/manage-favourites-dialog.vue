<script setup lang="ts">
	import storage, { type Favourite } from "../utils/storage";
	import Icon from "./ui/icon.vue";
	import Draggable from "vuedraggable";
	import { computed } from "vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { getClientSub, injectContextRequired } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../utils/i18n";

	const context = injectContextRequired();
	const clientSub = getClientSub(context);
	const i18n = useI18n();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const isFavourite = computed(() => {
		return !!clientSub.value && storage.favourites.some((favourite) => favourite.mapSlug == clientSub.value!.mapSlug);
	});

	function deleteFavourite(favourite: Favourite): void {
		const index = storage.favourites.indexOf(favourite);
		if (index != -1)
			storage.favourites.splice(index, 1);
	}

	function addFavourite(): void {
		storage.favourites.push({ mapSlug: clientSub.value!.mapSlug, mapId: clientSub.value!.data.mapData.id, name: clientSub.value!.data.mapData.name });
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('manage-favourites-dialog.title')"
		size="lg"
		class="fm-manage-favourites"
		@hidden="emit('hidden')"
	>
		<p>{{i18n.t("manage-favourites-dialog.introduction")}}</p>
		<table class="table table-striped table-hover">
			<thead>
				<tr>
					<th>{{i18n.t("manage-favourites-dialog.map-id")}}</th>
					<th>{{i18n.t("manage-favourites-dialog.name")}}</th>
					<th></th>
				</tr>
			</thead>
			<Draggable
				v-model="storage.favourites"
				tag="tbody"
				v-bind="{ handle: '.fm-drag-handle' } as any /* https://github.com/SortableJS/vue.draggable.next/issues/220 */"
				:itemKey="(favourite: any) => storage.favourites.indexOf(favourite)"
			>
				<template #item="{ element: favourite }">
					<tr>
						<td class="align-middle text-break" :class="{ 'font-weight-bold': clientSub && favourite.mapSlug == clientSub.mapSlug }">
							{{favourite.id}}
						</td>
						<td class="align-middle">
							<input class="form-control" v-model="favourite.customName" :placeholder="favourite.name" />
						</td>
						<td class="align-middle td-buttons text-right">
							<button type="button" class="btn btn-secondary" @click="deleteFavourite(favourite)">{{i18n.t("manage-favourites-dialog.delete")}}</button>
							<button type="button" class="btn btn-secondary fm-drag-handle"><Icon icon="resize-vertical" :alt="i18n.t('manage-favourites-dialog.reorder-alt')"></Icon></button>
						</td>
					</tr>
				</template>
			</Draggable>
			<tfoot v-if="clientSub && !isFavourite">
				<tr>
					<td colspan="3">
						<button type="button" class="btn btn-secondary" @click="addFavourite()">{{i18n.t("manage-favourites-dialog.favourite-current")}}</button>
					</td>
				</tr>
			</tfoot>
		</table>
	</ModalDialog>
</template>