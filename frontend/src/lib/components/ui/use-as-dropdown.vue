<script setup lang="ts">
	import { toRef } from "vue";
	import type { ButtonSize } from "../../utils/bootstrap";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { type RouteDestination, UseAsType } from "../facil-map-context-provider/route-form-tab-context";
	import DropdownMenu from "./dropdown-menu.vue";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const searchBoxContext = toRef(() => context.components.searchBox);
	const routeFormContext = toRef(() => context.components.routeFormTab);
	const i18n = useI18n();

	const props = defineProps<{
		destination: RouteDestination;
		isDisabled?: boolean;
		size?: ButtonSize;
	}>();

	function useAs(as: UseAsType): void {
		routeFormContext.value!.useAs(props.destination, as);
		searchBoxContext.value!.activateTab(`fm${context.id}-route-form-tab`, { autofocus: true });
	}
</script>

<template>
	<DropdownMenu
		v-if="searchBoxContext && routeFormContext && context.settings.search"
		:size="props.size"
		:isDisabled="props.isDisabled"
		:label="i18n.t('use-as-dropdown.label')"
	>
		<li v-if="routeFormContext.hasFrom">
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs(UseAsType.BEFORE_FROM)"
			>{{i18n.t("use-as-dropdown.from-insert")}}</a>
		</li>

		<li>
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs(UseAsType.AS_FROM)"
			>{{routeFormContext.hasFrom ? i18n.t("use-as-dropdown.from-replace") : i18n.t("use-as-dropdown.from")}}</a>
		</li>

		<li>
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs(UseAsType.AFTER_FROM)"
			>{{routeFormContext.hasVia ? i18n.t("use-as-dropdown.via-first") : i18n.t("use-as-dropdown.via")}}</a>
		</li>

		<li v-if="routeFormContext.hasVia">
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs(UseAsType.BEFORE_TO)"
			>{{i18n.t("use-as-dropdown.via-last")}}</a>
		</li>

		<li>
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs(UseAsType.AS_TO)"
			>{{routeFormContext.hasTo ? i18n.t("use-as-dropdown.to-replace") : i18n.t("use-as-dropdown.to")}}</a>
		</li>

		<li v-if="routeFormContext.hasTo">
			<a
				href="javascript:"
				class="dropdown-item"
				@click="useAs(UseAsType.AFTER_TO)"
			>{{i18n.t("use-as-dropdown.to-insert")}}</a>
		</li>
	</DropdownMenu>
</template>