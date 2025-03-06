<script setup lang="ts" generic="T extends 'node' | 'way' | 'relation' | 'changeset' | 'user'">
	import { computed } from "vue";
	import { useI18n } from "../../utils/i18n";
	import vTooltip from "../../utils/tooltip";
	import Icon from "../ui/icon.vue";

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
	<a
		:href="`https://www.openstreetmap.org/${encodeURIComponent(props.type)}/${encodeURIComponent(props.id)}`"
		target="_blank"
		v-tooltip="tooltip"
		class="fm-osm-feature-link"
	>
		<span>
			<span>
				<template v-if="props.label">
					{{props.label}}
				</template>
				<template v-else-if="props.type === 'node'">
					{{props.onlyId ? props.id : i18n.t("osm-feature-link.node", { id: props.id })}}
				</template>
				<template v-else-if="props.type === 'way'">
					{{props.onlyId ? props.id : i18n.t("osm-feature-link.way", { id: props.id })}}
				</template>
				<template v-else-if="props.type === 'relation'">
					{{props.onlyId ? props.id : i18n.t("osm-feature-link.relation", { id: props.id })}}
				</template>
				<template v-else-if="props.type === 'changeset'">
					{{props.onlyId ? props.id : i18n.t("osm-feature-link.changeset", { id: props.id })}}
				</template>
				<template v-else-if="props.type === 'user'">
					{{props.id}}
				</template>
			</span>
		</span>
		{{" "}}
		<Icon icon="new-window" size="1em"></Icon>
	</a>
</template>