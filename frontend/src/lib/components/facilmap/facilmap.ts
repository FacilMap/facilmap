import WithRender from "./facilmap.vue";
import Vue from "vue";
import { Component, Prop, ProvideReactive, Watch } from "vue-property-decorator";
import "./facilmap.scss";
import { CONTEXT_INJECT_KEY } from "../../utils/decorators";
import Toolbox from "../toolbox/toolbox";
import SearchBox from "../search-box/search-box";
import Legend from "../legend/legend";
import LeafletMap from "../leaflet-map/leaflet-map";
import Import from "../import/import";
import ClickMarker from "../click-marker/click-marker";
import { ClientProvider } from "../client/client";

export interface Context {
	id: number;
	activePadId: string | undefined;
	activePadName: string | undefined;
	serverUrl: string;
	baseUrl: string;
	toolbox: boolean;
	search: boolean;
	autofocus: boolean;
	legend: boolean;
	interactive: boolean;
	isNarrow: boolean;
	linkLogo: boolean;
	updateHash: boolean;
}

const isNarrow = () => window.innerWidth < 768;

let idCounter = 1;

@WithRender
@Component({
	components: { ClientProvider, ClickMarker, Import, LeafletMap, Legend, SearchBox, Toolbox }
})
export default class FacilMap extends Vue {

	@Prop({ type: String, required: true }) baseUrl!: string;
	@Prop({ type: String, required: true }) serverUrl!: string;
	@Prop({ type: String }) padId?: string;
	@Prop({ type: Boolean, default: true }) toolbox!: boolean;
	@Prop({ type: Boolean, default: true }) search!: boolean;
	@Prop({ type: Boolean, default: false }) autofocus!: boolean;
	@Prop({ type: Boolean, default: true }) legend!: boolean;
	@Prop({ type: Boolean, default: true }) interactive!: boolean;
	@Prop({ type: Boolean, default: false }) linkLogo!: boolean;
	@Prop({ type: Boolean, default: false }) updateHash!: boolean;

	@ProvideReactive(CONTEXT_INJECT_KEY) context: Context = {
		id: idCounter++,
		baseUrl: "",
		serverUrl: "",
		activePadId: undefined,
		activePadName: undefined,
		toolbox: false,
		search: false,
		autofocus: false,
		legend: false,
		interactive: false,
		isNarrow: false,
		linkLogo: false,
		updateHash: false
	};

	mounted(): void {
		window.addEventListener("resize", this.handleResize);
		this.handleResize();
	}

	beforeDestroy(): void {
		window.removeEventListener("resize", this.handleResize);
	}

	handleResize(): void {
		this.context.isNarrow = isNarrow();
	}

	@Watch("baseUrl", { immediate: true })
	handleBaseUrl(baseUrl: string): void {
		this.context.baseUrl = baseUrl;
	}

	@Watch("serverUrl", { immediate: true })
	handleServerUrl(serverUrl: string): void {
		this.context.serverUrl = serverUrl;
	}

	@Watch("padId", { immediate: true })
	handlePadId(padId: string | undefined): void {
		this.context.activePadId = padId;
	}

	@Watch("toolbox", { immediate: true })
	handleToolbox(toolbox: boolean): void {
		this.context.toolbox = toolbox;
	}

	@Watch("search", { immediate: true })
	handleSearch(search: boolean): void {
		this.context.search = search;
	}

	@Watch("autofocus", { immediate: true })
	handleAutoFocus(autofocus: boolean): void {
		this.context.autofocus = autofocus;
	}

	@Watch("legend", { immediate: true })
	handleLegend(legend: boolean): void {
		this.context.legend = legend;
	}

	@Watch("interactive", { immediate: true })
	handleInteractive(interactive: boolean): void {
		this.context.interactive = interactive;
	}

	@Watch("linkLogo", { immediate: true })
	handleLinkLogo(linkLogo: boolean): void {
		this.context.linkLogo = linkLogo;
	}

	@Watch("updateHash", { immediate: true })
	handleUpdateHash(updateHash: boolean): void {
		this.context.updateHash = updateHash;
	}

	@Watch("context.activePadId")
	handleActivePadId(activePadId: string | undefined): void {
		this.$emit("update:padId", activePadId);
	}

	@Watch("context.activePadName")
	handleActivePadName(activePadName: string | undefined): void {
		this.$emit("update:padName", activePadName);
	}

}