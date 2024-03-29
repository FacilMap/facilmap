<script setup lang="ts">
	import { toRef } from "vue";
	import type { ButtonSize } from "../../utils/bootstrap";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import type { RouteDestination } from "../facil-map-context-provider/route-form-tab-context";
	import DropdownMenu from "./dropdown-menu.vue";

	const context = injectContextRequired();
	const searchBoxContext = toRef(() => context.components.searchBox);
	const routeFormContext = toRef(() => context.components.routeFormTab);

	const props = defineProps<{
		destination: RouteDestination;
		isDisabled?: boolean;
		size?: ButtonSize;
	}>();

	function useAs(type: "from" | "via" | "to"): void {
		if (type === "from") {
			routeFormContext.value!.setFrom(props.destination);
		} else if (type === "via") {
			routeFormContext.value!.addVia(props.destination);
		} else if (type === "to") {
			routeFormContext.value!.setTo(props.destination);
		}

		searchBoxContext.value!.activateTab(`fm${context.id}-route-form-tab`, { autofocus: true });
	}
</script>

<template>
	<DropdownMenu
		v-if="searchBoxContext && routeFormContext && context.settings.search"
		:size="props.size"
		:isDisabled="props.isDisabled"
		label="Use as"
	>
		<li>
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs('from')"
			>Route start</a>
		</li>

		<li>
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs('via')"
			>Route via</a>
		</li>

		<li>
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs('to')"
			>Route destination</a>
		</li>
	</DropdownMenu>
</template>