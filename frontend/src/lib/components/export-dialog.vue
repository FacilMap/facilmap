<script setup lang="ts">
	import { computed, ref } from "vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { getUniqueId } from "../utils/utils";
	import { injectContextRequired, requireClientContext, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import HelpPopover from "./ui/help-popover.vue";
	import CopyToClipboardInput from "./ui/copy-to-clipboard-input.vue";
	import type { ComponentProps } from "../utils/vue";
	import type { ID } from "facilmap-types";
	import validatedField from "./ui/validated-form/validated-field.vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import copyToClipboard from "copy-to-clipboard";
	import type { CustomSubmitEvent } from "./ui/validated-form/validated-form.vue";

	const toasts = useToasts();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

	const id = getUniqueId("fm-export-map");

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const copyRef = ref<InstanceType<typeof CopyToClipboardInput>>();

	const formatOptions = {
		gpx: "GPX",
		geojson: "GeoJSON",
		table: "HTML",
		csv: "CSV"
	};

	const hideOptions = computed(() => new Set([
		"Name",
		"Position",
		"Distance",
		"Line time",
		// TODO: Include only types not currently filtered
		...Object.values(client.value.types).flatMap((type) => type.fields.map((field) => field.name))
	]));

	const format = ref<keyof typeof formatOptions>("gpx");
	const useTracks = ref<"1" | "0">("1");
	const filter = ref(true);
	const hide = ref(new Set<string>());
	const typeId = ref<ID>();

	const methodOptions = computed(() => ({
		download: format.value === "table" ? "Open file" : "Download file",
		link: "Generate link",
		...(format.value === "table" ? {
			copy: "Copy to clipboard"
		} : {})
	}));

	const rawMethod = ref<keyof typeof methodOptions["value"]>();
	const method = computed({
		get: () => (rawMethod.value && Object.keys(methodOptions.value).includes(rawMethod.value)) ? rawMethod.value : (Object.keys(methodOptions.value) as Array<keyof typeof methodOptions["value"]>)[0],
		set: (method) => {
			rawMethod.value = method;
		}
	});

	const resolveTypeId = (typeId: ID | undefined) => typeId != null && client.value.types[typeId] ? typeId : undefined;
	const resolvedTypeId = computed(() => resolveTypeId(typeId.value));

	const canSelectUseTracks = computed(() => format.value === "gpx");
	const canSelectType = computed(() => format.value === "csv" || (format.value === "table" && method.value === "copy"));
	const mustSelectType = computed(() => canSelectType.value);
	const canSelectHide = computed(() => ["table", "csv"].includes(format.value));
	const validateImmediate = computed(() => method.value === "link"); // No submit button

	function validateTypeId(typeId: ID | undefined) {
		if (mustSelectType.value && resolveTypeId(typeId) == null) {
			return "Please select a type.";
		}
	}

	const url = computed(() => {
		const params = new URLSearchParams();
		if (canSelectUseTracks.value) {
			params.set("useTracks", useTracks.value);
		}
		if (canSelectHide.value && hide.value.size > 0) {
			params.set("hide", [...hide.value].join(","));
		}
		if (filter.value && mapContext.value.filter) {
			params.set("filter", mapContext.value.filter);
		}
		const paramsStr = params.toString();

		switch (format.value) {
			case "table": {
				if (method.value === "copy") {
					if (resolvedTypeId.value == null) {
						return undefined;
					}
					return (
						context.baseUrl
							+ client.value.padData!.id
							+ `/rawTable`
							+ `/${resolvedTypeId.value}`
							+ (paramsStr ? `?${paramsStr}` : '')
					);
				} else {
					return (
						context.baseUrl
							+ client.value.padData!.id
							+ `/table`
							+ (paramsStr ? `?${paramsStr}` : '')
					);
				}
			}

			case "csv": {
				if (resolvedTypeId.value == null) {
					return undefined;
				}
				return (
					context.baseUrl
						+ client.value.padData!.id
						+ `/csv`
						+ `/${resolvedTypeId.value}`
						+ (paramsStr ? `?${paramsStr}` : '')
				);
			}

			default: {
				return (
					context.baseUrl
						+ client.value.padData!.id
						+ `/${format.value}`
						+ (paramsStr ? `?${paramsStr}` : '')
				);
			}
		}
	});

	const modalProps = computed((): Partial<ComponentProps<typeof ModalDialog>> => {
		if (method.value === "download") {
			return {
				action: url.value,
				target: format.value === "table" ? "_blank" : undefined,
				isCreate: true,
				okLabel: "Export"
			};
		} else if (method.value === "copy") {
			return {
				isCreate: true,
				okLabel: "Copy"
			};
		} else {
			return {
				isCreate: false,
				okVariant: "secondary"
			};
		}
	});

	function handleSubmit(e: CustomSubmitEvent): void {
		if (method.value === "copy") {
			e.preventDefault();

			const fetchUrl = url.value;
			if (fetchUrl) {
				e.waitUntil((async () => {
					const res = await fetch(fetchUrl);
					const html = await res.text();
					copyToClipboard(html, { format: "text/html" });
					toasts.showToast(undefined, `${formatOptions[format.value]} export copied`, `The ${formatOptions[format.value]} export was copied to the clipboard.`, { variant: "success", autoHide: true });
				})());
			}
		}
	}
</script>

<template>
	<ModalDialog
		title="Export collaborative map"
		size="lg"
		class="fm-export-dialog"
		ref="modalRef"
		v-bind="modalProps"
		@submit="handleSubmit"
		@hidden="emit('hidden')"
	>
		<p>Export your map here to transfer it to another application, another device or another collaborative map.</p>

		<div class="row mb-3">
			<label class="col-sm-3 col-form-label" :for="`${id}-format-select`">
				Format
				<HelpPopover>
					<p>
						<strong>GPX</strong> files can be used to transfer your map data into navigation and route planning software and devices, such as
						Osmand or Garmin. They contain your markers and lines with their names and descriptions, but not their style
						attributes (with the exception of some basic attributes supported by Osmand).
					</p>
					<p>
						<strong>GeoJSON</strong> files can be used to create complete backups or copies of your map. They contain the complete data of your
						map, including the map settings, views, types, markers and lines along with all their data attributes. To restore
						a GeoJSON backup or to create a copy of your map, simply import the file into FacilMap again.
					</p>
					<p>
						<strong>HTML</strong> files can be opened by any web browser. Exporting a map to HTML will render a table with only the data
						attributes of all markers and lines. This table can also be copy&pasted into a spreadsheet application for
						further processing.
					</p>
					<p>
						<strong>CSV</strong> files can be imported into most spreadsheet applications and only contain the data attributes of the objects
						one type of marker or line.
					</p>
				</HelpPopover>
			</label>
			<div class="col-sm-9">
				<select class="form-select" v-model="format" :id="`${id}-format-select`">
					<option v-for="(label, value) in formatOptions" :value="value" :key="value">{{label}}</option>
				</select>
			</div>
		</div>

		<div class="row mb-3">
			<label class="col-sm-3 col-form-label" :for="`${id}-method`">Export method</label>
			<div class="col-sm-9">
				<select class="form-select" v-model="method" :id="`${id}-method`">
					<option v-for="(label, value) in methodOptions" :value="value" :key="value">{{label}}</option>
				</select>
			</div>
		</div>

		<div v-if="canSelectUseTracks" class="row mb-3">
			<label class="col-sm-3 col-form-label" :for="`${id}-route-type-select`">
				Route type
				<HelpPopover>
					<p>
						<strong>Track points</strong> will export your lines exactly as they are on your map.
					</p>

					<p>
						<strong>Route points</strong> will export only the from/via/to route points of your lines, and your
						navigation software/device will have to calculate the route using its own map data and algorithm.
					</p>
				</HelpPopover>
			</label>
			<div class="col-sm-9">
				<select class="form-select" v-model="useTracks" :id="`${id}-route-type-select`">
					<option value="1">Track points</option>
					<option value="0">Route points</option>
				</select>
			</div>
		</div>

		<div v-if="canSelectType" class="row mb-3">
			<label class="col-sm-3 col-form-label" :for="`${id}-type-select`">
				Type
			</label>
			<validatedField
				:value="typeId"
				:validators="[
					validateTypeId
				]"
				class="col-sm-9 position-relative"
				:immediate="validateImmediate"
			>
				<template #default="slotProps">
					<select class="form-select" v-model="typeId" :id="`${id}-type-select`" :ref="slotProps.inputRef">
						<option v-for="(type, typeId) of client.types" :key="typeId" :value="typeId">{{type.name}}</option>
					</select>
					<div class="invalid-tooltip">
						{{slotProps.validationError}}
					</div>
				</template>
			</ValidatedField>
		</div>

		<div v-if="canSelectHide" class="row mb-3">
			<label class="col-sm-3 col-form-label">Include columns</label>
			<div class="col-sm-9 fm-export-dialog-hide-options">
				<template v-for="key in hideOptions" :key="key">
					<div class="form-check fm-form-check-with-label">
						<input
							class="form-check-input"
							type="checkbox"
							:id="`${id}-show-${key}-checkbox`"
							:checked="!hide.has(key)"
							@change="hide.has(key) ? hide.delete(key) : hide.add(key)"
						>
						<label class="form-check-label" :for="`${id}-show-${key}-checkbox`">{{key}}</label>
					</div>
				</template>
			</div>
		</div>

		<div v-if="mapContext.filter" class="row mb-3">
			<label class="col-sm-3 col-form-label" :for="`${id}-filter-checkbox`">Apply filter</label>
			<div class="col-sm-9">
				<div class="form-check fm-form-check-with-label">
					<input
						class="form-check-input"
						type="checkbox"
						:id="`${id}-filter-checkbox`"
						v-model="filter"
					>
					<label class="form-check-label" :for="`${id}-filter-checkbox`">Only include objects visible under current filter</label>
				</div>
			</div>
		</div>

		<template v-if="method === 'link' && url != null">
			<hr />

			<CopyToClipboardInput
				:modelValue="url"
				readonly
				ref="copyRef"
				variant="primary"
			></CopyToClipboardInput>
		</template>
	</ModalDialog>
</template>

<style lang="scss">
	.fm-export-dialog {
		.fm-export-dialog-hide-options {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		}
	}
</style>