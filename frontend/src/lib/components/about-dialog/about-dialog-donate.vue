<script setup lang="ts">
	import { useI18n } from "../../utils/i18n";
	import { markdownInline } from "facilmap-utils";
	import Icon from "../ui/icon.vue";

	const i18n = useI18n();
</script>

<template>
	<p v-html="`${markdownInline(i18n.t('about-dialog.donate-introduction'), true)}&nbsp;&#x2935;&#xFE0E;`"></p>
	<ul class="fm-card-items">
		<li>
			<a href="https://github.com/sponsors/FacilMap" target="_blank">
				<img src="./github.svg" alt="">
				GitHub
			</a>
		</li>

		<li>
			<a href="https://liberapay.com/facilmap/" target="_blank">
				<img src="./liberapay.svg" alt="">
				Liberapay
			</a>
		</li>

		<li>
			<a href="https://www.paypal.com/donate?hosted_button_id=FWR59UXY6HGGS" target="_blank">
				<img src="./paypal.svg" alt="">
				PayPal
			</a>
		</li>

		<li>
			<a href="https://docs.facilmap.org/users/contribute/" target="_blank">
				<Icon icon="new-window"></Icon>
				{{i18n.t("about-dialog.donate-more-options")}}
			</a>
		</li>
	</ul>
</template>