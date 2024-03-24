<script setup lang="ts">
	import type { Type } from "facilmap-types";
	import { drawLine, drawMarker } from "../../utils/draw";
	import { computed, ref } from "vue";
	import ManageTypesDialog from "../manage-types-dialog.vue";
	import vLinkDisabled from "../../utils/link-disabled";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { getOrderedTypes, sleep } from "facilmap-utils";

	const emit = defineEmits<{
		"hide-sidebar": [];
	}>();

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);
	const toasts = useToasts();

	const dialog = ref<
		| "manage-types"
	>();

	async function addObject(type: Type): Promise<void> {
		if(type.type == "marker") {
			await sleep(0); // For some reason this is necessary for the dropdown to close itself
			drawMarker(type, context, toasts);
		} else if(type.type == "line") {
			await drawLine(type, context, toasts);
		}
	}

	const orderedTypes = computed(() => getOrderedTypes(client.value.types));
</script>

<template>
	<DropdownMenu
		tag="li"
		class="nav-item"
		isLink
		:isDisabled="mapContext.interaction"
		buttonClass="nav-link"
		menuClass="dropdown-menu-end"
		label="Add"
	>
		<li v-for="type in orderedTypes" :key="type.id">
			<a
				class="dropdown-item"
				v-link-disabled="mapContext.interaction"
				href="javascript:"
				@click="addObject(type); emit('hide-sidebar')"
				draggable="false"
			>{{type.name}}</a>
		</li>

		<li v-if="client.writable == 2">
			<hr class="dropdown-divider">
		</li>

		<li v-if="client.writable == 2">
			<a
				class="dropdown-item"
				v-link-disabled="!!mapContext.interaction"
				href="javascript:"
				@click="dialog = 'manage-types'; emit('hide-sidebar')"
				draggable="false"
			>Manage types</a>
		</li>
	</DropdownMenu>

	<ManageTypesDialog
		v-if="dialog === 'manage-types' && client.padData"
		@hidden="dialog = undefined"
	></ManageTypesDialog>
</template>