<script setup lang="ts">
	import Sidebar from "../ui/sidebar.vue";
	import Icon from "../ui/icon.vue";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { ref } from "vue";
	import AddDropdown from "./add-dropdown.vue";
	import CollabMapsDropdown from "./collab-maps-dropdown.vue";
	import HelpDropdown from "./help-dropdown.vue";
	import MapStyleDropdown from "./map-style-dropdown.vue";
	import ToolsDropdown from "./tools-dropdown.vue";
	import ViewsDropdown from "./views-dropdown.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();

	const props = withDefaults(defineProps<{
		interactive?: boolean;
	}>(), {
		interactive: true
	});

	const sidebarVisible = ref(false);
</script>

<template>
	<div class="fm-toolbox">
		<a
			v-if="context.isNarrow"
			v-show="!sidebarVisible"
			href="javascript:"
			class="fm-toolbox-toggle"
			@click="sidebarVisible = true"
		><Icon icon="menu-hamburger"></Icon></a>

		<Sidebar :id="`fm${context.id}-toolbox-sidebar`" v-model:visible="sidebarVisible">
			<ul class="navbar-nav">
				<CollabMapsDropdown
					v-if="props.interactive"
					@hide-sidebar="sidebarVisible = false"
				></CollabMapsDropdown>

				<AddDropdown
					v-if="!client.readonly && client.padData"
					@hide-sidebar="sidebarVisible = false"
				></AddDropdown>

				<ViewsDropdown
					v-if="client.padData && (!client.readonly || Object.keys(client.views).length > 0)"
					@hide-sidebar="sidebarVisible = false"
				></ViewsDropdown>

				<MapStyleDropdown></MapStyleDropdown>

				<ToolsDropdown
					v-if="props.interactive || client.padData"
					:interactive="props.interactive"
					@hide-sidebar="sidebarVisible = false"
				></ToolsDropdown>

				<HelpDropdown
					@hide-sidebar="sidebarVisible = false"
				></HelpDropdown>
			</ul>
		</Sidebar>
	</div>
</template>

<style lang="scss">
	.fm-toolbox {
		position: absolute;
		top: 10px;
		right: 10px;

		&:hover {
			z-index: 1000;
		}

		.fm-toolbox-toggle {
			color: #444;
			border-radius: 4px;
			background: #fff;
			border: 2px solid rgba(0,0,0,0.2);
			width: 34px;
			height: 34px;
			display: flex;
			align-items: center;
			justify-content: center;

			&:hover {
				background: #f4f4f4;
			}
		}

		.fm-sidebar:not(.isNarrow) {
			opacity: .5;
			transition: opacity .7s;

			&:hover {
				opacity: 1;
			}
		}

		@media print {
			display: none;
		}
	}
</style>