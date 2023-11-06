import type { Ref } from "vue";
import type { ClientContext } from "./client-context";
import type { MapContext } from "./map-context";
import type { SearchBoxContext } from "./search-box-context";

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
}

export interface WritableFacilMapContext {
	id: number;
	baseUrl: string;
	isNarrow: boolean;
	settings: FacilMapSettings;
	components: FacilMapComponents;
	provideComponent<K extends keyof FacilMapComponents>(key: K, componentRef: Ref<FacilMapComponents[K]>): void;
}

export type FacilMapContext = Readonly<Omit<WritableFacilMapContext, "settings" | "components">> & {
	settings: Readonly<WritableFacilMapContext["settings"]>;
	components: Readonly<WritableFacilMapContext["components"]>;
};