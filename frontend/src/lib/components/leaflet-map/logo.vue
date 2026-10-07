<script setup lang="ts">
	import { computed } from "vue";
	import vTooltip from "../../utils/tooltip";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const selfUrl = computed(() => {
		return `${location.origin}${location.pathname}${mapContext.value.hash ? `#${mapContext.value.hash}` : ''}`;
	});
</script>

<template>
	<div class="fm-logo">
		<a
			v-if="!context.settings.linkLogo"
			:href="selfUrl"
			target="_blank"
			v-tooltip.right="i18n.t('leaflet-map.open-full-size', { appName: context.appName })"
		></a>

		<img src="./logo.png"/>
	</div>
</template>

<style lang="scss">
	.fm-logo {
		position: relative;
		width: 90px;
		height: 50px;
		pointer-events: none;
		user-select: none;

		a {
			position: absolute;
			inset: 0;
			pointer-events: auto;
		}

		img {
			position: absolute;
			transform: translate(-40px, -39px);
			// left: -40px;
			// bottom: -39px;
			overflow: hidden;
			color-scheme: only light;
		}
	}

</style>