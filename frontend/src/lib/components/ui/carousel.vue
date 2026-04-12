<script lang="ts">
	import Carousel from "bootstrap/js/dist/carousel";
	import { pull } from "lodash-es";
	import { type ComponentInstance, type DeepReadonly, type InjectionKey, type Ref, computed, defineComponent, h, inject, onBeforeUnmount, onMounted, provide, reactive, readonly, ref, toRef, useTemplateRef, watch, watchEffect } from "vue";
	import { useI18n } from "../../utils/i18n";
	import { applySwipeTransition, isSwipe, useDrag } from "../../utils/drag";

	export interface CarouselContext {
		initialized: boolean;
		/** Is set to the active tab as soon as the slide animation starts. */
		tab: number;
		/** Is set to the active tab as soon as the slide animation finishes. */
		slidTab: number;
		/** Slides to the given tab. Returns a promise that is resolved once the slide animation has finished. */
		setTab(tab: number): Promise<void>;
		prev(): void;
		next(): void;
	}

	export function useCarousel(element: Ref<HTMLElement | undefined>, options: { noWrap?: boolean } = {}): DeepReadonly<CarouselContext> {
		let slide = Promise.resolve();

		const context = reactive<CarouselContext>({
			initialized: false,
			tab: 0,
			slidTab: 0,
			setTab: async (tab) => {
				context.tab = tab;

				// While Carousel has its own concurrency control, it does not seem to work for us, because it expects
				// the "active" class to already be set when the "slid" event is fired, whereas in our case we only
				// set it using Vue during the next render.
				slide = slide.then(async () => {
					const carousel = element.value && Carousel.getInstance(element.value);
					if (carousel) {
						carousel.to(tab);
						await new Promise<void>((resolve) => {
							const listener = (ev: any) => {
								if (ev.to === tab) {
									element.value?.removeEventListener("slid.bs.carousel", listener);
									resolve();
								}
							};
							element.value!.addEventListener("slid.bs.carousel", listener);
						});
					}

					context.slidTab = tab;
				});
				await slide;
			},
			prev: () => {
				if (element.value) {
					Carousel.getInstance(element.value)?.prev();
				}
			},
			next: () => {
				if (element.value) {
					Carousel.getInstance(element.value)?.next();
				}
			}
		});

		watch([element, () => options.noWrap], ([newRef, noWrap], [oldRef], onCleanup) => {
			if (newRef) {
				function onSlide(ev: any) {
					context.tab = ev.to;
				}

				function onSlid(ev: any) {
					context.slidTab = ev.to;
				}

				newRef.addEventListener("slide.bs.carousel", onSlide);
				newRef.addEventListener("slid.bs.carousel", onSlid);

				const carousel = new Carousel(newRef, {
					interval: 0,
					wrap: !noWrap,
					touch: false
				});

				if (context.tab !== 0) {
					carousel.to(context.tab);
				}

				context.initialized = true;

				onCleanup(() => {
					newRef.removeEventListener("slide.bs.carousel", onSlide);
					newRef.removeEventListener("slid.bs.carousel", onSlid);
					carousel.dispose();
					context.initialized = false;
				});
			}
		});

		return readonly(context);
	}


	interface InternalCarouselContext extends CarouselContext {
		registerTab(element: HTMLElement): void;
		unregisterTab(element: HTMLElement): void;
		tabs: HTMLElement[];
	}

	const contextKey = Symbol.for("fm-inject-carousel") as InjectionKey<InternalCarouselContext>;

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
			const active = computed(() => idx.value != null && idx.value === context.slidTab);

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
	const props = defineProps<{
		showControls?: boolean;
		showIndicators?: boolean;
		noDrag?: boolean;
		noWrap?: boolean;
	}>();

	// TODO: Enable/disable keyboard
	// TODO: Drag only on touch?

	const carouselRef = ref<HTMLElement>();

	const context = useCarousel(carouselRef, readonly({ noWrap: toRef(() => props.noWrap) }));
	defineExpose(context);

	const i18n = useI18n();

	const internalContext: InternalCarouselContext = reactive({
		initialized: toRef(() => context.initialized),
		tab: toRef(() => context.tab),
		slidTab: toRef(() => context.slidTab),
		setTab: (tab: number) => context.setTab(tab),
		prev: () => context.prev(),
		next: () => context.next(),
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
			void context.setTab(actualTabCount - 1);
		}
	});

	// Carousel does not deal very well with tabs that disappear. If a tab that is open disappears, it gets stuck and navigating away
	// from it is not possible anymore, even when the animation away from it is already in progress. We commonly have this scenario
	// in places where we use Carousel to dive down in a hierarchy, for example in SelectionCarousel. As a workaround, we keep track
	// of the maximium number of tabs here and keep it by filling the gap with "virtual" (empty) tabs.
	const totalTabCount = ref(0);
	watchEffect(() => {
		if (internalContext.tabs.length > totalTabCount.value) {
			totalTabCount.value = internalContext.tabs.length;
		}
	});

	const virtualTabCount = computed(() => totalTabCount.value - actualTabCount.value);

	const nextTabIdx = computed(() => internalContext.tab < actualTabCount.value - 1 ? internalContext.tab + 1 : 0);
	const prevTabIdx = computed(() => internalContext.tab > 0 ? internalContext.tab - 1 : actualTabCount.value - 1);

	const activeTab = computed(() => internalContext.tabs[internalContext.tab]);

	const drag = useDrag(toRef(() => props.noDrag ? undefined : activeTab.value), {
		onDrag: ({ deltaX }) => {
			Object.assign(activeTab.value!.style, {
				transform: `translateX(${deltaX}px)`,
				transition: "none"
			});

			if (deltaX > 0) {
				internalContext.tabs[prevTabIdx.value].classList.add("carousel-item-prev");
				internalContext.tabs[nextTabIdx.value].classList.remove("carousel-item-next");
				Object.assign(internalContext.tabs[prevTabIdx.value].style, {
					transform: `translateX(calc(-100% + ${deltaX}px)`,
					transition: "none"
				});
			} else if (deltaX < 0) {
				internalContext.tabs[prevTabIdx.value].classList.remove("carousel-item-prev");
				internalContext.tabs[nextTabIdx.value].classList.add("carousel-item-next");
				Object.assign(internalContext.tabs[nextTabIdx.value].style, {
					transform: `translateX(calc(100% + ${deltaX}px)`,
					transition: "none"
				});
			}
		},

		onDragEnd: ({ deltaX, velocityX }) => {
			activeTab.value!.style.transition = "";
			// internalContext.tabs[prevTabIdx.value].classList.remove("carousel-item-prev");
			// internalContext.tabs[nextTabIdx.value].classList.remove("carousel-item-next");
			internalContext.tabs[prevTabIdx.value].style.transition = "";
			internalContext.tabs[nextTabIdx.value].style.transition = "";

			const swipedRight = isSwipe({ size: activeTab.value!.offsetWidth, delta: deltaX, velocity: velocityX });
			const swipedLeft = isSwipe({ size: activeTab.value!.offsetWidth, delta: -deltaX, velocity: -velocityX });
			const distance = swipedRight || swipedLeft ? activeTab.value!.offsetWidth - Math.abs(deltaX) : Math.abs(deltaX);
			void applySwipeTransition([activeTab.value!, internalContext.tabs[prevTabIdx.value], internalContext.tabs[nextTabIdx.value]], { distance, duration: 600, velocity: velocityX });

			activeTab.value!.style.transform = "";
			internalContext.tabs[prevTabIdx.value].style.transform = "";
			internalContext.tabs[nextTabIdx.value].style.transform = "";

			if (swipedLeft) {
				internalContext.next();
			} else if (swipedRight) {
				internalContext.prev();
			}
		}
	});
</script>

<template>
	<div class="carousel slide fm-carousel" ref="carouselRef" :class="{ isDragging: drag.isDragging }">
		<template v-if="props.showIndicators">
			{{'' /*
			Carousel has its own way of modifying the indicators, which interferes with our reactive approach of setting for example the active class.
			As a workaround, we set the 'carousel-indicators' class only after Carousel has been initialized, as it looks for the element in its constructor.
			The 'data-bs-target' attribute is necessary for the CSS styles. */}}
			<div :class="{ 'carousel-indicators': internalContext.initialized }">
				<button
					v-for="n in actualTabCount"
					:key="n"
					type="button"
					data-bs-target
					:class="{ active: internalContext.tab === n - 1 }"
					:aria-current="internalContext.tab === n - 1"
				></button>
			</div>
		</template>

		<div class="carousel-inner">
			<slot v-bind="context"></slot>
			<CarouselTab v-for="i in virtualTabCount" :key="i" ref="virtualTab"></CarouselTab>
		</div>

		<template v-if="props.showControls">
			<button class="carousel-control-prev" type="button" @click="internalContext.prev()">
				<span class="carousel-control-prev-icon" aria-hidden="true"></span>
				<span class="visually-hidden">{{i18n.t("general.previous")}}</span>
			</button>
			<button class="carousel-control-next" type="button" @click="internalContext.next()">
				<span class="carousel-control-next-icon" aria-hidden="true"></span>
				<span class="visually-hidden">{{i18n.t("general.next")}}</span>
			</button>
		</template>
	</div>
</template>

<style lang="scss">
	.fm-carousel {
		&, & > .carousel-inner {
			display: flex;
			min-height: 0;
		}

		> .carousel-inner {
			> .carousel-item.active, > .carousel-item-next, > .carousel-item-prev {
				display: flex;
				flex-direction: column;
				min-height: 0;
			}
		}

		&.isDragging .carousel-item {
			cursor: grabbing;

			> * {
				pointer-events: none;
			}
		}
	}
</style>