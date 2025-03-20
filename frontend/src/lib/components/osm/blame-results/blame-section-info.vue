<script setup lang="ts">
	import { type OsmFeatureBlameSection } from "facilmap-utils";
	import { T, useI18n } from "../../../utils/i18n";
	import Icon from "../../ui/icon.vue";
	import ZoomToObjectButton from "../../ui/zoom-to-object-button.vue";
	import { getZoomDestinationForFeatureBlameSection } from "../../../utils/zoom";
	import { computed, type DeepReadonly } from "vue";
	import BlameSectionMembership from "./blame-section-membership.vue";
	import OsmFeatureLink from "../osm-feature-link.vue";
	import { injectContextRequired } from "../../facil-map-context-provider/facil-map-context-provider.vue";

	const props = withDefaults(defineProps<{
		section: DeepReadonly<OsmFeatureBlameSection>;
		showBackButton?: boolean;
		zoom?: number;
	}>(), {
		showBackButton: false
	});

	const emit = defineEmits<{
		back: [];
	}>();

	const context = injectContextRequired();
	const i18n = useI18n();

	const zoomDestination = computed(() => getZoomDestinationForFeatureBlameSection(props.section));
</script>

<template>
	<div class="fm-blame-section-info">
		<h2 class="text-break">
			<a v-if="showBackButton" href="javascript:" @click="emit('back')"><Icon icon="arrow-left"></Icon></a>
			{{props.section.timestamp}}
		</h2>
		<dl class="fm-search-box-collapse-point fm-search-box-dl">
			<dt>{{i18n.t("blame-section-info.changeset")}}</dt>
			<dd class="text-break">
				<template v-if="props.section.changeset.tags?.comment">
					<T k="blame-section-info.changeset-value" spans>
						<template #id>
							<OsmFeatureLink type="changeset" :id="props.section.changeset.id" onlyId></OsmFeatureLink>
						</template>
						<template #message>
							<span>{{props.section.changeset.tags.comment}}</span>
						</template>
					</T>
				</template>
				<template v-else>
					<OsmFeatureLink type="changeset" :id="props.section.changeset.id" onlyId></OsmFeatureLink>
				</template>
				<br />
				<a
					:href="`${context.baseUrl}#q=${encodeURIComponent(`changeset ${props.section.changeset.id}`)}`"
					target="_blank"
				>
					{{i18n.t("blame-section-info.changeset-analyze")}}
					{{" "}}
					<Icon icon="new-window" size="1em"></Icon>
				</a>
			</dd>

			<dt>{{i18n.t("blame-section-info.timestamp")}}</dt>
			<dd>{{props.section.timestamp}}</dd>

			<dt>{{i18n.t("blame-section-info.user")}}</dt>
			<dd>
				<Icon icon="square" :style="{ color: `#${props.section.user.colour}` }" />
				{{" "}}
				<OsmFeatureLink type="user" :id="props.section.user.name" onlyId></OsmFeatureLink>
			</dd>

			<dt>{{i18n.t("blame-section-info.created-modified")}}</dt>
			<dd>
				<ul>
					{{/* eslint-disable-next-line vue/require-v-for-key */""}}
					<li v-for="change in props.section.causingChanges">
						<OsmFeatureLink :type="change.feature.type" :id="change.feature.id" class="align-middle"></OsmFeatureLink>
						{{" "}}
						<BlameSectionMembership :membership="change.featureMembership" class="align-middle"></BlameSectionMembership>
					</li>
				</ul>
			</dd>
		</dl>

		<div class="btn-toolbar">
			<ZoomToObjectButton
				v-if="zoomDestination"
				:label="i18n.t('changeset-feature-info.zoom-to-feature-label')"
				size="sm"
				:destination="zoomDestination"
			></ZoomToObjectButton>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-blame-section-info {
		display: flex;
		flex-direction: column;
		min-height: 0;

		ul {
			list-style-type: none;

			&, li {
				margin-left: 0;
				padding-left: 0;
			}

			.fm-blame-section-membership, .fm-blame-section-membership * {
				display: inline-flex;
			}
		}

	}
</style>