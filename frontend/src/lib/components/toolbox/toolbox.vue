<script lang="ts">
	import Sidebar from "../ui/sidebar.vue";
	import Icon from "../ui/icon.vue";
	import { computed, ref, toRef, useCssModule, watchEffect } from "vue";
	import ToolboxAddDropdown from "./toolbox-add-dropdown.vue";
	import ToolboxCollabMapsDropdown from "./toolbox-collab-maps-dropdown.vue";
	import ToolboxHelpDropdown from "./toolbox-help-dropdown.vue";
	import ToolboxMapStyleDropdown from "./toolbox-map-style-dropdown.vue";
	import ToolboxToolsDropdown from "./toolbox-tools-dropdown.vue";
	import ToolboxViewsDropdown from "./toolbox-views-dropdown.vue";
	import { getClientSub, injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { isNarrowBreakpoint } from "../../utils/bootstrap";
	import { fixOnCleanup } from "../../utils/vue";
	import { Control, DomUtil, type Map } from "leaflet";
	import { canConfigureMap, getCreatableTypes } from "facilmap-utils";

	class CustomControl extends Control {
		override onAdd(map: Map) {
			return DomUtil.create("div", "leaflet-bar");
		}
	}
</script>

<script setup lang="ts">
	const context = injectContextRequired();
	const mapContext = toRef(() => context.components.map);
	const clientSub = getClientSub(context);

	const props = withDefaults(defineProps<{
		interactive?: boolean;
	}>(), {
		interactive: true
	});

	const styles = useCssModule();

	const sidebarVisible = ref(false);

	const menuButtonContainerRef = ref<HTMLElement>();

	const canAdd = computed(() => clientSub.value && (
		clientSub.value.activeLink.permissions.settings ||
		getCreatableTypes(clientSub.value.activeLink.permissions, Object.values(clientSub.value.data.types), true).length > 0
	));

	watchEffect((onCleanup_) => {
		const onCleanup = fixOnCleanup(onCleanup_);

		if (isNarrowBreakpoint() && mapContext.value) {
			const customControl = new CustomControl({ position: "topright" });
			customControl.addTo(mapContext.value.components.map);
			customControl._container.classList.add(styles["toggle-container"]);
			menuButtonContainerRef.value = customControl._container;

			onCleanup(() => {
				menuButtonContainerRef.value = undefined;
				customControl.remove();
			});
		}
	});
</script>

<template>
	<div class="fm-toolbox">
		<Teleport v-if="menuButtonContainerRef" :to="menuButtonContainerRef">
			<a
				v-show="!sidebarVisible"
				href="javascript:"
				class="fm-toolbox-toggle"
				@click="sidebarVisible = true"
			><Icon icon="menu-hamburger" size="1.5em"></Icon></a>
		</Teleport>

		<Sidebar :id="`fm${context.id}-toolbox-sidebar`" v-model:visible="sidebarVisible">
			<ul class="navbar-nav">
				<ToolboxCollabMapsDropdown
					v-if="props.interactive"
					@hide-sidebar="sidebarVisible = false"
				></ToolboxCollabMapsDropdown>

				<ToolboxAddDropdown
					v-if="canAdd"
					@hide-sidebar="sidebarVisible = false"
				></ToolboxAddDropdown>

				<ToolboxViewsDropdown
					v-if="clientSub && (canConfigureMap(clientSub.activeLink.permissions) || Object.keys(clientSub.data.views).length > 0)"
					@hide-sidebar="sidebarVisible = false"
				></ToolboxViewsDropdown>

				<ToolboxMapStyleDropdown></ToolboxMapStyleDropdown>

				<ToolboxToolsDropdown
					v-if="props.interactive || clientSub"
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

		.fm-sidebar.isNarrow {
			.navbar-nav {
				max-width: 100%;
			}
		}

		.fm-sidebar:not(.isNarrow) {
			opacity: .5;
			transition: opacity .7s;

			&:hover {
				opacity: 1;
			}
		}

		.fm-toolbox-new-window-item {
			display: flex;
			align-items: center;

			> span:nth-child(1) {
				flex-grow: 1;
			}

			> span:nth-child(2) {
				display: inline-flex;
				margin-left: 0.5rem;
			}
		}

		@media print {
			display: none;
		}
	}
</style>

<style lang="scss" module>
	.toggle-container > a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>