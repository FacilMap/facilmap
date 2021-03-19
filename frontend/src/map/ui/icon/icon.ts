import WithRender from "./icon.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { getSymbolHtml } from "facilmap-leaflet";

@WithRender
@Component({
    components: { }
})
export default class Icon extends Vue {

	@Prop({ type: String }) icon!: string | undefined;
	@Prop({ type: String }) alt?: string; // TODO
	@Prop({ type: String }) size?: string;

	get iconCode(): string {
		return getSymbolHtml("currentColor", this.size || "1.4em", this.icon);
	}

}