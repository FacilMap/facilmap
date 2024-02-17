import type { Ref } from "vue";
import type { ClientContext } from "./client-context";
import type { MapContext } from "./map-context";
import type { SearchBoxContext } from "./search-box-context";
import type { SearchFormTabContext } from "./search-form-tab-context";
import type { RouteFormTabContext } from "./route-form-tab-context";
import type { ClickMarkerTabContext } from "./click-marker-tab-context";
import type { ImportTabContext } from "./import-tab-context";

export interface FacilMapSettings {
	toolbox: boolean;
	search: boolean;
	autofocus: boolean;
	legend: boolean;
	interactive: boolean;
	linkLogo: boolean;
	updateHash: boolean;
}

export interface FacilMapComponents {
	searchBox?: SearchBoxContext;
	client?: ClientContext;
	map?: MapContext;
	searchFormTab?: SearchFormTabContext;
	routeFormTab?: RouteFormTabContext;
	clickMarkerTab?: ClickMarkerTabContext;
	importTab?: ImportTabContext;
}

export interface WritableFacilMapContext {
	id: number;
	baseUrl: string;
	appName: string;
	isNarrow: boolean;
	settings: FacilMapSettings;
	components: FacilMapComponents;
	provideComponent<K extends keyof FacilMapComponents>(key: K, componentRef: Readonly<Ref<FacilMapComponents[K]>>): void;
}

export type FacilMapContext = Readonly<Omit<WritableFacilMapContext, "settings" | "components">> & {
	settings: Readonly<WritableFacilMapContext["settings"]>;
	components: Readonly<WritableFacilMapContext["components"]>;
};