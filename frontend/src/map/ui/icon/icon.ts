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

	get iconCode(): string {
		return getSymbolHtml("currentColor", "1.4em", this.icon);
	}

}