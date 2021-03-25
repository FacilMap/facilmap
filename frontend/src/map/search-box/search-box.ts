import WithRender from "./search-box.vue";
import Vue from "vue";
import { Component, ProvideReactive, Ref } from "vue-property-decorator";
import "./search-box.scss";
import context from "../context";
import $ from "jquery";
import { BTab } from "bootstrap-vue";
import Icon from "../ui/icon/icon";
import SearchFormTab from "../search-form/search-form-tab";
import MarkerInfoTab from "../marker-info/marker-info-tab";
import LineInfoTab from "../line-info/line-info-tab";
import hammer from "hammerjs";
import { InjectMapComponents, InjectMapContext, SEARCH_BOX_CONTEXT_INJECT_KEY } from "../../utils/decorators";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import RouteFormTab from "../route-form/route-form-tab";
import { HashQuery } from "facilmap-leaflet";

export type SearchBoxContext = Vue;

@WithRender
@Component({
    components: { Icon, LineInfoTab, MarkerInfoTab, RouteFormTab, SearchFormTab }
})
export default class SearchBox extends Vue {

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

	get isNarrow(): boolean {
		return context.isNarrow;
	}

	mounted(): void {
		this.mapContext.$on("fm-search-box-show-tab", this.handleShowTab);

		this.cardHeader = this.searchBox.querySelector(".card-header")!;

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
	}

	beforeDestroy(): void {
		this.mapContext.$off("fm-search-box-show-tab", this.handleShowTab);
		this.cardHeader = undefined as any;
	}

	handlePanStart(event: any): void {
		this.restoreHeight = null;
		this.panStartHeight = parseInt($(this.searchBox).css("flex-basis"));
	}

	handlePanMove(event: any): void {
		if (this.isNarrow && this.panStartHeight != null && event.srcEvent.type != "pointercancel")
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

		if (this.isNarrow && expand) {
			setTimeout(() => {
				const currentHeight = parseInt($(this.searchBox).css("flex-basis"));
				if (currentHeight < 120) {
					this.restoreHeight = currentHeight;
					$(this.searchBox).animate({ flexBasis: 120 }, () => {
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