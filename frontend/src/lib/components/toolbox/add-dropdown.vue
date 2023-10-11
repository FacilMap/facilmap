<script setup lang="ts">
	import { Type } from "facilmap-types";
	import { drawLine, drawMarker } from "../../utils/draw";
	import { injectClientRequired } from "../../utils/client";
	import { ref } from "vue";
	import { injectMapComponentsRequired } from "../../utils/map-components";
	import { injectMapContextRequired } from "../../utils/map-context";
	// import ManageTypes from "../manage-types/manage-types.vue";
	import vLinkDisabled from "../../utils/link-disabled";

	const emit = defineEmits<{
		(type: "hide-sidebar"): void;
	}>();

	const client = injectClientRequired();
	const mapComponents = injectMapComponentsRequired();
	const mapContext = injectMapContextRequired();

	const dialog = ref<
		| "manage-types"
	>();

	function addObject(type: Type): void {
		if(type.type == "marker")
			addMarker(type);
		else if(type.type == "line")
			addLine(type);
	}

	function addMarker(type: Type): void {
		drawMarker(type, client.value, mapComponents.value);
	}

	function addLine(type: Type): void {
		drawLine(type, client.value, mapComponents.value);
	}
</script>

<template>
	<li class="nav-item dropdown">
		<a
			class="nav-link dropdown-toggle"
			href="javascript:"
			data-bs-toggle="dropdown"
			v-link-disabled="mapContext.interaction"
		>Add</a>
		<ul class="dropdown-menu dropdown-menu-end">
			<li v-for="type in client.types">
				<a
					class="dropdown-item"
					v-link-disabled="mapContext.interaction"
					href="javascript:"
					@click="addObject(type); emit('hide-sidebar')"
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
				>Manage types</a>
			</li>
		</ul>
	</li>

	<!-- <ManageTypes
		v-if="dialog === 'manage-types' && client.padData"
		@hidden="dialog = undefined"
	></ManageTypes> -->
</template>