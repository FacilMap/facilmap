<script setup lang="ts">
	import Sidebar from "../ui/sidebar.vue";
	import Icon from "../ui/icon.vue";
	import { ref } from "vue";
	import ToolboxAddDropdown from "./toolbox-add-dropdown.vue";
	import ToolboxCollabMapsDropdown from "./toolbox-collab-maps-dropdown.vue";
	import ToolboxHelpDropdown from "./toolbox-help-dropdown.vue";
	import ToolboxMapStyleDropdown from "./toolbox-map-style-dropdown.vue";
	import ToolboxToolsDropdown from "./toolbox-tools-dropdown.vue";
	import ToolboxViewsDropdown from "./toolbox-views-dropdown.vue";
	import { injectContextRequired, requireClientContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);

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
				<ToolboxCollabMapsDropdown
					v-if="props.interactive"
					@hide-sidebar="sidebarVisible = false"
				></ToolboxCollabMapsDropdown>

				<ToolboxAddDropdown
					v-if="!client.readonly && client.padData"
					@hide-sidebar="sidebarVisible = false"
				></ToolboxAddDropdown>

				<ToolboxViewsDropdown
					v-if="client.padData && (!client.readonly || Object.keys(client.views).length > 0)"
					@hide-sidebar="sidebarVisible = false"
				></ToolboxViewsDropdown>

				<ToolboxMapStyleDropdown></ToolboxMapStyleDropdown>

				<ToolboxToolsDropdown
					v-if="props.interactive || client.padData"
					:interactive="props.interactive"
					@hide-sidebar="sidebarVisible = false"
				></ToolboxToolsDropdown>

				<ToolboxHelpDropdown
					@hide-sidebar="sidebarVisible = false"
				></ToolboxHelpDropdown>
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