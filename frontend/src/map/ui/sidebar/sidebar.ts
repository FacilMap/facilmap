import WithRender from "./sidebar.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import context from "../../context";
import $ from "jquery";
import hammer from "hammerjs";
import "./sidebar.scss";

@WithRender
@Component({
    components: { }
})
export default class Sidebar extends Vue {

	@Prop({ type: String, required: true }) readonly id!: string;

	sidebar!: HTMLElement;

	touchStartX: number | null = null;
	sidebarVisible = false;

	mounted(): void {
		this.sidebar = (this.$el as any).querySelector(".b-sidebar");

		const mc = new hammer.Manager(this.sidebar);
		mc.add(new hammer.Pan({ direction: hammer.DIRECTION_RIGHT }));
		mc.on("pan", this.handleDragMove);
		mc.on("panend", this.handleDragEnd);
	}

	beforeDestroy(): void {
		this.sidebar = undefined as any;
	}

	get isNarrow(): boolean {
		return context.isNarrow;
	}

	handleDragMove(event: any): void {
		$(this.sidebar).css("margin-right", `-${event.deltaX}px`);
	}

	handleDragEnd(event: any): void {
		if (event.velocityX > 0.3 || event.deltaX > this.sidebar.offsetWidth / 2) {
			this.sidebarVisible = false;
		} else {
			$(this.sidebar).animate({
				marginRight: 0
			});
		}
	}

	handleSidebarHidden(): void {
		$(this.sidebar).css("margin-right", "");
	}

}