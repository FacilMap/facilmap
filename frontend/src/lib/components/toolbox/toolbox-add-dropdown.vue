<script setup lang="ts">
	import { Writable, type DeepReadonly, type Type } from "facilmap-types";
	import { drawLine, drawMarker } from "../../utils/draw";
	import { computed, ref } from "vue";
	import ManageTypesDialog from "../manage-types-dialog.vue";
	import vLinkDisabled from "../../utils/link-disabled";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientSub, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { formatTypeName, getOrderedTypes, sleep } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";

	const emit = defineEmits<{
		"hide-sidebar": [];
	}>();

	const context = injectContextRequired();
	const clientSub = requireClientSub(context);
	const mapContext = requireMapContext(context);
	const toasts = useToasts();
	const i18n = useI18n();

	const dialog = ref<
		| "manage-types"
	>();

	async function addObject(type: DeepReadonly<Type>): Promise<void> {
		if(type.type == "marker") {
			await sleep(0); // For some reason this is necessary for the dropdown to close itself
			drawMarker(type, context, toasts);
		} else if(type.type == "line") {
			await drawLine(type, context, toasts);
		}
	}

	const orderedTypes = computed(() => getOrderedTypes(clientSub.value.data.types));
</script>

<template>
	<DropdownMenu
		tag="li"
		class="nav-item"
		isLink
		:isDisabled="mapContext.interaction"
		buttonClass="nav-link"
		menuClass="dropdown-menu-end"
		:label="i18n.t('toolbox-add-dropdown.label')"
	>
		<li v-for="type in orderedTypes" :key="type.id">
			<a
				class="dropdown-item"
				v-link-disabled="mapContext.interaction"
				href="javascript:"
				@click="addObject(type); emit('hide-sidebar')"
				draggable="false"
			>{{formatTypeName(type.name)}}</a>
		</li>

		<li v-if="clientSub.data.mapData.writable == Writable.ADMIN">
			<hr class="dropdown-divider">
		</li>

		<li v-if="clientSub.data.mapData.writable == Writable.ADMIN">
			<a
				class="dropdown-item"
				v-link-disabled="!!mapContext.interaction"
				href="javascript:"
				@click="dialog = 'manage-types'; emit('hide-sidebar')"
				draggable="false"
			>{{i18n.t("toolbox-add-dropdown.manage-types")}}</a>
		</li>
	</DropdownMenu>

	<ManageTypesDialog
		v-if="dialog === 'manage-types' && clientSub"
		@hidden="dialog = undefined"
	></ManageTypesDialog>
</template>