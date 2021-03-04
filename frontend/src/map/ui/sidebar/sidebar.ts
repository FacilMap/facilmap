import WithRender from "./sidebar.vue";
import Vue from "vue";
import { Component, Prop, Ref } from "vue-property-decorator";
import context from "../../context";
import $ from "jquery";

@WithRender
@Component({
    components: { }
})
export default class Sidebar extends Vue {

	@Prop({ type: String, required: true }) readonly id!: string;

	touchStartX: number | null = null;
	sidebarVisible = false;

	get isNarrow() {
		return context.isNarrow;
	}

	handleTouchStart(event: TouchEvent) {
		if(event.touches && event.touches[0] && $(event.target as EventTarget).closest("[draggable=true]").length == 0) {
			this.touchStartX = event.touches[0].clientX;
			$(this.$el).find(".b-sidebar").css("transition", "none");
		}
	}

	handleTouchMove(event: TouchEvent) {
		if(this.touchStartX != null && event.touches[0]) {
			const right = Math.min(this.touchStartX - event.touches[0].clientX, 0);
			$(this.$el).find(".b-sidebar").css("margin-right", `${right}px`);
		}
	}

	handleTouchEnd(event: TouchEvent) {
		if(this.touchStartX != null && event.changedTouches[0]) {
			const right = Math.min(this.touchStartX - event.changedTouches[0].clientX, 0);
			if(right < -($(this.$el).find(".b-sidebar").width() as number / 2)) {
				this.sidebarVisible = false;
				setTimeout(() => {
					$(this.$el).find(".b-sidebar").css("margin-right", "");
				}, 0);
			} else {
				$(this.$el).find(".b-sidebar").css({
					"transition": "margin-right 0.4s",
					"margin-right": ""
				});
			}

			this.touchStartX = null;
		}
	}

}