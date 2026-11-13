<script setup lang="ts">
	import { useI18n } from "../../utils/i18n";

	const i18n = useI18n();
</script>

<template>
	<ul class="fm-card-items">
		<li>
			<a href="https://docs.facilmap.org/" target="_blank">
				<img src="./facilmap.svg" alt="">
				{{i18n.t("about-dialog.help-documentation")}}
			</a>
		</li>
		<li>
			<a href="https://github.com/FacilMap/facilmap/issues" target="_blank">
				<img src="./github.svg" alt="">
				{{i18n.t("about-dialog.help-issues")}}
			</a>
		</li>
		<li>
			<a href="https://github.com/FacilMap/facilmap/discussions" target="_blank">
				<img src="./github.svg" alt="">
				{{i18n.t("about-dialog.help-questions")}}
			</a>
		</li>
		<li>
			<a href="https://matrix.to/#/#facilmap:rankenste.in" target="_blank">
				<img src="./matrix.svg" alt="">
				{{i18n.t("about-dialog.help-chat")}}
			</a>
		</li>
	</ul>
</template>