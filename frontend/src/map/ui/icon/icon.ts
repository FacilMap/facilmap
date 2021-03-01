import WithRender from "./icon.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { createSymbolHtml } from "facilmap-leaflet";

@WithRender
@Component({
    components: { }
})
export default class Icon extends Vue {

	@Prop({ type: String }) icon!: string;

	get iconCode() {
		return createSymbolHtml("currentColor", "1.5em", this.icon);
	}

}