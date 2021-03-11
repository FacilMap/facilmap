import WithRender from "./search-box.vue";
import Vue from "vue";
import { Component, Ref, Watch } from "vue-property-decorator";
import "./search-box.scss";
import context from "../context";
import $ from "jquery";
import { BTab } from "bootstrap-vue";

@WithRender
@Component({
    components: { }
})
export default class SearchBox extends Vue {

	@Ref() tabsComponent!: any;

	tab = 0;
	touchStartY: number | null = null;
	restoreTop: number | null = null;

	get isNarrow(): boolean {
		return context.isNarrow;
	}

	mounted(): void {
		this.$root.$on("fmSearchBoxShowTab", this.handleShowTab);
	}

	beforeDestroy(): void {
		this.$root.$off("fmSearchBoxShowTab", this.handleShowTab);
	}

	handleTouchStart(event: TouchEvent): void {
		if(context.isNarrow && event.touches && event.touches[0] && $(event.target as EventTarget).closest("[draggable=true]").length == 0) {
			const top = (this.$el as HTMLElement).offsetTop;
			this.touchStartY = event.touches[0].clientY - top;
			$(this.$el).stop().css("top", `${top}px`);
			this.restoreTop = null;
		}
	}

	handleTouchMove(event: TouchEvent): void {
		if(this.touchStartY != null && event.touches[0]) {
			$(this.$el).stop().css("top", `${this.getSanitizedTop(event.touches[0].clientY - this.touchStartY)}px`);
		}
	}

	handleTouchEnd(event: TouchEvent): void {
		if(this.touchStartY != null && event.changedTouches[0]) {
			this.touchStartY = null;
		}
	}

	getTopFromBottom(bottom: number): number {
		return ((this.$el as HTMLElement).offsetParent as HTMLElement).offsetHeight - bottom;
	}

	getSanitizedTop(top: number): number {
		const minTop = Math.max(0, this.getTopFromBottom((this.$el as HTMLElement).scrollHeight));;
		const maxTop = ((this.$el as HTMLElement).offsetParent as HTMLElement).offsetHeight - 70;
		return Math.max(minTop, Math.min(maxTop, top));
	}

	handleActivateTab(): void {
		this.restoreTop = null;
	}

	handleChanged(newTabs: BTab[], oldTabs: BTab[]): void {
		if (this.restoreTop != null && newTabs.length < oldTabs.length) {
			$(this.$el).animate({ top: this.restoreTop });
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
				const currentTop = (this.$el as HTMLElement).offsetTop;
				if (currentTop > maxTop) {
					this.restoreTop = currentTop;
					$(this.$el).animate({ top: maxTop });
				}
			}, 0);
		}
	}

}