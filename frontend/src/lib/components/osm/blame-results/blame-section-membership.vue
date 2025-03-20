<script setup lang="ts">
	import { getOsmFeatureName, type OsmFeatureBlameSection } from "facilmap-utils";
	import { computed, ref, type DeepReadonly } from "vue";
	import Icon from "../../ui/icon.vue";
	import Popover from "../../ui/popover.vue";
	import OsmFeatureLink from "../osm-feature-link.vue";
	import { T, useI18n } from "../../../utils/i18n";
	import vTooltip from "../../../utils/tooltip";

	const props = defineProps<{
		membership: DeepReadonly<OsmFeatureBlameSection["causingChanges"][number]["featureMembership"]>;
	}>();

	const i18n = useI18n();

	const infoButtonRef = ref<HTMLElement>();

	const show = ref(false);

	const members = computed(() => props.membership.map((m) => ({ ...m, name: getOsmFeatureName(m.feature.tags ?? {}, i18n.currentLanguage) })));
</script>

<template>
	<a
		v-if="members.length > 0"
		v-bind="$attrs"
		href="javascript:"
		class="fm-blame-section-membership"
		@click="show = !show"
		ref="infoButtonRef"
		v-tooltip="i18n.t('blame-section-membership.tooltip')"
	>
		<Icon icon="info-sign" :alt="i18n.t('blame-section-membership.alt')"></Icon>
	</a>
	<Popover
		:element="infoButtonRef"
		placement="bottom"
		class="fm-blame-section-membership-popover"
		hideOnOutsideClick
		v-model:show="show"
	>
		<h3>{{i18n.t("blame-section-membership.heading")}}</h3>
		<ul>
			{{/* eslint-disable-next-line vue/require-v-for-key */""}}
			<li v-for="member in members">
				<template v-if="member.role && member.name">
					<T k="blame-section-membership.member-with-name-role">
						<template #feature>
							<OsmFeatureLink :type="member.feature.type" :id="member.feature.id"></OsmFeatureLink>
						</template>
						<template #name>
							{{member.name}}
						</template>
						<template #role>
							{{member.role}}
						</template>
					</T>
				</template>
				<template v-else-if="member.role && !member.name">
					<T k="blame-section-membership.member-with-role">
						<template #feature>
							<OsmFeatureLink :type="member.feature.type" :id="member.feature.id"></OsmFeatureLink>
						</template>
						<template #role>
							{{member.role}}
						</template>
					</T>
				</template>
				<template v-else-if="!member.role && member.name">
					<T k="blame-section-membership.member-with-name">
						<template #feature>
							<OsmFeatureLink :type="member.feature.type" :id="member.feature.id"></OsmFeatureLink>
						</template>
						<template #name>
							{{member.name}}
						</template>
					</T>
				</template>
				<template v-else>
					<OsmFeatureLink :type="member.feature.type" :id="member.feature.id"></OsmFeatureLink>
				</template>
			</li>
		</ul>
	</Popover>
</template>

<style lang="scss">
	.fm-blame-section-membership-popover {
		ul {
			list-style-type: none;

			&, li {
				margin-left: 0;
				padding-left: 0;
			}
		}
	}
</style>