<script setup lang="ts" generic="T extends 'node' | 'way' | 'relation' | 'changeset' | 'user'">
	import { computed } from "vue";
	import { useI18n } from "../../utils/i18n";
	import vTooltip from "../../utils/tooltip";
	import { getOsmFeatureLabel, getOsmFeatureUrl } from "facilmap-utils";
	import ExternalLink from "../ui/external-link.vue";

	const props = defineProps<{
		type: T;
		id: T extends "user" ? string : number;
		label?: string;
		onlyId?: boolean;
	}>();

	const i18n = useI18n();

	const tooltip = computed(() => (
		props.type === "node" ? i18n.t("osm-feature-link.node-tooltip") :
		props.type === "way" ? i18n.t("osm-feature-link.way-tooltip") :
		props.type === "relation" ? i18n.t("osm-feature-link.relation-tooltip") :
		props.type === "changeset" ? i18n.t("osm-feature-link.changeset-tooltip") :
		props.type === "user" ? i18n.t("osm-feature-link.user-tooltip") :
		""
	));
</script>

<template>
	<ExternalLink
		:href="getOsmFeatureUrl(props.type, props.id as any)"
		target="_blank"
		v-tooltip="tooltip"
		class="fm-osm-feature-link"
	>
		<template v-if="props.label">
			{{props.label}}
		</template>
		<template v-else-if="props.type === 'changeset'">
			{{props.onlyId ? props.id : i18n.t("common.changeset", { id: props.id })}}
		</template>
		<template v-else-if="props.type === 'user'">
			{{props.id}}
		</template>
		<template v-else>
			{{props.onlyId ? props.id : getOsmFeatureLabel(props.type, props.id as number)}}
		</template>
	</ExternalLink>
</template>