import Component from "vue-class-component";
import Vue from "vue";
import packageJson from "../../../package.json";
import WithRender from "./about.vue";
import { baseLayers, overlays } from "facilmap-leaflet";
import { Prop } from "vue-property-decorator";
import "./about.scss";

@WithRender
@Component({
    components: { }
})
export default class About extends Vue {

	@Prop({ type: String, required: true }) id!: string;

	layers = [...Object.values(baseLayers), ...Object.values(overlays)];
	fmVersion = packageJson.version;

}
