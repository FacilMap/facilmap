<script setup lang="ts">
	import { mapSlugValidator, type CRU, type MapData } from "facilmap-types";
	import { computed } from "vue";
	import { getUniqueId, getZodValidator, validateRequired } from "../../utils/utils";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import CopyToClipboardInput from "../ui/copy-to-clipboard-input.vue";
	import { useI18n } from "../../utils/i18n";
	import vTooltip from "../../utils/tooltip";
	import Icon from "../ui/icon.vue";

	const idProps = ["readId", "writeId", "adminId"] as const;
	type IdProp = typeof idProps[number];

	const context = injectContextRequired();
	const i18n = useI18n();

	const props = defineProps<{
		mapData: MapData<CRU.CREATE>;
		idProp: IdProp;
		modelValue: string;
		label: string;
		description: string;
		getRandom: () => string;
	}>();

	const emit = defineEmits<{
		"update:modelValue": [string];
	}>();

	const id = getUniqueId("fm-map-settings-map-id-edit");

	const value = computed({
		get: () => props.modelValue,
		set: (val) => {
			emit("update:modelValue", val);
		}
	});

	function validateDistinctMapId(id: string) {
		if (idProps.some((p) => p !== props.idProp && props.mapData[p] === id)) {
			return i18n.t("map-id-edit.unique-id-error");
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
				:copyTooltip="i18n.t('map-id-edit.copy-tooltip')"
				:qrTooltip="i18n.t('map-id-edit.qr-tooltip')"
				:copiedTitle="i18n.t('map-id-edit.copied-title')"
				:copiedMessage="i18n.t('map-id-edit.copied-message')"
				:fullUrl="`${context.baseUrl}${encodeURIComponent(value)}`"
				:validators="[validateRequired, getZodValidator(mapSlugValidator), validateDistinctMapId]"
			>
				<template #after1>
					<button
						type="button"
						class="btn btn-secondary"
						@click="value = props.getRandom()"
						v-tooltip="i18n.t('map-id-edit.random-tooltip')"
					>
						<Icon icon="shuffle" :alt="i18n.t('map-id-edit.random-alt')"></Icon>
					</button>
				</template>
			</CopyToClipboardInput>

			<div class="form-text">
				{{props.description}}
			</div>
		</div>
	</div>
</template>