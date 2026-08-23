<script setup lang="ts">
	import { customFunctionNameValidator, type CRU, type CustomFunction, type MapData, type RouteFormula } from "facilmap-types";
	import ValidatedField from "../ui/validated-form/validated-field.vue";
	import { useI18n } from "../../utils/i18n";
	import { markdownInline, validateFilter } from "facilmap-utils";
	import { showConfirm } from "../ui/alert.vue";
	import { getUniqueId, getZodValidator, validateRequired } from "../../utils/utils";
	import Draggable from "vuedraggable";
	import Icon from "../ui/icon.vue";

	const i18n = useI18n();

	const props = defineProps<{
		mapData: MapData<CRU.CREATE>;
	}>();

	const id = getUniqueId("fm-map-settings-advanced");
</script>

<template>
	<!-- eslint-disable vue/no-mutating-props -->

	<div class="row mb-3">
		<label :for="`${id}-disable-rte-input`" class="col-sm-3 col-form-label">{{i18n.t("map-settings-dialog.disable-rte")}}</label>
		<div class="col-sm-9">
			<div class="form-check fm-form-check-with-label">
				<input
					:id="`${id}-disable-rte-input`"
					class="form-check-input"
					type="checkbox"
					v-model="props.mapData.disableRte"
				/>
				<label :for="`${id}-disable-rte-input`" class="form-check-label">
					{{i18n.t("map-settings-dialog.disable-rte-label")}}
				</label>
			</div>
			<div class="form-text">
			{{i18n.t("map-settings-dialog.disable-rte-description")}}
			</div>
		</div>
	</div>
</template>