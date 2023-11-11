import type { HashQuery } from "facilmap-leaflet";
import type { Emitter } from "mitt";
import type { DeepReadonly, Ref, Slot } from "vue";

export type SearchBoxEventMap = {
	"resizestart": void;
	"resize": void;
	"resizeend": void;
	"resizereset": void;
}

export interface SearchBoxTab {
	title: string;
	content: Slot<{ isActive: boolean }> | undefined;
	onClose?: () => void;
	hashQuery?: HashQuery;
	class?: string;
}

export interface SearchBoxContextData {
	tabs: Map<string, SearchBoxTab>;
	activeTabId: string | undefined;
	activeTab: SearchBoxTab | undefined;
	provideTab: (id: string, tabRef: Ref<SearchBoxTab>) => void;
	activateTab: (id: string, options?: { expand?: boolean; autofocus?: boolean }) => void;
}

export type WritableSearchBoxContext = SearchBoxContextData & Emitter<SearchBoxEventMap>;

export type SearchBoxContext = DeepReadonly<WritableSearchBoxContext>;