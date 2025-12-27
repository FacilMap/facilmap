<script setup lang="ts">
	import Icon from "../ui/icon.vue";
	import { type Ref, computed, defineComponent, nextTick, onScopeDispose, reactive, readonly, ref, toRef, watch } from "vue";
	import vTooltip from "../../utils/tooltip";
	import type { SearchBoxEventMap, SearchBoxTab, WritableSearchBoxContext } from "../facil-map-context-provider/search-box-context";
	import mitt from "mitt";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import { useDrag } from "../../utils/drag";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const tabs = reactive(new Map<string, SearchBoxTab>());
	const activeTabId = ref<string | undefined>();
	const tabHistory = ref<string[]>([]);

	const visible = computed(() => tabs.size > 0);

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
				if (restoreHeight.value != null && context.isNarrow && containerRef.value) {
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
			void nextTick(() => {
				doExpand();
			});
		}

		if (autofocus && !context.isNarrow) {
			void nextTick(() => {
				containerRef.value?.querySelector<HTMLElement>(":scope > .card-body.active [autofocus],:scope > .card-body.active .fm-autofocus")?.focus();
			});
		}
	}

	const searchBoxContext: WritableSearchBoxContext = reactive(Object.assign(mitt<SearchBoxEventMap>(), {
		visible,
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

	const restoreHeight = ref<number>();
	const hasFocus = ref(false);

	const panDrag = useDrag(cardHeaderRef, {
		onDragStart: () => {
			restoreHeight.value = undefined;
			return { height: parseInt(getComputedStyle(containerRef.value!).flexBasis) };
		},

		onDrag: ({ deltaY, customData }) => {
			if (context.isNarrow) {
				containerRef.value!.style.flexBasis = `${getSanitizedHeight(customData.height - deltaY)}px`;
			}
		},

		onDragEnd: () => {
			mapContext.value.components.map.invalidateSize({ pan: false });
		}
	});

	function getSanitizedHeight(height: number): number {
		const maxHeight = (containerRef.value!.offsetParent as HTMLElement).offsetHeight - 5;
		return Math.max(0, Math.min(maxHeight, height));
	}

	function doExpand(): void {
		if (context.isNarrow) {
			const currentHeight = parseInt(getComputedStyle(containerRef.value!).flexBasis);
			if (currentHeight < 120) {
				restoreHeight.value = currentHeight;
				const mapHeight = (containerRef.value!.offsetParent as HTMLElement).offsetHeight;
				const defaultHeight = Math.min(Math.max(170, mapHeight / 2), 200);
				containerRef.value!.style.flexBasis = `${defaultHeight}px`;
			}
		}
	}

	const resizeDrag = useDrag(resizeHandleRef, {
		onDragStart: () => {
			searchBoxContext.emit("resizestart");
			return { width: containerRef.value!.offsetWidth, height: containerRef.value!.offsetHeight };
		},

		onDrag: ({ deltaX, deltaY, customData }) => {
			containerRef.value!.style.width = `${customData.width + deltaX}px`;
			containerRef.value!.style.height = `${customData.height + deltaY}px`;
			searchBoxContext.emit("resize");
		},

		onDragEnd: () => {
			searchBoxContext.emit("resizeend");
		},

		onClick: () => {
			containerRef.value!.style.width = "";
			containerRef.value!.style.height = "";
			searchBoxContext.emit("resizereset");
		}
	});

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
		v-show="visible"
		ref="containerRef"
		:class="{ isNarrow: context.isNarrow, hasFocus, isPanning: panDrag.isDragging }"
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
						draggable="false"
					>{{tab.title}}</a>

					<a
						v-if="tab.onClose"
						href="javascript:"
						@click="tab.onClose()"
						draggable="false"
					><Icon icon="remove" :alt="i18n.t('search-box.close-alt')"></Icon></a>
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
			v-tooltip.right="resizeDrag.isDragging ? undefined : i18n.t('search-box.resize-tooltip')"
			ref="resizeHandleRef"
		><Icon icon="resize-horizontal"></Icon></a>
	</div>

</template>

<style lang="scss">
	.fm-search-box.fm-search-box {
		&:not(.isNarrow) {
			position: absolute;
			top: calc(10px + var(--facilmap-inset-top)) !important; /* Override drag position from narrow mode */
			left: calc(52px + var(--facilmap-inset-left));
			max-height: calc(100% - 25px - var(--facilmap-inset-top) - var(--facilmap-inset-bottom));
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
				padding-left: var(--facilmap-inset-left, 0px);
				padding-right: var(--facilmap-inset-right, 0px);
				position: relative;
				-webkit-touch-callout: none;
				cursor: row-resize;

				&::before {
					content: "";
					position: absolute;
					left: 0;
					right: 0;
					margin: 0 auto;
					top: 4px;
					border-top: 3px double #aaa;
					width: 40px;
				}

				> .nav {
					cursor: default;
				}
			}

			&.isPanning > .card-header {
				cursor: row-resize;

				> * {
					// Prevent click event on drag end (see https://stackoverflow.com/a/59957886/242365)
					pointer-events: none;
				}
			}

			> .card-body {
				margin-left: var(--facilmap-inset-left, 0px);
				margin-right: var(--facilmap-inset-right, 0px);
				margin-bottom: var(--facilmap-inset-bottom, 0px);
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
						&, > .fm-icon {
							flex-shrink: 0;
							display: inline-flex;
							align-items: center;
						}
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
		box-shadow: 0 1px 2px rgba(var(--bs-body-color), .075);
		background: var(--bs-body-bg);
		color: var(--bs-secondary-text-emphasis);
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

		&:hover {
			z-index: 10;
		}
	}
</style>