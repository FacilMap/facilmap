<script setup lang="ts">
	import { mapSlugValidator, type CRU, type MapData } from "facilmap-types";
	import { getUniqueId, getZodValidator, validateRequired } from "../../utils/utils";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import CopyToClipboardInput from "../ui/copy-to-clipboard-input.vue";
	import { useI18n } from "../../utils/i18n";
	import vTooltip from "../../utils/tooltip";
	import Icon from "../ui/icon.vue";
	import { generateRandomMapSlug } from "facilmap-utils";

	const context = injectContextRequired();
	const i18n = useI18n();

	const props = defineProps<{
		mapData: MapData<CRU.CREATE> | Required<MapData<CRU.UPDATE>>;
		label: string;
		description: string;
	}>();

	const id = getUniqueId("fm-map-settings-map-slug-edit");

	const value = defineModel<string>({ required: true });

	function validateDistinctMapSlug(slug: string) {
		const links = props.mapData.links.filter((l) => l.slug === slug);
		if (links.length >= 2 && links.some((l) => l.password === false)) {
			return i18n.t("map-slug-edit.unique-slug-error");
		}
	}
</script>

<template>
	<div class="row mb-3">
		<label :for="`${id}-input`" class="col-sm-3 col-form-label">{{props.label}}</label>
		<div class="col-sm-9 position-relative">
			<CopyToClipboardInput
				v-model="value"
				:prefix="context.baseUrl"
				:copyTooltip="i18n.t('map-slug-edit.copy-tooltip')"
				:qrTooltip="i18n.t('map-slug-edit.qr-tooltip')"
				:copiedTitle="i18n.t('map-slug-edit.copied-title')"
				:copiedMessage="i18n.t('map-slug-edit.copied-message')"
				:fullUrl="`${context.baseUrl}${encodeURIComponent(value)}`"
				:validators="[validateRequired, getZodValidator(mapSlugValidator), validateDistinctMapSlug]"
			>
				<template #after1>
					<button
						type="button"
						class="btn btn-secondary"
						@click="value = generateRandomMapSlug(16)"
						v-tooltip="i18n.t('map-slug-edit.random-tooltip')"
					>
						<Icon icon="shuffle" :alt="i18n.t('map-slug-edit.random-alt')"></Icon>
					</button>
				</template>
			</CopyToClipboardInput>

			<div class="form-text">
				{{props.description}}
			</div>
		</div>
	</div>
</template>