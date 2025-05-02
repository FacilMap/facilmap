<script setup lang="ts">
	import { type ID, type Type } from "facilmap-types";
	import type { FileResult, FileResultObject } from "../../utils/files";
	import { isLineResult, isMarkerResult, typeExists } from "../../utils/search";
	import { mapValues, pickBy, uniq } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { getUniqueId } from "../../utils/utils";
	import { computed, ref, type DeepReadonly } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";
	import { injectContextRequired, requireClientContext, requireClientSub } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { type LineWithTags, type MarkerWithTags, addToMap, searchResultToLineWithTags, searchResultToMarkerWithTags } from "../../utils/add";
	import { canConfigureMap, formatTypeName, getCreatableTypes, getOrderedTypes } from "facilmap-utils";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const clientContext = requireClientContext(context);
	const clientSub = requireClientSub(context);
	const toasts = useToasts();
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		customTypes?: FileResultObject["types"];
		results: FileResult[];
	}>(), {
		customTypes: () => ({})
	});

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("fm-custom-import-dialog");
	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const activeFileResultsByType = computed(() => {
		return mapValues(props.customTypes, (type, id) => props.results.filter((result) => result.fmTypeId != null && `${result.fmTypeId}` == `${id}`));
	});

	type Option = { key: string; value: string | false; text: string; disabled?: boolean };

	const creatableTypes = computed(() => getCreatableTypes(clientSub.value.activeLink.permissions, getOrderedTypes(clientSub.value.data.types), true));

	const customMappingOptions = computed(() => {
		return mapValues(pickBy(props.customTypes, (customType, customTypeId) => activeFileResultsByType.value[customTypeId as any].length > 0), (customType, customTypeId): Option[] => {
			const recommendedOptions: Option[] = [];

			for (const type of creatableTypes.value) {
				if (type.name == customType.name && type.type == customType.type)
					recommendedOptions.push({ key: `e${type.id}`, value: `e${type.id}`, text: i18n.t("custom-import-dialog.existing-type", { name: formatTypeName(type.name) }) });
			}

			if (canConfigureMap(clientSub.value.activeLink.permissions) && !typeExists(clientSub.value.data, customType))
				recommendedOptions.push({ key: `i${customTypeId}`, value: `i${customTypeId}`, text: i18n.t("custom-import-dialog.import-type", { name: customType.name }) });

			recommendedOptions.push({ key: "false1", value: false, text: i18n.t("custom-import-dialog.no-import") });


			const otherOptions: Option[] = [];

			for (const type of creatableTypes.value) {
				if (type.name != customType.name && type.type == customType.type)
					otherOptions.push({ key: `e${type.id}`, value: `e${type.id}`, text: i18n.t("custom-import-dialog.existing-type", { name: formatTypeName(type.name) }) });
			}

			for (const [customTypeId2, customType2] of Object.entries(props.customTypes)) {
				if (canConfigureMap(clientSub.value.activeLink.permissions) && customType2.type == customType.type && customTypeId2 != customTypeId && !typeExists(clientSub.value.data, customType2))
					otherOptions.push({ key: `i${customTypeId2}`, value: `i${customTypeId2}`, text: i18n.t("custom-import-dialog.import-type", { name: customType2.name }) });
			}


			return [
				...recommendedOptions,
				...(recommendedOptions.length > 0 && otherOptions.length > 0 ? [
					{ key: "false2", value: false, text: "──────────", disabled: true } satisfies Option
				] : []),
				...otherOptions
			];
		});
	});

	const customMapping = ref<Record<ID, false | string>>(mapValues(customMappingOptions.value, (options) => options[0].value));
	const untypedMarkerMapping = ref<false | string>(false);
	const untypedLineMapping = ref<false | string>(false);

	const untypedMarkers = computed(() => {
		return props.results.filter((result) => (result.fmTypeId == null || !props.customTypes[result.fmTypeId]) && isMarkerResult(result));
	});

	const untypedLines = computed(() => {
		return props.results.filter((result) => (result.fmTypeId == null || !props.customTypes[result.fmTypeId]) && isLineResult(result));
	});

	const untypedMarkerMappingOptions = computed(() => {
		const options: Array<{ key: string; value: string | false; text: string }> = [];
		options.push({ key: "false", value: false, text: i18n.t("custom-import-dialog.no-import") });

		for (const customTypeId of Object.keys(props.customTypes)) {
			const customType = props.customTypes[customTypeId as any];
			if (canConfigureMap(clientSub.value.activeLink.permissions) && customType.type == "marker" && !typeExists(clientSub.value.data, customType))
				options.push({ key: `i${customTypeId}`, value: `i${customTypeId}`, text: i18n.t("custom-import-dialog.import-type", { name: customType.name }) });
		}

		for (const type of creatableTypes.value) {
			if (type.type == "marker")
				options.push({ key: `e${type.id}`, value: `e${type.id}`, text: i18n.t("custom-import-dialog.existing-type", { name: formatTypeName(type.name) }) });
		}

		return options;
	});

	const untypedLineMappingOptions = computed(() => {
		const options: Array<{ key: string; value: string | false; text: string }> = [];
		options.push({ key: "false", value: false, text: i18n.t("custom-import-dialog.no-import") });

		for (const customTypeId of Object.keys(props.customTypes)) {
			const customType = props.customTypes[customTypeId as any];
			if (canConfigureMap(clientSub.value.activeLink.permissions) && customType.type == "line")
				options.push({ key: `i${customTypeId}`, value: `i${customTypeId}`, text: i18n.t("custom-import-dialog.import-type", { name: customType.name }) });
		}

		for (const type of creatableTypes.value) {
			if (type.type == "line")
				options.push({ key: `e${type.id}`, value: `e${type.id}`, text: i18n.t("custom-import-dialog.existing-type", { name: formatTypeName(type.name) }) });
		}

		return options;
	});

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-search-result-info-add-error`);

		try {
			const resolvedMapping: Record<string, DeepReadonly<Type> | undefined> = {};
			for (const id of uniq([...Object.values(customMapping.value), untypedMarkerMapping.value, untypedLineMapping.value])) {
				if (id !== false) {
					const m = id.match(/^([ei])(.*)$/);
					if (m && m[1] == "e")
						resolvedMapping[id] = clientSub.value.data.types[m[2] as any];
					else if (m && m[1] == "i")
						resolvedMapping[id] = await clientContext.value.client.createType(clientSub.value.mapSlug, props.customTypes[m[2] as any]);
				}
			}

			const add = props.results.flatMap((result) => {
				const id = (result.fmTypeId && customMapping.value[result.fmTypeId]) ? customMapping.value[result.fmTypeId] : isMarkerResult(result) ? untypedMarkerMapping.value : untypedLineMapping.value;
				return id !== false && resolvedMapping[id] ? [{ result, type: resolvedMapping[id] }] : [];
			});

			await addToMap(context, add.flatMap(({ result, type }): Array<({ marker: DeepReadonly<MarkerWithTags> } | { line: DeepReadonly<LineWithTags> }) & { type: DeepReadonly<Type> }> => {
				if (type.type === 'marker') {
					const marker = searchResultToMarkerWithTags(result);
					return marker ? [{ marker, type }] : [];
				} else {
					const line = searchResultToLineWithTags(result);
					return line ? [{ line, type }] : [];
				};
			}));

			modalRef.value?.modal.hide();
		} catch(err) {
			toasts.showErrorToast(`fm${context.id}-search-result-info-add-error`, () => i18n.t("custom-import-dialog.import-error"), err);
		}
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('custom-import-dialog.dialog-title')"
		class="fm-search-results-custom-import"
		isCreate
		:okLabel="i18n.t('custom-import-dialog.ok-label')"
		@submit="$event.waitUntil(save())"
		ref="modalRef"
		@hidden="emit('hidden')"
	>
		<table class="table table-striped table-hover">
			<thead>
				<tr>
					<th>{{i18n.t("custom-import-dialog.type")}}</th>
					<th>{{i18n.t("custom-import-dialog.map-to")}}</th>
				</tr>
			</thead>
			<tbody>
				<!-- eslint-disable-next-line vue/require-v-for-key -->
				<tr v-for="(options, importTypeId) in customMappingOptions">
					<td>
						<label :for="`${id}-map-type-${importTypeId}`">
							{{customTypes[importTypeId as number].type == 'marker'
								? i18n.t("custom-import-dialog.markers", {
									typeName: customTypes[importTypeId as number].name,
									count: activeFileResultsByType[importTypeId as number].length
								})
								: i18n.t("custom-import-dialog.lines", {
									typeName: customTypes[importTypeId as number].name,
									count: activeFileResultsByType[importTypeId as number].length
								})
							}}
						</label>
					</td>
					<td>
						<select :id="`${id}-map-type-${importTypeId}`" v-model="customMapping[importTypeId as number]">
							<option v-for="option in options" :key="option.key" :value="option.value">{{option.text}}</option>
						</select>
					</td>
				</tr>
				<tr v-if="untypedMarkers.length > 0">
					<td><label :for="`${id}-map-untyped-markers`">{{i18n.t("custom-import-dialog.untyped-markers", { count: untypedMarkers.length })}}</label></td>
					<td>
						<select :id="`${id}-map-untyped-markers`" v-model="untypedMarkerMapping">
							<option v-for="option in untypedMarkerMappingOptions" :key="option.key" :value="option.value">{{option.text}}</option>
						</select>
					</td>
				</tr>
				<tr v-if="untypedLines.length > 0">
					<td><label :for="`${id}-map-untyped-lines`">{{i18n.t("custom-import-dialog.untyped-lines", { count: untypedLines.length })}}</label></td>
					<td>
						<select :id="`${id}-map-untyped-lines`" v-model="untypedLineMapping">
							<option v-for="option in untypedLineMappingOptions" :key="option.key" :value="option.value">{{option.text}}</option>
						</select>
					</td>
				</tr>
			</tbody>
		</table>
	</ModalDialog>
</template>