import Component from "vue-class-component";
import Vue from "vue";
import packageJson from "../../../package.json";
import WithRender from "./about.vue";
import { getLayers } from "facilmap-leaflet";
import { Prop } from "vue-property-decorator";
import "./about.scss";
import { InjectMapComponents } from "../../utils/decorators";
import { MapComponents } from "../leaflet-map/leaflet-map";
import { Layer } from "leaflet";

@WithRender
@Component({
    components: { }
})
export default class About extends Vue {

	@InjectMapComponents() mapComponents!: MapComponents;

	@Prop({ type: String, required: true }) id!: string;

	get layers(): Layer[] {
		const { baseLayers, overlays } = getLayers(this.mapComponents.map);
		return [...Object.values(baseLayers), ...Object.values(overlays)];
	}

	fmVersion = packageJson.version;

}
