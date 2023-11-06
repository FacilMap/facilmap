<script setup lang="ts">
	import { toRef } from "vue";
	import type { ButtonSize } from "../../utils/bootstrap";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import type { RouteDestination } from "../facil-map-context-provider/map-context";
	import DropdownMenu from "./dropdown-menu.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const searchBoxContext = toRef(() => context.components.searchBox);

	const props = defineProps<{
		destination: RouteDestination;
		isDisabled?: boolean;
		size?: ButtonSize;
	}>();

	function useAs(event: "route-set-from" | "route-add-via" | "route-set-to"): void {
		mapContext.value.emit(event, props.destination);
		searchBoxContext.value!.activateTab(`fm${context.id}-route-form-tab`);
	}
</script>

<template>
	<DropdownMenu
		v-if="searchBoxContext && context.settings.search"
		:size="props.size"
		:isDisabled="props.isDisabled"
		label="Use as"
	>
		<li>
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs('route-set-from')"
			>Route start</a>
		</li>

		<li>
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs('route-add-via')"
			>Route via</a>
		</li>

		<li>
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs('route-set-to')"
			>Route destination</a>
		</li>
	</DropdownMenu>
</template>