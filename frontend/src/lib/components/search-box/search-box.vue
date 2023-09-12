<script setup lang="ts">
	import WithRender from "./search-box.vue";
	import Vue from "vue";
	import { Component, ProvideReactive, Ref } from "vue-property-decorator";
	import "./search-box.scss";
	import $ from "jquery";
	import { BTab } from "bootstrap-vue";
	import Icon from "../ui/icon/icon";
	import SearchFormTab from "../search-form/search-form-tab";
	import MarkerInfoTab from "../marker-info/marker-info-tab";
	import LineInfoTab from "../line-info/line-info-tab";
	import hammer from "hammerjs";
	import { InjectContext, InjectMapComponents, InjectMapContext, SEARCH_BOX_CONTEXT_INJECT_KEY } from "../../utils/decorators";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import RouteFormTab from "../route-form/route-form-tab";
	import { HashQuery } from "facilmap-leaflet";
	import MultipleInfoTab from "../multiple-info/multiple-info-tab";
	import { Context } from "../facilmap/facilmap";
	import { PortalTarget } from "portal-vue";
	import OverpassInfoTab from "../overpass-info/overpass-info-tab";
	import OverpassFormTab from "../overpass-form/overpass-form-tab";

	export type SearchBoxContext = Vue;

	@WithRender
	@Component({
		components: { Icon, LineInfoTab, MarkerInfoTab, MultipleInfoTab, OverpassInfoTab, OverpassFormTab, PortalTarget, RouteFormTab, SearchFormTab }
	})
	export default class SearchBox extends Vue {

		@InjectContext() context!: Context;
		@InjectMapComponents() mapComponents!: MapComponents;
		@InjectMapContext() mapContext!: MapContext;

		@ProvideReactive(SEARCH_BOX_CONTEXT_INJECT_KEY) searchBoxContext = new Vue();

		@Ref() tabsComponent!: any;
		@Ref() searchBox!: HTMLElement;
		@Ref() resizeHandle!: HTMLElement;
		cardHeader!: HTMLElement;

		tab = 0;
		tabHistory = [0];
		panStartHeight: number | null = null;
		restoreHeight: number | null = null;
		resizeStartHeight: number | null = null;
		resizeStartWidth: number | null = null;
		hasFocus = false;
		isResizing = false;
		isMounted = false;

		mounted(): void {
			this.mapContext.$on("fm-search-box-show-tab", this.handleShowTab);

			this.cardHeader = this.searchBox.querySelector(".card-header")!;
			this.cardHeader.addEventListener("contextmenu", (e) => {
				e.preventDefault();
			});

			const pan = new hammer.Manager(this.cardHeader);
			pan.add(new hammer.Pan({ direction: hammer.DIRECTION_VERTICAL }));
			pan.on("panstart", this.handlePanStart);
			pan.on("pan", this.handlePanMove);
			pan.on("panend", this.handlePanEnd);

			const resize = new hammer.Manager(this.resizeHandle);
			resize.add(new hammer.Pan({ direction: hammer.DIRECTION_ALL }));
			resize.add(new hammer.Tap());
			resize.on("panstart", this.handleResizeStart);
			resize.on("pan", this.handleResizeMove);
			resize.on("panend", this.handleResizeEnd);
			resize.on("tap", this.handleResizeClick);

			this.$watch(() => this.tabsComponent?.tabs[this.tab]?.$attrs?.["fm-hash-query"], (hashQuery: HashQuery | undefined) => {
				this.mapContext.fallbackQuery = hashQuery;
			});

			this.isMounted = true;
		}

		beforeDestroy(): void {
			this.mapContext.$off("fm-search-box-show-tab", this.handleShowTab);
			this.cardHeader = undefined as any;
		}

		get hasTabs(): boolean {
			return this.isMounted && this.tabsComponent?.tabs.length > 0;
		}

		handlePanStart(event: any): void {
			this.restoreHeight = null;
			this.panStartHeight = parseInt($(this.searchBox).css("flex-basis"));
		}

		handlePanMove(event: any): void {
			if (this.context.isNarrow && this.panStartHeight != null && event.srcEvent.type != "pointercancel")
				$(this.searchBox).stop().css("flexBasis", `${this.getSanitizedHeight(this.panStartHeight - event.deltaY)}px`);
		}

		handlePanEnd(): void {
			this.mapComponents.map.invalidateSize({ pan: false });
		}

		getSanitizedHeight(height: number): number {
			const maxHeight = (this.searchBox.offsetParent as HTMLElement).offsetHeight - 5;
			return Math.max(0, Math.min(maxHeight, height));
		}

		handleActivateTab(idx: number): void {
			this.restoreHeight = null;
			this.tabHistory = [
				...this.tabHistory.filter((tab) => tab != idx),
				idx
			];
		}

		handleChanged(newTabs: BTab[], oldTabs: BTab[]): void {
			if (this.restoreHeight != null && newTabs.length < oldTabs.length) {
				$(this.searchBox).animate({ flexBasis: this.restoreHeight }, () => {
					this.mapComponents.map.invalidateSize({ pan: false });
				});
				this.restoreHeight = null;
			}

			const lastActiveTab = this.tabHistory[this.tabHistory.length - 1];
			this.tabHistory = this.tabHistory.map((idx) => newTabs.indexOf(oldTabs[idx])).filter((idx) => idx != -1);
			if (!newTabs.includes(oldTabs[lastActiveTab]))
				this.tab = this.tabHistory[this.tabHistory.length - 1];
		}

		handleShowTab(id: string, expand = true): void {
			const idx = this.tabsComponent.tabs.findIndex((tab: any) => tab.id == id);
			if (idx != -1)
				this.tab = idx;

			if (this.context.isNarrow && expand) {
				setTimeout(() => {
					const currentHeight = parseInt($(this.searchBox).css("flex-basis"));
					if (currentHeight < 120) {
						this.restoreHeight = currentHeight;
						$(this.searchBox).animate({ flexBasis: 170 }, () => {
							this.mapComponents.map.invalidateSize({ pan: false });
						});
					}
				}, 0);
			}
		}

		handleResizeStart(event: any): void {
			this.isResizing = true;
			this.resizeStartWidth = this.searchBox.offsetWidth;
			this.resizeStartHeight = this.searchBox.offsetHeight;
			this.$root.$emit('bv::hide::tooltip');
			this.searchBoxContext.$emit("resizestart");
		}

		handleResizeMove(event: any): void {
			this.searchBox.style.width = `${this.resizeStartWidth + event.deltaX}px`;
			this.searchBox.style.height = `${this.resizeStartHeight + event.deltaY}px`;
			this.searchBoxContext.$emit("resize");
		}

		handleResizeEnd(event: any): void {
			this.isResizing = false;
			this.searchBoxContext.$emit("resizeend");
		}

		handleResizeClick(): void {
			this.searchBox.style.width = "";
			this.searchBox.style.height = "";
			this.$root.$emit('bv::hide::tooltip');
			this.searchBoxContext.$emit("resizereset");
		}

		handleFocusIn(e: FocusEvent): void {
			if ((e.target as HTMLElement).closest("input,textarea"))
				this.hasFocus = true;
		}

		handleFocusOut(e: FocusEvent): void {
			this.hasFocus = false;
		}

	}
</script>

<template>
	<b-card v-show="hasTabs" no-body ref="searchBox" class="fm-search-box" :class="{ isNarrow: context.isNarrow, hasFocus }" @focusin="handleFocusIn" @focusout="handleFocusOut">
		<b-tabs card align="center" v-model="tab" ref="tabsComponent" @changed="handleChanged" @activate-tab="handleActivateTab" no-fade>
			<SearchFormTab v-if="context.search"></SearchFormTab>
			<RouteFormTab v-if="context.search"></RouteFormTab>
			<OverpassFormTab v-if="context.search"></OverpassFormTab>
			<MarkerInfoTab></MarkerInfoTab>
			<LineInfoTab></LineInfoTab>
			<MultipleInfoTab></MultipleInfoTab>
			<OverpassInfoTab></OverpassInfoTab>
			<portal-target name="fm-search-box" multiple></portal-target>
		</b-tabs>
		<a v-show="!context.isNarrow" href="javascript:" class="fm-search-box-resize" v-b-tooltip.hover.right="'Drag to resize, click to reset'" ref="resizeHandle"><Icon icon="resize-horizontal"></Icon></a>
	</b-card>
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

			.nav-tabs .nav-item a {
				padding: 0.1rem 0.3rem;
			}
		}

		&.isNarrow {
			min-height: 55px;
			flex-basis: 55px;
			overflow: hidden;

			height: auto !important; /* Override resize height from non-narrow mode */
			width: auto !important; /* Override resize width from non-narrow mode */

			.card-header {
				padding-top: 11px;
				position: relative;

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

		.tabs, .tab-content, .vue-portal-target {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.tabs, .tab-content, .tab-pane {
			flex-grow: 1;
		}

		.card-header {
			display: flex;
			flex-direction: column;
			flex-shrink: 0;
			padding: 0.3rem 0.3rem 0 0.3rem;
		}

		.nav-tabs {
			display: grid;
			grid-auto-columns: 1fr;
			grid-auto-flow: column;
			text-align: center;
			gap: 5px;
			margin: 0;

			.nav-item {
				min-width: 0;
			}

			.nav-item a {
				text-overflow: ellipsis;
				white-space: nowrap;
				overflow: hidden;
				font-size: 14px;
			}
		}

		.tab-pane.active {
			display: flex;
			flex-direction: column;
			overflow: auto;
		}

		.fm-search-box-collapse-point {
			overflow: auto;
		}


		hr {
			width: 100%;
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

		dl {
			display: grid;
			grid-template-columns: 150px auto;
			gap: 5px;

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