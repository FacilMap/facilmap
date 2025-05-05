<script setup lang="ts">
	import { computed, watchEffect } from "vue";
	import { entries, type ID, type MapPermissions } from "facilmap-types";
	import { formatFieldName, formatTypeName, getOrderedTypes, markdownInline } from "facilmap-utils";
	import { getUniqueId } from "../../utils/utils";
	import { injectContextRequired, requireClientSub } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import InfoPopover from "../ui/info-popover.vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import Icon from "../ui/icon.vue";
	import vTooltip from "../../utils/tooltip";

	const context = injectContextRequired();
	const clientSub = requireClientSub(context);

	const i18n = useI18n();

	const permissions = defineModel<MapPermissions>("permissions", { required: true });

	const id = getUniqueId("fm-map-permissions-edit");

	const orderedTypes = computed(() => getOrderedTypes(clientSub.value.data?.types));
	const addableTypes = computed(() => orderedTypes.value.filter((t) => !permissions.value.types?.[t.id]));

	watchEffect(() => {
		console.log(orderedTypes.value, permissions.value.types, addableTypes.value);
	});

	const readType = computed({
		get: () => {
			return permissions.value.read === "own" ? "own" : permissions.value.read ? "all" : "none";
		},
		set: (type) => {
			if (type === "none") {
				permissions.value.read = false;
			} else if (type === "own") {
				permissions.value.read = "own";
			} else {
				permissions.value.read = true;
			}
		}
	});

	const updateType = computed({
		get: () => {
			return (
				permissions.value.read === "own" ? "read-own" :
				permissions.value.update === "own" ? "update-own" :
				"all"
			);
		},
		set: (type) => {
			if (type === "read-own") {
				Object.assign(permissions.value, { read: "own", update: "own" });
			} else if (type === "update-own") {
				Object.assign(permissions.value, { read: true, update: "own" });
			} else {
				Object.assign(permissions.value, { read: true, update: true });
			}
		}
	});

	const permissionLevel = computed({
		get: () => {
			return (
				permissions.value.admin ? "admin" :
				permissions.value.settings ? "settings" :
				permissions.value.update ? "update" :
				"read"
			);
		},

		set: (level) => {
			if (level === "admin") {
				Object.assign(permissions.value, { admin: true, settings: true, update: true, read: true });
			} else if (level === "settings") {
				Object.assign(permissions.value, { admin: false, settings: true, update: true, read: true });
			} else if (level === "update") {
				Object.assign(permissions.value, {
					admin: false,
					settings: false,
					update: permissions.value.read === "own" || permissions.value.update === "own" ? "own" : true,
					read: permissions.value.read === "own" ? "own" : true
				});
			} else if (level === "read") {
				Object.assign(permissions.value, {
					admin: false,
					settings: false,
					update: false,
					read: permissions.value.read === "own" ? "own" : true
				});
			} else {
				Object.assign(permissions.value, {
					admin: false,
					settings: false,
					update: false,
					read: false
				});
			}
		}
	});

	const typeOverrides = computed(() => entries(permissions.value.types ?? {}).map(([typeId, pt]) => {
		const type = clientSub.value.data.types[typeId];
		const fieldsById = type ? Object.fromEntries(type.fields.map((f) => [f.id, f])) : {};

		return {
			typeId: typeId ? Number(typeId) : typeId,
			name: type ? formatTypeName(type.name) : typeId,
			fields: [["", pt] as const, ...entries(pt.fields ?? {})].map(([fieldId, pf]) => {
				const field = fieldId ? fieldsById[fieldId] : undefined;
				return {
					fieldId: fieldId ? Number(fieldId) : fieldId,
					name: !fieldId ? i18n.t("map-permissions-edit.attributes") : field ? formatFieldName(field.name) : fieldId,
					level: computed({
						get: () => (
							pf.read === true && pf.update === true ? "read-all-edit-all" :
							pf.read === true && pf.update === "own" ? "read-all-edit-own" :
							pf.read === true ? "read-all" :
							pf.read === "own" && pf.update === "own" ? "read-own-edit-own" :
							pf.read === "own" ? "read-own" :
							"hidden"
						),
						set: (level) => {
							if (level === "read-all-edit-all") {
								Object.assign(pf, { read: true, update: true });
							} else if (level === "read-all-edit-own") {
								Object.assign(pf, { read: true, update: "own" });
							} else if (level === "read-all") {
								Object.assign(pf, { read: true, update: false });
							} else if (level === "read-own-edit-own") {
								Object.assign(pf, { read: "own", update: "own" });
							} else if (level === "read-own") {
								Object.assign(pf, { read: "own", update: false });
							} else {
								Object.assign(pf, { read: false, update: false });
							}
						}
					})
				};
			}),
			addableFields: type ? type.fields.filter((f) => !pt.fields || !Object.hasOwn(pt.fields, f.id)) : []
		};
	}));

	function handleRowClick(event: MouseEvent, level: typeof permissionLevel["value"]): void {
		if (!(event.target as HTMLElement).closest("a,select,.fm-info-popover")) {
			permissionLevel.value = level;
		}
	}

	function addTypeOverride(typeId: ID): void {
		if (!permissions.value.types) {
			permissions.value.types = {};
		}

		permissions.value.types[typeId] = { read: false, update: false };
	}

	function deleteTypeOverride(typeId: ID | `${ID}`): void {
		delete permissions.value.types![typeId];
		if (Object.keys(permissions.value.types!).length === 0) {
			delete permissions.value.types;
		}
	}

	function addFieldOverride(typeId: ID, fieldId: ID): void {
		if (!permissions.value.types![typeId].fields) {
			permissions.value.types![typeId].fields = {};
		}

		permissions.value.types![typeId].fields![fieldId] = { read: false, update: false };
	}

	function deleteFieldOverride(typeId: ID | `${ID}`, fieldId: ID | `${ID}`): void {
		delete permissions.value.types![typeId].fields![fieldId];
		if (Object.keys(permissions.value.types![typeId].fields!).length === 0) {
			delete permissions.value.types![typeId].fields;
		}
	}
</script>

<template>
	<div class="fm-map-permissions-edit">
		<table class="table table-striped fm-map-permissions-edit-level">
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
								{{i18n.t("map-permissions-edit.read")}}
							</label>
						</div>
					</td>

					<td>
						<select v-if="permissionLevel === 'read'" class="form-select" v-model="readType">
							<option value="all">{{i18n.t("map-permissions-edit.read-all")}}</option>
							<option value="own">{{i18n.t("map-permissions-edit.read-own")}}</option>
							<option value="hidden">{{i18n.t("map-permissions-edit.hidden")}}</option>
						</select>
					</td>

					<td>
						<InfoPopover placement="right" size="1.5em">
							<div v-html="markdownInline(i18n.t('map-permissions-edit.read-description'), true)"></div>
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
								{{i18n.t("map-permissions-edit.edit")}}
							</label>
						</div>
					</td>

					<td>
						<select v-if="permissionLevel === 'update'" class="form-select" v-model="updateType">
							<option value="all">{{i18n.t("map-permissions-edit.read-all-edit-all")}}</option>
							<option value="update-own">{{i18n.t("map-permissions-edit.read-all-edit-own")}}</option>
							<option value="read-own">{{i18n.t("map-permissions-edit.read-own-edit-own")}}</option>
						</select>
					</td>

					<td>
						<InfoPopover placement="right" size="1.5em">
							<div v-html="markdownInline(i18n.t('map-permissions-edit.edit-description'), true)"></div>
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
								{{i18n.t("map-permissions-edit.configure")}}
							</label>
						</div>
					</td>

					<td></td>

					<td>
						<InfoPopover placement="right" size="1.5em">
							<div v-html="markdownInline(i18n.t('map-permissions-edit.configure-description'), true)"></div>
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
								{{i18n.t("map-permissions-edit.administrate")}}
							</label>
						</div>
					</td>

					<td></td>

					<td>
						<InfoPopover placement="right" size="1.5em">
							<div v-html="markdownInline(i18n.t('map-permissions-edit.administrate-description'), true)"></div>
						</InfoPopover>
					</td>
				</tr>
			</tbody>
		</table>

		<template v-for="type in typeOverrides" :key="type.typeId">
			<hr />
			<div class="d-flex mb-2 align-items-center">
				<h5 class="flex-grow-1 mb-0">{{i18n.t("map-permissions-edit.type-override-heading", { typeName: type.name })}}</h5>
				<button
					type="button"
					class="btn btn-secondary btn-sm me-2"
					@click="deleteTypeOverride(type.typeId)"
					v-tooltip="i18n.t('map-permissions-edit.type-override-remove-tooltip')"
				>
					<Icon icon="remove" :alt="i18n.t('map-permissions-edit.type-override-remove-alt')"></Icon>
				</button>
			</div>
			<table class="table table-striped fm-map-permissions-edit-level">
				<tbody>
					<tr v-for="field in type.fields" :key="field.fieldId">
						<td>
							{{field.name}}
						</td>

						<td>
							<select class="form-select" v-model="field.level.value">
								<option value="hidden">{{i18n.t("map-permissions-edit.hidden")}}</option>
								<option value="read-own">{{i18n.t("map-permissions-edit.read-own")}}</option>
								<option value="read-all">{{i18n.t("map-permissions-edit.read-all")}}</option>
								<option value="read-own-edit-own">{{i18n.t("map-permissions-edit.read-own-edit-own")}}</option>
								<option value="read-all-edit-own">{{i18n.t("map-permissions-edit.read-all-edit-own")}}</option>
								<option value="read-all-edit-all">{{i18n.t("map-permissions-edit.read-all-edit-all")}}</option>
							</select>
						</td>

						<td>
							<button
								type="button"
								class="btn btn-secondary btn-sm"
								@click="field.fieldId !== '' && deleteFieldOverride(type.typeId, field.fieldId)"
								:disabled="field.fieldId === ''"
								:style="field.fieldId === '' ? 'visibility: hidden' : ''"
							>
								<Icon icon="remove" :alt="i18n.t('map-permissions-edit.type-override-remove-alt')"></Icon>
							</button>
						</td>
					</tr>

					<tr v-if="type.addableFields.length > 0">
						<td>
							<DropdownMenu
								:label="i18n.t('map-permissions-edit.field')"
							>
								<li v-for="field in type.addableFields" :key="field.id">
									<a
										href="javascript:"
										class="dropdown-item"
										@click="addFieldOverride(type.typeId, field.id)"
									>{{formatFieldName(field.name)}}</a>
								</li>
							</DropdownMenu>
						</td>
						<td></td>
						<td></td>
					</tr>
				</tbody>
			</table>
		</template>

		<hr />

		<DropdownMenu
			v-if="addableTypes.length > 0"
			:label="i18n.t('map-permissions-edit.type-override-add')"
		>
			<li v-for="type in addableTypes" :key="type.id">
				<a
					href="javascript:"
					class="dropdown-item"
					@click="addTypeOverride(type.id)"
				>{{formatTypeName(type.name)}}</a>
			</li>
		</DropdownMenu>
	</div>
</template>

<style lang="scss">
	.fm-map-permissions-edit {

		.fm-map-permissions-edit-level {
			td {
				vertical-align: middle;
			}

			td:nth-child(2) {
				width: 200px;
			}

			td:last-child {
				width: 1px;
				text-align: right;
			}

			tr {
				height: calc(3.25rem + 3px);
			}
		}

	}
</style>