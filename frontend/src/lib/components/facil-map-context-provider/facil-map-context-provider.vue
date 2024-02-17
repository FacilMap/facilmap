<script lang="ts">
	import { type InjectionKey, type Ref, inject, onScopeDispose, provide, shallowReactive, toRef, watch, reactive, readonly, shallowReadonly } from "vue";
	import { useMaxBreakpoint } from "../../utils/bootstrap";
	import type { FacilMapComponents, FacilMapContext, FacilMapSettings } from "./facil-map-context";

	const contextInject = Symbol("contextInject") as InjectionKey<FacilMapContext>;

	export function injectContextOptional(): FacilMapContext | undefined {
		return inject(contextInject);
	}

	export function injectContextRequired(): FacilMapContext {
		const context = injectContextOptional();
		if (!context) {
			throw new Error("No context injected.");
		}
		return context;
	}

	function getRequireContext<K extends keyof FacilMapComponents>(key: K, componentName: string): (context: FacilMapContext) => Ref<NonNullable<FacilMapComponents[K]>> {
		return (context) => {
			return toRef(() => {
				if (!context.components[key]) {
					throw new Error(`${key} component is not available. Make sure to have a <${componentName}> within your <FacilMapContextProvider>.`);
				}
				return context.components[key] as NonNullable<FacilMapComponents[K]>;
			});
		};
	}

	export const requireClientContext = getRequireContext("client", "ClientProvider");
	export const requireMapContext = getRequireContext("map", "LeafletMap");
	export const requireSearchBoxContext = getRequireContext("searchBox", "SearchBox");

	let idCounter = 1;
</script>

<script setup lang="ts">
	const props = withDefaults(defineProps<{
		baseUrl: string;
		appName?: string;
		settings?: Partial<FacilMapSettings>;
	}>(), {
		appName: "FacilMap"
	});

	const isNarrow = useMaxBreakpoint("sm");

	const components = shallowReactive<FacilMapComponents>({});

	function provideComponent<K extends keyof FacilMapComponents>(key: K, componentRef: Readonly<Ref<FacilMapComponents[K]>>) {
		if (key in components) {
			throw new Error(`Component "${key}"" is already provided.`);
		}

		watch(componentRef, (component) => {
			components[key] = component;
		}, { immediate: true });

		onScopeDispose(() => {
			delete components[key];
		});
	}

	const context: FacilMapContext = shallowReadonly(reactive({
		id: idCounter++,
		baseUrl: toRef(() => props.baseUrl),
		appName: toRef(() => props.appName),
		isNarrow,
		settings: readonly(toRef(() => ({
			toolbox: true,
			search: true,
			autofocus: false,
			legend: true,
			interactive: true,
			linkLogo: false,
			updateHash: false,
			...props.settings
		}))),
		components: shallowReadonly(components),
		provideComponent
	}));

	provide(contextInject, context)

	defineExpose({
		context
	});
</script>

<template>
	<slot></slot>
</template>