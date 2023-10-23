<script lang="ts">
	import { HashQuery } from "facilmap-leaflet";
	import mitt, { Emitter } from "mitt";
	import { InjectionKey, inject, provide, Ref, Slot, reactive, ref, readonly, DeepReadonly, watch, nextTick } from "vue";

	export type SearchBoxEventMap = {
		"resizestart": void;
		"resize": void;
		"resizeend": void;
		"resizereset": void;
		"expand": void;
	}

	export interface SearchBoxTab {
		title: string;
		content: Slot | undefined;
		onClose?: () => void;
		hashQuery?: HashQuery;
	}

	interface SearchBoxContextData {
		tabs: Map<string, Ref<SearchBoxTab>>;
		activeTabId: string | undefined;
		activeTab: SearchBoxTab | undefined;
		addTab: (id: string, tab: Ref<SearchBoxTab>) => void;
		removeTab: (id: string) => void;
		activateTab: (id: string, expand?: boolean) => void;
	}

	type InternalSearchBoxContext = SearchBoxContextData & Emitter<SearchBoxEventMap>;

	export type SearchBoxContext = DeepReadonly<InternalSearchBoxContext>;

	const contextInject = Symbol("searchBoxContext") as InjectionKey<SearchBoxContext>;

	export function injectSearchBoxContextOptional(): SearchBoxContext | undefined {
		return inject(contextInject);
	}

	export function injectSearchBoxContextRequired(): SearchBoxContext {
		const context = injectSearchBoxContextOptional();
		if (!context) {
			throw new Error("No search box context injected.");
		}
		return context;
	}
</script>

<script setup lang="ts">
	const tabs = reactive(new Map<string, Ref<SearchBoxTab>>());
	const activeTabId = ref<string | undefined>();
	const tabHistory = ref<string[]>([]);

	function addTab(id: string, tab: Ref<SearchBoxTab>) {
		if (tabs.has(id)) {
			throw new Error(`Tab with ID ${id} already present.`);
		}

		tabs.set(id, tab);

		if (activeTabId.value == null) {
			activateTab(id);
		}
	}

	function removeTab(id: string) {
		tabs.delete(id);

		const isActive = activeTabId.value === id;
		tabHistory.value = tabHistory.value.filter((v) => v !== id);
		if (isActive) {
			activeTabId.value = tabHistory.value.pop();
		}
	}

	function activateTab(id: string, expand?: boolean) {
		activeTabId.value = id;
		tabHistory.value.push(id);

		if (expand) {
			nextTick(() => {
				searchBoxContext.emit("expand");
			});
		}
	}

	const searchBoxContext: InternalSearchBoxContext = reactive(Object.assign(mitt<SearchBoxEventMap>(), {
		tabs,
		activeTabId: undefined,
		activeTab: undefined,
		addTab,
		removeTab,
		activateTab
	}));

	watch([
		activeTabId,
		() => activeTabId.value != null ? tabs.get(activeTabId.value) : undefined
	], ([tabId, tab]) => {
		searchBoxContext.activeTabId = tabId;
		searchBoxContext.activeTab = tab ? readonly(tab.value) : undefined;
	});

	provide(contextInject, readonly(searchBoxContext));
</script>