import WithRender from "./sidebar.vue";
import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import $ from "jquery";
import hammer from "hammerjs";
import "./sidebar.scss";
import { InjectContext } from "../../../utils/decorators";
import { Context } from "../../facilmap/facilmap";

@WithRender
@Component({
	components: { }
})
export default class Sidebar extends Vue {

	@InjectContext() context!: Context;

	@Prop({ type: String, required: true }) readonly id!: string;

	sidebar?: HTMLElement;
	pan?: HammerManager;

	touchStartX: number | null = null;
	sidebarVisible = false;

	mounted(): void {
		this.initPan();
	}

	beforeDestroy(): void {
		this.destroyPan();
	}

	@Watch("context.isNarrow")
	handleNarrowChange(): void {
		this.destroyPan();
		setTimeout(() => {
			this.initPan();
		}, 0);
	}

	initPan(): void {
		this.sidebar = (this.$el as any).querySelector(".b-sidebar");

		if (this.sidebar) {
			this.pan = new hammer.Manager(this.sidebar);
			this.pan.add(new hammer.Pan({ direction: hammer.DIRECTION_RIGHT }));
			this.pan.on("pan", this.handleDragMove);
			this.pan.on("panend", this.handleDragEnd);
		}
	}

	destroyPan(): void {
		if (this.pan) {
			this.pan.destroy();
			this.pan = undefined;
		}
		this.sidebar = undefined;
	}

	handleDragMove(event: any): void {
		$(this.sidebar!).css("margin-right", `-${event.deltaX}px`);
	}

	handleDragEnd(event: any): void {
		if (event.velocityX > 0.3 || event.deltaX > this.sidebar!.offsetWidth / 2) {
			this.sidebarVisible = false;
		} else {
			$(this.sidebar!).animate({
				marginRight: 0
			});
		}
	}

	handleSidebarHidden(): void {
		$(this.sidebar!).css("margin-right", "");
	}

}