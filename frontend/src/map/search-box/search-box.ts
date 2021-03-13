import WithRender from "./search-box.vue";
import Vue from "vue";
import { Component, Ref } from "vue-property-decorator";
import "./search-box.scss";
import context from "../context";
import $ from "jquery";
import { BTab } from "bootstrap-vue";
import Icon from "../ui/icon/icon";
import SearchFormTab from "../search-form/search-form-tab";
import MarkerInfoTab from "../marker-info/marker-info-tab";
import LineInfoTab from "../line-info/line-info-tab";
import hammer from "hammerjs";
import { InjectMapComponents, MapComponents } from "../leaflet-map/leaflet-map";

@WithRender
@Component({
    components: { Icon, LineInfoTab, MarkerInfoTab, SearchFormTab }
})
export default class SearchBox extends Vue {

	@InjectMapComponents() mapComponents!: MapComponents;

	@Ref() tabsComponent!: any;
	@Ref() searchBox!: HTMLElement;
	@Ref() resizeHandle!: HTMLElement;
	cardHeader!: HTMLElement;

	tab = 0;
	panStartTop: number | null = null;
	restoreTop: number | null = null;
	resizeStartHeight: number | null = null;
	resizeStartWidth: number | null = null;
	hasFocus = false;
	isResizing = false;

	get isNarrow(): boolean {
		return context.isNarrow;
	}

	mounted(): void {
		this.$root.$on("fm-search-box-show-tab", this.handleShowTab);

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
	}

	beforeDestroy(): void {
		this.$root.$off("fm-search-box-show-tab", this.handleShowTab);
		this.cardHeader = undefined as any;
	}

	handlePanStart(event: any): void {
		this.restoreTop = null;
		this.panStartTop = parseInt($(this.searchBox).css("flex-basis"));
	}

	handlePanMove(event: any): void {
		if (this.isNarrow && this.panStartTop != null && event.srcEvent.type != "pointercancel")
			$(this.searchBox).stop().css("flexBasis", `${this.getSanitizedTop(this.panStartTop - event.deltaY)}px`);
	}

	handlePanEnd(): void {
		this.mapComponents.map.invalidateSize({ animate: true });
	}

	getTopFromBottom(bottom: number): number {
		return (this.searchBox.offsetParent as HTMLElement).offsetHeight - bottom;
	}

	getSanitizedTop(top: number): number {
		const maxTop = (this.searchBox.offsetParent as HTMLElement).offsetHeight - 45;
		return Math.max(0, Math.min(maxTop, top));
	}

	handleActivateTab(): void {
		this.restoreTop = null;
	}

	handleChanged(newTabs: BTab[], oldTabs: BTab[]): void {
		if (this.restoreTop != null && newTabs.length < oldTabs.length) {
			$(this.searchBox).animate({ top: this.restoreTop });
			this.restoreTop = null;
		}
	}

	handleShowTab(id: string): void {
		const idx = this.tabsComponent.tabs.findIndex((tab: any) => tab.id == id);
		if (idx != -1)
			this.tab = idx;

		if (this.isNarrow) {
			setTimeout(() => {
				const maxTop = this.getSanitizedTop(this.getTopFromBottom(300));
				const currentTop = this.searchBox.offsetTop;
				if (currentTop > maxTop) {
					this.restoreTop = currentTop;
					$(this.searchBox).animate({ top: maxTop });
				}
			}, 0);
		}
	}

	handleResizeStart(event: any): void {
		this.isResizing = true;
		this.resizeStartWidth = this.searchBox.offsetWidth;
		this.resizeStartHeight = this.searchBox.offsetHeight;
	}

	handleResizeMove(event: any): void {
		this.searchBox.style.width = `${this.resizeStartWidth + event.deltaX}px`;
		this.searchBox.style.height = `${this.resizeStartHeight + event.deltaY}px`;
	}

	handleResizeEnd(event: any): void {
		this.isResizing = false;
	}

	handleResizeClick(): void {
		this.searchBox.style.width = "";
		this.searchBox.style.height = "";
	}

}