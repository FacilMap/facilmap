<script setup lang="ts">
	import $ from "jquery";
	import Icon from "../ui/icon.vue";
	import hammer from "hammerjs";
	import { type Ref, defineComponent, nextTick, onMounted, onScopeDispose, reactive, readonly, ref, toRef, watch } from "vue";
	import vTooltip, { hideAllTooltips } from "../../utils/tooltip";
	import type { SearchBoxEventMap, SearchBoxTab, WritableSearchBoxContext } from "../facil-map-context-provider/search-box-context";
	import mitt from "mitt";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);

	const tabs = reactive(new Map<string, SearchBoxTab>());
	const activeTabId = ref<string | undefined>();
	const tabHistory = ref<string[]>([]);

	function provideTab(id: string, tabRef: Ref<SearchBoxTab>) {
		if (tabs.has(id)) {
			throw new Error(`Tab with ID ${id} already present.`);
		}

		watch(tabRef, (tab) => {
			tabs.set(id, tab);
		}, { immediate: true });

		if (activeTabId.value == null) {
			activateTab(id, { autofocus: context.settings.autofocus });
		}

		onScopeDispose(() => {
			tabs.delete(id);

			const isActive = activeTabId.value === id;
			tabHistory.value = tabHistory.value.filter((v) => v !== id);
			if (isActive) {
				activeTabId.value = tabHistory.value[tabHistory.value.length - 1];
				if (restoreHeight.value && context.isNarrow && containerRef.value) {
					containerRef.value.style.flexBasis = `${restoreHeight.value}px`;
				}
				restoreHeight.value = undefined;
			}
		});
	}

	function activateTab(id: string, { expand = false, autofocus = false }: { expand?: boolean; autofocus?: boolean } = {}) {
		activeTabId.value = id;
		tabHistory.value.push(id);
		restoreHeight.value = undefined;

		if (expand) {
			nextTick(() => {
				doExpand();
			});
		}

		if (autofocus && !context.isNarrow) {
			nextTick(() => {
				containerRef.value?.querySelector<HTMLElement>(":scope > .card-body.active [autofocus],:scope > .card-body.active .fm-autofocus")?.focus();
			});
		}
	}

	const searchBoxContext: WritableSearchBoxContext = reactive(Object.assign(mitt<SearchBoxEventMap>(), {
		tabs,
		activeTabId: undefined,
		activeTab: undefined,
		provideTab,
		activateTab
	}));

	context.provideComponent("searchBox", toRef(readonly(searchBoxContext)));

	watch([
		activeTabId,
		() => activeTabId.value != null ? tabs.get(activeTabId.value) : undefined
	], ([tabId, tab]) => {
		searchBoxContext.activeTabId = tabId;
		searchBoxContext.activeTab = tab ? readonly(tab) : undefined;
	});

	const containerRef = ref<HTMLElement>();
	const cardHeaderRef = ref<HTMLElement>();
	const resizeHandleRef = ref<HTMLElement>();

	const isPanning = ref<boolean>();
	const panStartHeight = ref<number>();
	const restoreHeight = ref<number>();
	const resizeStartHeight = ref<number>();
	const resizeStartWidth = ref<number>();
	const hasFocus = ref(false);
	const isResizing = ref(false);

	onMounted(() => {
		const pan = new hammer.Manager(cardHeaderRef.value!);
		pan.add(new hammer.Pan({ direction: hammer.DIRECTION_VERTICAL }));
		pan.on("panstart", handlePanStart);
		pan.on("pan", handlePanMove);
		pan.on("panend", handlePanEnd);

		const resize = new hammer.Manager(resizeHandleRef.value!);
		resize.add(new hammer.Pan({ direction: hammer.DIRECTION_ALL }));
		resize.add(new hammer.Tap());
		resize.on("panstart", handleResizeStart);
		resize.on("pan", handleResizeMove);
		resize.on("panend", handleResizeEnd);
		resize.on("tap", handleResizeClick);
	});

	function handlePanStart(): void {
		isPanning.value = true;
		restoreHeight.value = undefined;
		panStartHeight.value = parseInt($(containerRef.value!).css("flex-basis"));
	}

	function handlePanMove(event: any): void {
		if (context.isNarrow && panStartHeight.value != null && event.srcEvent.type != "pointercancel")
			$(containerRef.value!).stop().css("flexBasis", `${getSanitizedHeight(panStartHeight.value - event.deltaY)}px`);
	}

	function handlePanEnd(): void {
		isPanning.value = false;
		mapContext.value.components.map.invalidateSize({ pan: false });
	}

	function getSanitizedHeight(height: number): number {
		const maxHeight = (containerRef.value!.offsetParent as HTMLElement).offsetHeight - 5;
		return Math.max(0, Math.min(maxHeight, height));
	}

	function doExpand(): void {
		if (context.isNarrow) {
			const currentHeight = parseInt(getComputedStyle(containerRef.value!).flexBasis);
			if (currentHeight < 120) {
				restoreHeight.value = currentHeight;
				containerRef.value!.style.flexBasis = '170px';
			}
		}
	}

	function handleResizeStart(): void {
		isResizing.value = true;
		resizeStartWidth.value = containerRef.value!.offsetWidth;
		resizeStartHeight.value = containerRef.value!.offsetHeight;
		hideAllTooltips();
		searchBoxContext.emit("resizestart");
	}

	function handleResizeMove(event: any): void {
		containerRef.value!.style.width = `${resizeStartWidth.value + event.deltaX}px`;
		containerRef.value!.style.height = `${resizeStartHeight.value + event.deltaY}px`;
		searchBoxContext.emit("resize");
	}

	function handleResizeEnd(): void {
		isResizing.value = false;
		searchBoxContext.emit("resizeend");
	}

	function handleResizeClick(): void {
		containerRef.value!.style.width = "";
		containerRef.value!.style.height = "";
		hideAllTooltips();
		searchBoxContext.emit("resizereset");
	}

	function handleFocusIn(e: FocusEvent): void {
		if ((e.target as HTMLElement).closest("input,textarea"))
			hasFocus.value = true;
	}

	function handleFocusOut(e: FocusEvent): void {
		hasFocus.value = false;
	}

	function handleTransitionEnd(): void {
		mapContext.value.components.map.invalidateSize({ pan: false });
	}

	const TabContent = defineComponent({
		props: {
			isActive: { type: Boolean, required: true },
			tabId: { type: String, required: true }
		},
		setup(props) {
			return () => searchBoxContext.tabs.get(props.tabId)?.content?.({ isActive: props.isActive });
		}
	});

	watch(() => searchBoxContext.activeTab?.hashQuery, (hashQuery) => {
		mapContext.value.setFallbackQuery(hashQuery);
	});
</script>

<template>
	<div
		class="card fm-search-box"
		v-show="searchBoxContext.tabs.size > 0"
		ref="containerRef"
		:class="{ isNarrow: context.isNarrow, hasFocus, isPanning }"
		@focusin="handleFocusIn"
		@focusout="handleFocusOut"
		@transitionend="handleTransitionEnd"
	>
		<div
			class="card-header"
			ref="cardHeaderRef"
			@contextmenu="($event as PointerEvent).pointerType === 'touch' && context.isNarrow && $event.preventDefault()"
		>
			<ul class="nav nav-tabs card-header-tabs">
				<li
					v-for="[tabId, tab] in searchBoxContext.tabs"
					:key="tabId"
					class="nav-item nav-link"
					:class="{ active: tabId === searchBoxContext.activeTabId }"
				> <!-- nav-link class on the <li> rather than the <a> so that we can have multiple <a> children -->
					<a
						:aria-current="tabId === searchBoxContext.activeTabId ? 'true' : undefined"
						href="javascript:"
						:class="{ active: tabId === searchBoxContext.activeTabId }"
						@click="searchBoxContext.activateTab(tabId, { expand: true, autofocus: true })"
					>{{tab.title}}</a>

					<a
						v-if="tab.onClose"
						href="javascript:"
						@click="tab.onClose()"
					><Icon icon="remove" alt="Close"></Icon></a>
				</li>
			</ul>
		</div>

		<template v-for="[tabId, tab] in searchBoxContext.tabs" :key="tabId">
			<div v-show="tabId === searchBoxContext.activeTabId" class="card-body" :class="[tab.class, { active: tabId === searchBoxContext.activeTabId }]">
				<TabContent :tabId="tabId" :isActive="tabId === searchBoxContext.activeTabId"></TabContent>
			</div>
		</template>

		<a
			v-show="!context.isNarrow"
			href="javascript:"
			class="fm-search-box-resize"
			v-tooltip.right="'Drag to resize, click to reset'"
			ref="resizeHandleRef"
		><Icon icon="resize-horizontal"></Icon></a>
	</div>

</template>

<style lang="scss">
	.fm-search-box.fm-search-box {
		&:not(.isNarrow) {
			position: absolute;
			top: 10px !important; /* Override drag position from narrow mode */
			left: 52px;
			max-height: calc(100% - 25px);
			min-width: 19rem;
			min-height: 6rem;
			width: 29.5rem;

			transition: opacity .7s,background-color .7s,border-color .7s;
			opacity: .7;

			&:hover,&.hasFocus {
				opacity: 1;
			}

			> .card-header .nav-tabs .nav-item {
				padding: 0;

				> :nth-child(1) {
					padding: 0.1rem 0.1rem 0.1rem 0.3rem;
				}

				> :nth-child(2) {
					padding: 0.1rem 0.3rem 0.1rem 0.1rem;
				}
			}
		}

		&.isNarrow {
			min-height: 55px;
			flex-basis: 55px;
			overflow: hidden;

			&:not(.isPanning) {
				transition: flex-basis 0.4s;
			}

			height: auto !important; /* Override resize height from non-narrow mode */
			width: auto !important; /* Override resize width from non-narrow mode */

			> .card-header {
				padding-top: 11px;
				position: relative;
				-webkit-touch-callout: none;

				::before {
					content: "";
					position: absolute;
					left: 0;
					right: 0;
					margin: 0 auto;
					top: 4px;
					border-top: 3px double #aaa;
					width: 40px;
				}
			}
		}

		> .card-body {
			display: flex;
			flex-direction: column;
			min-height: 0;
			overflow: auto;
		}

		> .card-header {
			display: flex;
			flex-direction: column;
			flex-shrink: 0;
			padding: 0.3rem 0.3rem 0 0.3rem;

			.nav-tabs {
				display: grid;
				grid-auto-columns: 1fr;
				grid-auto-flow: column;
				text-align: center;
				gap: 5px;
				margin: 0;

				.nav-item {
					min-width: 0;
					display: flex;

					a {
						text-decoration: inherit; // Set to none in ".nav-link" style, but apply that to the <li> rather than the <a>
					}

					> :nth-child(1) {
						flex-grow: 1;
						text-overflow: ellipsis;
						white-space: nowrap;
						overflow: hidden;
					}

					> :nth-child(2) {
						flex-shrink: 0;
					}
				}
			}
		}

		.fm-search-box-collapse-point {
			overflow: auto;
		}

		hr {
			width: 100%;
			margin: 0.5rem 0;
		}

		.list-group-item {
			padding: 0.5rem;
		}

		h2 {
			margin-top: 0;
			font-size: 1.6em;
			display: flex;
			align-items: center;
		}

		h3 {
			font-size: 1.2em;
		}

		* + h3 {
			margin-top: 15px;
		}

		dl.fm-search-box-dl {
			display: grid;
			grid-template-columns: 150px auto;
			gap: 5px;
			margin-bottom: 0.5rem;

			* {
				min-width: 0;
			}

			dd {
				margin-bottom: 0;
			}
		}

		.pos,.distance,.elevation {
			color: #888;
		}
	}


	.fm-search-box-resize {
		position: absolute;
		bottom: 0;
		right: 0;
		transform: translate(30%,30%) rotate(45deg);

		cursor: nwse-resize;
		border: 1px solid #ddd;
		border-radius: 1000px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, .075);
		background: #fff;
		color: #666;
		padding: 2px;

		display: flex;
		align-items: center;
		justify-content: center;

		.fm-icon {
			display: flex;
		}

		svg {
			width: 20px;
			height: 20px;
		}

		opacity: 0.5;
		transition: opacity .7s;

		/* .fm-search-box:not(:hover):not(.fm-hasResults):not(.fm-hasFocus) & {
			opacity: 0;
		} */

		.fm-search-box:hover &,.fm-search-box.hasFocus & {
			opacity: 1;
		}
	}
</style>