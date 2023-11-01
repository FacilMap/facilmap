<script setup lang="ts">
	import { ID, Type } from "facilmap-types";
	import { FileResult, FileResultObject } from "../../utils/files";
	import { addSearchResultsToMap } from "./utils";
	import { isLineResult, isMarkerResult, typeExists } from "../../utils/search";
	import { mapValues, pickBy, uniq } from "lodash-es";
	import ModalDialog from "../ui/modal-dialog.vue";
	import { getUniqueId } from "../../utils/utils";
	import { injectContextRequired } from "../../utils/context";
	import { injectClientRequired } from "../client-context.vue";
	import { computed, ref } from "vue";
	import { useToasts } from "../ui/toasts/toasts.vue";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const toasts = useToasts();

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

	const customMappingOptions = computed(() => {
		return mapValues(pickBy(props.customTypes, (customType, customTypeId) => activeFileResultsByType.value[customTypeId as any].length > 0), (customType, customTypeId) => {
			const options: Array<{ key: string; value: string | false; text: string; disabled?: boolean }> = [];

			for (const type of Object.values(client.types)) {
				if (type.name == customType.name && type.type == customType.type)
					options.push({ key: `e${type.id}`, value: `e${type.id}`, text: `Existing type “${type.name}”` });
			}

			if (client.writable == 2 && !typeExists(client, customType))
				options.push({ key: `i${customTypeId}`, value: `i${customTypeId}`, text: `Import type “${customType.name}”` });

			options.push({ key: "false1", value: false, text: "Do not import" });
			options.push({ key: "false2", value: false, text: "──────────", disabled: true });

			for (const type of Object.values(client.types)) {
				if (type.name != customType.name && type.type == customType.type)
					options.push({ key: `e${type.id}`, value: `e${type.id}`, text: `Existing type “${type.name}”` });
			}

			for (const [customTypeId2, customType2] of Object.entries(props.customTypes)) {
				if (client.writable == 2 && customType2.type == customType.type && customTypeId2 != customTypeId && !typeExists(client, customType2))
					options.push({ key: `i${customTypeId2}`, value: `i${customTypeId2}`, text: `Import type “${customType2.name}”` });
			}

			return options;
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
		options.push({ key: "false", value: false, text: "Do not import" });

		for (const customTypeId of Object.keys(props.customTypes)) {
			const customType = props.customTypes[customTypeId as any];
			if (client.writable && customType.type == "marker" && !typeExists(client, customType))
				options.push({ key: `i${customTypeId}`, value: `i${customTypeId}`, text: `Import type “${customType.name}”` });
		}

		for (const type of Object.values(client.types)) {
			if (type.type == "marker")
				options.push({ key: `e${type.id}`, value: `e${type.id}`, text: `Existing type “${type.name}”` });
		}

		return options;
	});

	const untypedLineMappingOptions = computed(() => {
		const options: Array<{ key: string; value: string | false; text: string }> = [];
		options.push({ key: "false", value: false, text: "Do not import" });

		for (const customTypeId of Object.keys(props.customTypes)) {
			const customType = props.customTypes[customTypeId as any];
			if (client.writable && customType.type == "line")
				options.push({ key: `i${customTypeId}`, value: `i${customTypeId}`, text: `Import type “${customType.name}”` });
		}

		for (const type of Object.values(client.types)) {
			if (type.type == "line")
				options.push({ key: `e${type.id}`, value: `e${type.id}`, text: `Existing type “${type.name}”` });
		}

		return options;
	});

	async function save(): Promise<void> {
		toasts.hideToast(`fm${context.id}-search-result-info-add-error`);

		try {
			const resolvedMapping: Record<string, Type> = {};
			for (const id of uniq([...Object.values(customMapping.value), untypedMarkerMapping.value, untypedLineMapping.value])) {
				if (id !== false) {
					const m = id.match(/^([ei])(.*)$/);
					if (m && m[1] == "e")
						resolvedMapping[id] = client.types[m[2] as any];
					else if (m && m[1] == "i")
						resolvedMapping[id] = await client.addType(props.customTypes[m[2] as any]);
				}
			}

			const add = props.results.flatMap((result) => {
				const id = (result.fmTypeId && customMapping.value[result.fmTypeId]) ? customMapping.value[result.fmTypeId] : isMarkerResult(result) ? untypedMarkerMapping.value : untypedLineMapping.value;
				return id !== false && resolvedMapping[id] ? [{ result, type: resolvedMapping[id] }] : [];
			});

			await addSearchResultsToMap(add, client);

			modalRef.value?.modal.hide();
		} catch(err) {
			toasts.showErrorToast(`fm${context.id}-search-result-info-add-error`, "Error importing to map", err);
		}
	}
</script>

<template>
	<ModalDialog
		title="Custom Import"
		class="fm-search-results-custom-import"
		isCreate
		okLabel="Import"
		@submit="$event.waitUntil(save())"
		ref="modalRef"
		@hidden="emit('hidden')"
	>
		<table class="table table-striped table-hover">
			<thead>
				<tr>
					<th>Type</th>
					<th>Map to…</th>
				</tr>
			</thead>
			<tbody>
				<!-- eslint-disable-next-line vue/require-v-for-key -->
				<tr v-for="(options, importTypeId) in customMappingOptions">
					<td><label :for="`${id}-map-type-${importTypeId}`">{{customTypes[importTypeId as number].type == 'marker' ? 'Markers' : 'Lines'}} of type “{{customTypes[importTypeId as number].name}}” ({{activeFileResultsByType[importTypeId as number].length}})</label></td>
					<td>
						<select :id="`${id}-map-type-${importTypeId}`" v-model="customMapping[importTypeId as number]" :options="options">
							<option v-for="option in options" :key="option.key" :value="option.value">{{option.text}}</option>
						</select>
					</td>
				</tr>
				<tr v-if="untypedMarkers.length > 0">
					<td><label :for="`${id}-map-untyped-markers`">Untyped markers ({{untypedMarkers}})</label></td>
					<td>
						<select :id="`${id}-map-untyped-markers`" v-model="untypedMarkerMapping" :options="untypedMarkerMappingOptions">
							<option v-for="option in untypedMarkerMappingOptions" :key="option.key" :value="option.value">{{option.text}}</option>
						</select>
					</td>
				</tr>
				<tr v-if="untypedLines.length > 0">
					<td><label :for="`${id}-map-untyped-lines`">Untyped lines/polygons ({{untypedLines}})</label></td>
					<td>
						<select :id="`${id}-map-untyped-lines`" v-model="untypedLineMapping" :options="untypedLineMappingOptions">
							<option v-for="option in untypedLineMappingOptions" :key="option.key" :value="option.value">{{option.text}}</option>
						</select>
					</td>
				</tr>
			</tbody>
		</table>
	</ModalDialog>
</template>