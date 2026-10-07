<script setup lang="ts">
	import { computed, ref } from "vue";
	import { getNews } from "../../utils/news";
	import storage from "../../utils/storage";
	import Badge from "../ui/badge.vue";
	import { markdownBlock, markdownInline, quoteHtml } from "facilmap-utils";
	import Collapse from "../ui/collapse.vue";
	import { useI18n } from "../../utils/i18n";
	import Icon from "../ui/icon.vue";

	const i18n = useI18n();

	// Store non-reactively, as it will be updated by reading the news
	const lastNews = storage.lastNews;

	const news = computed(() => getNews(lastNews).map((n) => ({
		...n,
		headingHtml: markdownInline(n.heading, true),
		contentHtml: markdownBlock(n.content, true)
	})).reverse());

	const newsNew = computed(() => news.value.filter((n) => n.isNew));
	const newsOld = computed(() => news.value.filter((n) => !n.isNew).slice(0, 3));
	const newsOldMore = computed(() => news.value.filter((n) => !n.isNew).slice(3));

	const showMore = ref(false);
</script>

<template>
	<div class="fm-about-dialog-news">
		<dl v-if="newsNew.length > 0">
			<template v-for="item in newsNew" :key="item.id">
				<dt>
					<Badge colour="danger"></Badge>
					<span v-html="`${quoteHtml(item.date)}: ${item.headingHtml}`"></span>
				</dt>
				<dd v-html="item.contentHtml"></dd>
			</template>
		</dl>

		<hr v-if="newsOld.length > 0 && newsNew.length > 0">

		<dl v-if="newsOld.length > 0" class="text-body-secondary">
			<template v-for="item in newsOld" :key="item.id">
				<dt>
					<Badge colour="secondary"></Badge>
					<span v-html="`${quoteHtml(item.date)}: ${item.headingHtml}`"></span>
				</dt>
				<dd v-html="item.contentHtml"></dd>
			</template>
		</dl>

		<template v-if="newsOldMore.length > 0">
			<div class="text-center">
				<button
					type="button"
					class="btn btn-secondary show-more-button"
					:class="{ expanded: showMore }"
					@click="showMore = !showMore"
				>
					{{showMore ? i18n.t("about-dialog.news-hide-more") : i18n.t("about-dialog.news-show-more")}}
					<Icon icon="chevron-right"></Icon>
				</button>
			</div>
			<Collapse :show="showMore">
				<dl class="text-body-secondary mt-3">
					<template v-for="item in newsOldMore" :key="item.id">
						<dt>
							<Badge colour="secondary"></Badge>
							<span v-html="`${quoteHtml(item.date)}: ${item.headingHtml}`"></span>
						</dt>
						<dd v-html="item.contentHtml"></dd>
					</template>
				</dl>
			</Collapse>
		</template>
	</div>
</template>

<style lang="scss">
	.fm-about-dialog-news {
		dt {
			margin: 0.25rem 0;
			display: flex;
			align-items: center;
			gap: 0.5ex;
		}

		dd:not(:last-child) {
			margin-bottom: 0.75rem;
		}

		dd > :last-child {
			margin-bottom: 0;
		}

		.show-more-button {
			.fm-icon {
				transition: transform 0.4s;
				transform: rotate(90deg);
			}

			&.expanded .fm-icon {
				transform: rotate(-90deg);
			}
		}
	}
</style>