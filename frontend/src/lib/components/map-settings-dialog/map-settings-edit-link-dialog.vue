<script setup lang="ts">
	import { computed, ref, watch } from "vue";
	import { ADMIN_LINK_COMMENT, getMainAdminLink, type CRU, type MapData, type MapLink } from "facilmap-types";
	import { deI18nMapLinkComments, generateRandomMapSlug, i18nMapLinkComments, markdownInline, mergeObject } from "facilmap-utils";
	import { getUniqueId } from "../../utils/utils";
	import { cloneDeep, isEqual } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { getClientSub, injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import storage, { storagePersisted } from "../../utils/storage";
	import vTooltip from "../../utils/tooltip";
	import Icon from "../ui/icon.vue";
	import MapSettingsGeneral from "./map-settings-general.vue";
	import MapSettingsLinks from "./map-settings-links.vue";
	import MapSettingsDelete from "./map-settings-delete.vue";
	import MapSlugEdit from "./map-slug-edit.vue";
	import InfoPopover from "../ui/info-popover.vue";

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = getClientSub(context);

	const toasts = useToasts();
	const i18n = useI18n();

	const props = defineProps<{
		mapData: MapData<CRU.CREATE> | Required<MapData<CRU.UPDATE>>;
	}>();

	const emit = defineEmits<{
		hide: [];
		hidden: [];
	}>();

	const mapLinkModel = defineModel<MapLink<CRU.CREATE | CRU.UPDATE>>("mapLink", { required: true });

	const id = getUniqueId("fm-map-settings-edit-link");

	const mapLink = ref(cloneDeep(mapLinkModel.value));

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const isModified = computed(() => !isEqual(mapLink.value, mapLinkModel.value));

	const readType = computed({
		get: () => {
			return mapLink.value.permissions.read === "own" ? "own" : "all"
		},
		set: (type) => {
			if (type === "own") {
				mapLink.value.permissions.read = "own";
				if (mapLink.value.permissions.update === true) {
					mapLink.value.permissions.update = "own";
				}
			} else {
				mapLink.value.permissions.read = true;
			}
		}
	});

	const updateType = computed({
		get: () => {
			return (
				mapLink.value.permissions.read === "own" ? "read-own" :
				mapLink.value.permissions.update === "own" ? "update-own" :
				"all"
			);
		},
		set: (type) => {
			if (type === "read-own") {
				Object.assign(mapLink.value.permissions, { read: "own", update: "own" });
			} else if (type === "update-own") {
				Object.assign(mapLink.value.permissions, { read: true, update: "own" });
			} else {
				Object.assign(mapLink.value.permissions, { read: true, update: true });
			}
		}
	});

	const permissionLevel = computed({
		get: () => {
			return (
				mapLink.value.permissions.admin ? "admin" :
				mapLink.value.permissions.settings ? "settings" :
				mapLink.value.permissions.update ? "update" :
				mapLink.value.permissions.read ? "read" :
				""
			);
		},

		set: (level) => {
			if (level === "admin") {
				Object.assign(mapLink.value.permissions, { admin: true, settings: true, update: true, read: true });
			} else if (level === "settings") {
				Object.assign(mapLink.value.permissions, { admin: false, settings: true, update: true, read: true });
			} else if (level === "update") {
				Object.assign(mapLink.value.permissions, {
					admin: false,
					settings: false,
					update: mapLink.value.permissions.read === "own" || mapLink.value.permissions.update === "own" ? "own" : true,
					read: mapLink.value.permissions.read === "own" ? "own" : true
				});
			} else {
				Object.assign(mapLink.value.permissions, {
					admin: false,
					settings: false,
					update: false,
					read: mapLink.value.permissions.read === "own" ? "own" : true,
				});
			}
		}
	});

	watch(mapLinkModel, (newMapLink, oldMapLink) => {
		mergeObject(oldMapLink, newMapLink, mapLink.value);
	}, { deep: true });

	function save(): void {
		mapLinkModel.value = cloneDeep(mapLink.value);
		modalRef.value?.modal.hide();
	}

	function handleRowClick(event: MouseEvent, level: typeof permissionLevel["value"]): void {
		if (!(event.target as HTMLElement).closest("a,select,.fm-info-popover")) {
			permissionLevel.value = level;
		}
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('map-settings-edit-link-dialog.title')"
		class="fm-map-settings-edit-link"
		:isModified="isModified"
		ref="modalRef"
		@submit="save()"
		@hide="emit('hide')"
		@hidden="emit('hidden')"
	>
		<div class="row mb-3">
			<label :for="`${id}-slug-input`" class="col-sm-3 col-form-label text-break">{{i18n.t("map-settings-edit-link-dialog.comment")}}</label>
			<div class="col-sm-9 position-relative">
				<input type="text" class="form-control" v-model="mapLink.comment" />
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-slug-input`" class="col-sm-3 col-form-label text-break">{{i18n.t("map-settings-edit-link-dialog.url")}}</label>
			<div class="col-sm-9 position-relative">
				<MapSlugEdit
					:mapData="props.mapData"
					v-model="mapLink.slug"
				></MapSlugEdit>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-slug-input`" class="col-sm-3 col-form-label text-break">{{i18n.t("map-settings-edit-link-dialog.password")}}</label>
			<div class="col-sm-9 d-flex">
				<div class="form-check fm-form-check-large fm-form-check-with-label">
					<input
						class="form-check-input"
						type="checkbox"
						:id="`${id}-enable-password`"
						:checked="mapLink.password !== false"
						@change="mapLink.password = ($event.target as HTMLInputElement).checked ? '' : false"
					/>
					<label class="form-check-label text-nowrap" :for="`${id}-enable-password`">
						{{i18n.t("map-settings-edit-link-dialog.password-required")}}{{typeof mapLink.password === 'string' ? ':' : ''}}
					</label>
				</div>

				<template v-if="typeof mapLink.password === 'string'">
					<div class="input-group ms-2">
						<input
							type="password"
							class="form-control ms-2"
							v-model="mapLink.password"
						/>
						<button
							type="button"
							class="btn btn-secondary"
							v-tooltip="i18n.t('map-settings-edit-link-dialog.password-reset-tooltip')"
							@click="mapLink.password = mapLinkModel.password"
						>
							<Icon icon="rotate-left" :alt="i18n.t('map-settings-edit-link-dialog.password-reset-alt')"></Icon>
						</button>
					</div>
				</template>
				<template v-else-if="mapLink.password === true">
					<button
						type="button"
						class="btn btn-link"
					>
						{{i18n.t("map-settings-edit-link-dialog.password-change")}}
					</button>
				</template>
			</div>
		</div>

		<div class="row mb-3">
			<label :for="`${id}-slug-input`" class="col-sm-3 col-form-label text-break">{{i18n.t("map-settings-edit-link-dialog.permissions")}}</label>
			<div class="col-sm-9">
				<table class="table table-striped fm-map-settings-edit-link-permission-level">
					<tbody>
						<tr @click="handleRowClick($event, 'read')">
							<td class="align-middle">
								<div class="form-check fm-form-check-large">
									<input
										class="form-check-input"
										type="radio"
										:name="`${id}-permission-level`"
										:id="`${id}-permission-level-read`"
										v-model="permissionLevel"
										value="read"
									/>
									<label class="form-check-label" :for="`${id}-permission-level-read`">
										{{i18n.t("map-settings-edit-link-dialog.read")}}
									</label>
								</div>
							</td>

							<td>
								<select v-if="permissionLevel === 'read'" class="form-select" v-model="readType">
									<option value="all">{{i18n.t("map-settings-edit-link-dialog.all")}}</option>
									<option value="own">{{i18n.t("map-settings-edit-link-dialog.own")}}</option>
								</select>
							</td>

							<td>
								<InfoPopover placement="right" size="1.5em">
									<div v-html="markdownInline(i18n.t('map-settings-edit-link-dialog.read-description'), true)"></div>
								</InfoPopover>
							</td>
						</tr>

						<tr @click="handleRowClick($event, 'update')">
							<td class="align-middle">
								<div class="form-check fm-form-check-large">
									<input
										class="form-check-input"
										type="radio"
										:name="`${id}-permission-level`"
										:id="`${id}-permission-level-edit`"
										v-model="permissionLevel"
										value="update"
									/>
									<label class="form-check-label" :for="`${id}-permission-level-edit`">
										{{i18n.t("map-settings-edit-link-dialog.edit")}}
									</label>
								</div>
							</td>

							<td>
								<select v-if="permissionLevel === 'update'" class="form-select" v-model="updateType">
									<option v-if="readType === 'all'" value="all">{{i18n.t("map-settings-edit-link-dialog.all")}}</option>
									<option value="update-own">{{i18n.t("map-settings-edit-link-dialog.edit-own")}}</option>
									<option value="read-own">{{i18n.t("map-settings-edit-link-dialog.read-own")}}</option>
								</select>
							</td>

							<td>
								<InfoPopover placement="right" size="1.5em">
									<div v-html="markdownInline(i18n.t('map-settings-edit-link-dialog.edit-description'), true)"></div>
								</InfoPopover>
							</td>
						</tr>

						<tr @click="handleRowClick($event, 'settings')">
							<td>
								<div class="form-check fm-form-check-large">
									<input
										class="form-check-input"
										type="radio"
										:name="`${id}-permission-level`"
										:id="`${id}-permission-level-configure`"
										v-model="permissionLevel"
										value="settings"
									/>
									<label class="form-check-label" :for="`${id}-permission-level-configure`">
										{{i18n.t("map-settings-edit-link-dialog.configure")}}
									</label>
								</div>
							</td>

							<td></td>

							<td>
								<InfoPopover placement="right" size="1.5em">
									<div v-html="markdownInline(i18n.t('map-settings-edit-link-dialog.configure-description'), true)"></div>
								</InfoPopover>
							</td>
						</tr>

						<tr @click="handleRowClick($event, 'admin')">
							<td>
								<div class="form-check fm-form-check-large">
									<input
										class="form-check-input"
										type="radio"
										:name="`${id}-permission-level`"
										:id="`${id}-permission-level-administrate`"
										v-model="permissionLevel"
										value="admin"
									/>
									<label class="form-check-label" :for="`${id}-permission-level-administrate`">
										{{i18n.t("map-settings-edit-link-dialog.administrate")}}
									</label>
								</div>
							</td>

							<td></td>

							<td>
								<InfoPopover placement="right" size="1.5em">
									<div v-html="markdownInline(i18n.t('map-settings-edit-link-dialog.administrate-description'), true)"></div>
								</InfoPopover>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</ModalDialog>
</template>

<style type="scss">
	.fm-map-settings-edit-link {

		.fm-map-settings-edit-link-permission-level {
			td {
				vertical-align: middle;
			}

			td:first-child {
				width: 1px;
			}

			td:last-child {
				text-align: right;
			}

			tr {
				height: calc(3.25rem + 3px);
			}
		}

	}
</style>