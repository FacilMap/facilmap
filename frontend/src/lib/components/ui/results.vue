<script lang="ts">
	import { computed, toRaw } from "vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import Icon from "../ui/icon.vue";
	import vTooltip from "../../utils/tooltip";
	import { vScrollIntoView } from "../../utils/vue";
	import { combineZoomDestinations, flyTo, type ZoomDestination } from "../../utils/zoom";
	import EllipsisOverflow from "../ui/ellipsis-overflow.vue";
	import { useI18n } from "../../utils/i18n";

	export type ResultsItem<T> = {
		key: string | number;
		object: T,
		icon?: string;
		iconTooltip?: string;
		iconColour?: string;
		className?: string;
		label: string;
		/** Shown in braces after the label link */
		labelSuffix?: string;
		ellipsisOverflow?: boolean;
		zoomDestination?: ZoomDestination;
		zoomTooltip?: string;
		canOpen: boolean | "faded";
		openTooltip?: string;
	};
</script>

<script setup lang="ts" generic="ObjectType">
	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		items: Array<ResultsItem<ObjectType>>;
		active: ObjectType[];
		/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
		unionZoom?: boolean;
		/** When clicking or selecting a search result, zoom to it. */
		autoZoom?: boolean;
	}>(), {
		unionZoom: false,
		autoZoom: false
	});

	const emit = defineEmits<{
		select: [object: ObjectType, toggle: boolean];
		open: [object: ObjectType];
	}>();

	const showZoom = computed(() => !props.autoZoom || props.unionZoom);

	const active = computed(() => {
		const rawActive = new Set(props.active.map((o) => toRaw(o)));
		return new Set(props.items.flatMap((item) => rawActive.has(toRaw(item.object)) ? [item.object] : []));
	});

	function zoomToSelectedItems(unionZoom: boolean): void {
		let dest = combineZoomDestinations(props.items.flatMap((item) => item.zoomDestination && active.value.has(item.object) ? [item.zoomDestination] : []));
		if (dest && unionZoom)
			dest = combineZoomDestinations([dest, { bounds: mapContext.value.components.map.getBounds() }]);
		if (dest)
			flyTo(mapContext.value.components.map, dest);
	}

	function handleClick(object: ObjectType, event: MouseEvent): void {
		const toggle = event.ctrlKey;
		selectItem(object, toggle);

		if (props.autoZoom) {
			setTimeout(() => { // Wait for selection to be applied
				zoomToSelectedItems(props.unionZoom);
			}, 0);
		}
	}

	function selectItem(object: ObjectType, toggle = false): void {
		emit("select", object, toggle);
	}

	function handleOpen(object: ObjectType): void {
		emit("open", object);
	}
</script>

<template>
	<ul class="fm-results list-group">
		<li
			v-for="item in items"
			:key="item.key"
			class="list-group-item"
			:class="[{ active: active.has(item.object) }, item.className]"
			v-scroll-into-view="active.has(item.object)"
		>
			<span class="text-break">
				<Icon v-if="item.icon" :icon="item.icon" v-tooltip="item.iconTooltip" class="me-1" :style="{ color: item.iconColour }" />
				<span class="fm-results-label" :class="{ 'ellipsis-overflow': item.ellipsisOverflow }">
					<a href="javascript:" @click="handleClick(item.object, $event)">
						<template v-if="item.ellipsisOverflow">
							<EllipsisOverflow :value="item.label"></EllipsisOverflow>
						</template>
						<template v-else>
							{{item.label}}
						</template>
					</a>
					<template v-if="item.labelSuffix">
						<span class="fm-results-label-suffix">{{" "}}({{item.labelSuffix}})</span>
					</template>
				</span>
			</span>

			<a
				v-if="showZoom && item.zoomDestination"
				href="javascript:"
				@click="flyTo(mapContext.components.map, item.zoomDestination)"
				v-tooltip.hover.left="item.zoomTooltip"
			><Icon icon="zoom-in" :alt="i18n.t('results.zoom-alt')"></Icon></a>

			<a
				v-if="item.canOpen"
				href="javascript:"
				@click="handleOpen(item.object)"
				v-tooltip.left="item.openTooltip"
				:class="item.canOpen === 'faded' ? 'opacity-25' : ''"
			><Icon icon="arrow-right" :alt="i18n.t('results.show-details-alt')"></Icon></a>
		</li>
	</ul>
</template>

<style lang="scss">
	.fm-results {
		.list-group-item {
			display: flex;
			align-items: center;
			padding: 0.5rem;

			> :first-child {
				flex-grow: 1;
			}

			> * + * {
				margin-left: 0.25rem;
			}

			span, a {
				display: inline-flex;
				align-items: center;
			}

			.fm-results-label:not(.ellipsis-overflow) {
				&, * {
					display: inline;
				}
			}
		}
	}
</style>