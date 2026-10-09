<script setup lang="ts">
	import { computed, nextTick, ref, watch } from "vue";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";
	import Accordion from "../ui/accordion/accordion.vue";
	import AccordionItem from "../ui/accordion/accordion-item.vue";
	import AboutDialogStart from "./about-dialog-start.vue";
	import AboutDialogHelp from "./about-dialog-help.vue";
	import AboutDialogNews from "./about-dialog-news.vue";
	import AboutDialogAbout from "./about-dialog-about.vue";
	import AboutDialogDonate from "./about-dialog-donate.vue";
	import { handleExpandNews, handleOpenAboutDialog, hasUnreadNews } from "../../utils/news.js";
	import Badge from "../ui/badge.vue";
	import config from "../../../map/config.js";

	const i18n = useI18n();

	const context = injectContextRequired();

	const props = defineProps<{
		animationReference?: HTMLElement;
		/** If true, open with the news expanded if there are any unread ones. */
		showNews?: boolean;
	}>();

	const emit = defineEmits<{
		hidden: [];
	}>();

	// Call this before loading the news for the first time. If this is our first time opening the dialog (and thus probably our
	// first time using the app), we consider all news as read.
	handleOpenAboutDialog();

	const hasNews = computed(() => hasUnreadNews());

	const activeItems = ref([props.showNews && hasNews.value ? "news" : "start"]);

	if (activeItems.value.includes("news")) {
		void nextTick(() => {
			handleExpandNews();
		});
	}

	watch(activeItems, () => {
		if (activeItems.value.includes("news")) {
			handleExpandNews();
		}
	});
</script>

<template>
	<ModalDialog
		:title="i18n.t('about-dialog.header', { appName: context.appName })"
		class="fm-about"
		size="lg"
		:animationReference="props.animationReference"
		@hidden="emit('hidden')"
	>
		<p>{{i18n.t("about-dialog.introduction")}}</p>

		<Accordion v-model:show="activeItems">
			<AccordionItem id="start" :header="i18n.t('about-dialog.start-header')">
				<AboutDialogStart></AboutDialogStart>
			</AccordionItem>

			<AccordionItem id="help" :header="i18n.t('about-dialog.help-header')">
				<AboutDialogHelp></AboutDialogHelp>
			</AccordionItem>

			<AccordionItem v-if="config.donateUrl === 'https://docs.facilmap.org/users/contribute/'" id="donate">
				<template #header>
					<span class="fm-donate">♥&nbsp;{{i18n.t("common.donate")}}</span>
				</template>
				<AboutDialogDonate></AboutDialogDonate>
			</AccordionItem>

			<AccordionItem id="news">
				<template #header>
					<span class="position-relative pe-2">
						{{i18n.t('about-dialog.news-header')}}
						<Badge v-if="hasNews" positioned colour="danger"></Badge>
					</span>
				</template>
				<AboutDialogNews></AboutDialogNews>
			</AccordionItem>

			<AccordionItem id="about" :header="i18n.t('about-dialog.about-header', { appName: context.appName })">
				<AboutDialogAbout></AboutDialogAbout>
			</AccordionItem>
		</Accordion>
	</ModalDialog>
</template>