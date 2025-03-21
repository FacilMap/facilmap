<script lang="ts">
	import Carousel from "bootstrap/js/dist/carousel";
	import { pull } from "lodash-es";
	import { type ComponentInstance, type DeepReadonly, type InjectionKey, type Ref, computed, defineComponent, h, inject, onBeforeUnmount, onMounted, provide, reactive, readonly, ref, toRef, useTemplateRef, watch, watchEffect } from "vue";

	export interface CarouselContext {
		tab: number;
		/** If a slide animation is currently in progress, the index of the destination tab. */
		nextTab: number | undefined;
		/** Slides to the given tab. Returns a promise that is resolved once the slide animation has finished. */
		setTab(tab: number): Promise<void>;
	}

	export function useCarousel(element: Ref<HTMLElement | undefined>): DeepReadonly<CarouselContext> {
		let onSlid: Array<() => void> = [];

		const context = reactive<CarouselContext>({
			tab: 0,
			nextTab: undefined,
			setTab: async (tab) => {
				const carousel = element.value && Carousel.getInstance(element.value);
				if (carousel) {
					context.nextTab = tab;
					carousel.to(tab);
					await new Promise<void>((resolve) => {
						onSlid.push(resolve);
					});
					if (context.nextTab === tab) {
						context.nextTab = undefined;
					}
				} else {
					context.tab = tab;
				}
			}
		});

		watch(element, (newRef, oldRef, onCleanup) => {
			if (newRef) {
				const carousel = new Carousel(newRef, {
					interval: 0,
					wrap: false
				});

				if (context.tab !== 0) {
					carousel.to(context.tab);
				}

				newRef.addEventListener("slid.bs.carousel", handleSlid);

				onCleanup(() => {
					carousel.dispose();
					newRef.removeEventListener("slid.bs.carousel", handleSlid);
				});
			}
		});

		function handleSlid(e: Event) {
			const event = e as Event & Carousel.Event;
			context.tab = event.to;
			for (const callback of onSlid) {
				callback();
			}
			onSlid = [];
		}

		return readonly(context);
	}


	interface InternalCarouselContext extends CarouselContext {
		registerTab(element: HTMLElement): void;
		unregisterTab(element: HTMLElement): void;
		tabs: HTMLElement[];
	}

	const contextKey = Symbol("fm-carousel") as InjectionKey<InternalCarouselContext>;

	export const CarouselTab = defineComponent({
		props: {
			activateOnMount: { type: Boolean }
		},
		setup(props, { slots, emit }) {
			const context = inject(contextKey);
			if (!context) {
				throw new Error("Could not find carousel context.");
			}

			const el = ref<HTMLElement>();

			const idx = computed(() => {
				const result = el.value && context.tabs.indexOf(el.value);
				return result !== -1 ? result : undefined;
			});
			const active = computed(() => idx.value != null && idx.value === context.tab);

			onMounted(() => {
				context.registerTab(el.value!);
				if (props.activateOnMount && !active.value) {
					void context.setTab(idx.value!);
				}
			});

			onBeforeUnmount(() => {
				context.unregisterTab(el.value!);
			});

			return () => h("div", {
				class: ["carousel-item", { active: active.value }],
				ref: el
			}, slots.default?.());
		}
	});
</script>

<script setup lang="ts">
	const carouselRef = ref<HTMLElement>();

	const context = useCarousel(carouselRef);
	defineExpose(context);

	const internalContext: InternalCarouselContext = reactive({
		tab: toRef(() => context.tab),
		nextTab: toRef(() => context.nextTab),
		setTab: (tab: number) => context.setTab(tab),
		tabs: [],
		registerTab: (el: HTMLElement) => {
			const firstAfterIdx = internalContext.tabs.findIndex((t) => el.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
			if (firstAfterIdx === -1) {
				internalContext.tabs.push(el);
			} else {
				internalContext.tabs.splice(firstAfterIdx, 0, el);
			}
		},
		unregisterTab: (el: HTMLElement) => {
			pull(internalContext.tabs, el);
		}
	});
	provide(contextKey, internalContext);

	const virtualTabRefs = useTemplateRef<Array<ComponentInstance<typeof CarouselTab>>>("virtualTab");

	const actualTabCount = computed(() => internalContext.tabs.filter((el) => !virtualTabRefs.value?.some((r) => r.$el === el)).length);
	watch([() => context.tab, actualTabCount], ([tab, actualTabCount]) => {
		if (actualTabCount > 0 && tab >= actualTabCount) {
			void context.setTab(internalContext.tabs.length - 1);
		}
	});

	const totalTabCount = ref(0);
	watchEffect(() => {
		if (internalContext.tabs.length > totalTabCount.value) {
			totalTabCount.value = internalContext.tabs.length;
		}
	});

	const virtualTabCount = computed(() => totalTabCount.value - actualTabCount.value);
</script>

<template>
	<div class="carousel slide fm-carousel" ref="carouselRef">
		<slot v-bind="context"></slot>
		<CarouselTab v-for="i in virtualTabCount" :key="i" ref="virtualTab"></CarouselTab>
	</div>
</template>

<style lang="scss">
	.fm-carousel {
		display: flex;
		min-height: 0;

		> .carousel-item.active, > .carousel-item-next, > .carousel-item-prev {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}
	}
</style>