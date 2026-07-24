import type { HashQuery } from "facilmap-leaflet";
import type { Emitter } from "mitt";
import type { DeepReadonly, Ref, Slot } from "vue";

export type SearchBoxEventMap = {
	"resizestart": void;
	"resize": void;
	"resizeend": void;
	"resizereset": void;
}

export type SearchBoxSlotData = {
	/**
	 * True if the tab is currently active. Should enable selection features and possibly other interactions (such as
	 * route dragging) in the layers belonging to this tab.
	 */
	isActive: boolean;
	/**
	 * Vector layers belonging to the tab should be rendered in this pane. This value will change depending on whether
	 * the tab is active or not, so the layer pane needs to be updated reactively.
	 */
	overlayPane: string;
	/**
	 * Marker layers belonging to the tab should be rendered in this pane. This value will change depending on whether
	 * the tab is active or not, so the layer pane needs to be updated reactively.
	 */
	markerPane: string;
};

export interface SearchBoxTab {
	title: string;
	content: Slot<SearchBoxSlotData> | undefined;
	onClose?: () => void;
	hashQuery?: HashQuery;
	class?: string;
}

export interface SearchBoxContextData {
	visible: boolean;
	tabs: Map<string, SearchBoxTab>;
	activeTabId: string | undefined;
	activeTab: SearchBoxTab | undefined;
	provideTab: (id: string, tabRef: Ref<SearchBoxTab>) => void;
	activateTab: (id: string, options?: { expand?: boolean; autofocus?: boolean }) => void;
}

export type WritableSearchBoxContext = SearchBoxContextData & Emitter<SearchBoxEventMap>;

export type SearchBoxContext = DeepReadonly<WritableSearchBoxContext>;