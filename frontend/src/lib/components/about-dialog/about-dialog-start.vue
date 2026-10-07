<script setup lang="ts">
	import { useI18n } from "../../utils/i18n";
	import Carousel, { CarouselTab } from "../ui/carousel.vue";
	import { markdownInline } from "facilmap-utils";

	const i18n = useI18n();
</script>

<template>
	<Carousel showControls showIndicators class="fm-about-dialog-start" separateCaptionBreakpoint="md">
		<CarouselTab>
			<video autoplay muted loop playsinline>
				<source src="./discover-places.mp4" type="video/mp4">
			</video>
			<template #caption>
				<div v-html="markdownInline(i18n.t('about-dialog.start-explore'), true)"></div>
			</template>
		</CarouselTab>
		<CarouselTab>
			<video autoplay muted loop playsinline>
				<source src="./create-map.mp4" type="video/mp4">
			</video>
			<template #caption>
				<div v-html="markdownInline(i18n.t('about-dialog.start-create'), true)"></div>
			</template>
		</CarouselTab>
		<CarouselTab>
			<video autoplay muted loop playsinline>
				<source src="./share-map.mp4" type="video/mp4">
			</video>
			<template #caption>
				<div v-html="markdownInline(i18n.t('about-dialog.start-share'), true)"></div>
			</template>
		</CarouselTab>
	</Carousel>
</template>

<style lang="scss">
	.fm-about-dialog-start {
		.carousel-control-prev-icon, .carousel-control-next-icon {
			filter: drop-shadow(1px 0px 0px #000)
				drop-shadow(-1px 0px 0px #000)
				drop-shadow(0px 1px 0px #000)
				drop-shadow(0px -1px 0px #000)
				drop-shadow(0px 0px 4px #000)
				invert(1) grayscale(100);
		}

		video {
			width: 100%;
			aspect-ratio: 1600 / 1000;
		}
	}
</style>