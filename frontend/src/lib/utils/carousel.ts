import { Carousel } from "bootstrap";
import { Ref, reactive, readonly, watch } from "vue";

export interface CarouselContext {
	tab: number;
	setTab(tab: number): void;
}

export function useCarousel(element: Ref<HTMLElement | undefined>): Readonly<CarouselContext> {
	const context = reactive<CarouselContext>({
		tab: 0,
		setTab: (tab) => {
			const carousel = element.value && Carousel.getInstance(element.value);
			if (carousel) {
				carousel.to(tab);
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

			newRef.addEventListener("slide.bs.carousel", handleSlide);

			onCleanup(() => {
				carousel.dispose();
				newRef.removeEventListener("slide.bs.carousel", handleSlide);
			});
		}
	});

	function handleSlide(e: Event) {
		const event = e as Event & Carousel.Event;
		context.tab = event.to;
	}

	return readonly(context);
}