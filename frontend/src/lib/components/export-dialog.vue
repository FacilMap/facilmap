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
	import { formatFieldName, formatTypeName, getOrderedTypes } from "facilmap-utils";
	import { T, useI18n } from "../utils/i18n";

	const toasts = useToasts();
	const i18n = useI18n();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

	const id = getUniqueId("fm-export-map");

	const orderedTypes = computed(() => getOrderedTypes(client.value.types));

	const modalRef = ref<InstanceType<typeof ModalDialog>>();

	const copyRef = ref<InstanceType<typeof CopyToClipboardInput>>();

	const formatOptions = computed(() => ({
		gpx: i18n.t("export-dialog.format-option-gpx"),
		geojson: i18n.t("export-dialog.format-option-geojson"),
		table: i18n.t("export-dialog.format-option-html"),
		csv: i18n.t("export-dialog.format-option-csv")
	}));

	const hideOptions = computed(() => ({
		Name: i18n.t("export-dialog.column-name"),
		Position: i18n.t("export-dialog.column-position"),
		Distance: i18n.t("export-dialog.column-distance"),
		Time: i18n.t("export-dialog.column-time"),
		// TODO: Include only types not currently filtered
		...Object.fromEntries(orderedTypes.value.flatMap((type) => type.fields.map((field) => [field.name, formatFieldName(field.name)])))
	}));

	const routeTypeOptions = computed(() => ({
		"tracks": i18n.t("export-dialog.route-type-track"),
		"zip": i18n.t("export-dialog.route-type-track-zip"),
		"routes": i18n.t("export-dialog.route-type-route")
	}));

	const format = ref<keyof typeof formatOptions["value"]>("gpx");
	const routeType = ref<keyof typeof routeTypeOptions["value"]>("tracks");
	const filter = ref(true);
	const hide = ref(new Set<string>());
	const typeId = ref<ID>();

	const methodOptions = computed(() => ({
		download: format.value === "table" ? i18n.t("export-dialog.open-file") : i18n.t("export-dialog.download-file"),
		link: i18n.t("export-dialog.generate-link"),
		...(format.value === "table" ? {
			copy: i18n.t("export-dialog.copy-to-clipboard")
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

	const canSelectRouteType = computed(() => format.value === "gpx");
	const canSelectType = computed(() => format.value === "csv" || (format.value === "table" && method.value === "copy"));
	const mustSelectType = computed(() => canSelectType.value);
	const canSelectHide = computed(() => ["table", "csv"].includes(format.value));
	const validateImmediate = computed(() => method.value === "link"); // No submit button

	function validateTypeId(typeId: ID | undefined) {
		if (mustSelectType.value && resolveTypeId(typeId) == null) {
			return i18n.t("export-dialog.select-type-error");
		}
	}

	const url = computed(() => {
		const params = new URLSearchParams();
		if (canSelectRouteType.value) {
			params.set("useTracks", routeType.value === "routes" ? "0" : "1");
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
							+ client.value.mapData!.id
							+ `/rawTable`
							+ `/${resolvedTypeId.value}`
							+ (paramsStr ? `?${paramsStr}` : '')
					);
				} else {
					return (
						context.baseUrl
							+ client.value.mapData!.id
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
						+ client.value.mapData!.id
						+ `/csv`
						+ `/${resolvedTypeId.value}`
						+ (paramsStr ? `?${paramsStr}` : '')
				);
			}

			case "gpx": {
				return (
					context.baseUrl
						+ client.value.mapData!.id
						+ `/${format.value}`
						+ (routeType.value === "zip" ? `/zip` : "")
						+ (paramsStr ? `?${paramsStr}` : '')
				);
			}

			default: {
				return (
					context.baseUrl
						+ client.value.mapData!.id
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
				okLabel: i18n.t("export-dialog.export-ok")
			};
		} else if (method.value === "copy") {
			return {
				isCreate: true,
				okLabel: i18n.t("export-dialog.copy-ok")
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
					toasts.showToast(undefined, () => i18n.t("export-dialog.export-copied-title", { format: formatOptions.value[format.value] }), () => i18n.t("export-dialog.export-copied-message", { format: formatOptions.value[format.value] }), { variant: "success", autoHide: true });
				})());
			}
		}
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('export-dialog.title')"
		size="lg"
		class="fm-export-dialog"
		ref="modalRef"
		v-bind="modalProps"
		@submit="handleSubmit"
		@hidden="emit('hidden')"
	>
		<p>{{i18n.t("export-dialog.introduction")}}</p>

		<div class="row mb-3">
			<label class="col-sm-3 col-form-label" :for="`${id}-format-select`">
				{{i18n.t("export-dialog.format")}}
				<HelpPopover>
					<p>
						<T k="export-dialog.gpx-explanation">
							<template #gpx>
								<strong>{{i18n.t("export-dialog.gpx-explanation-interpolation-gpx")}}</strong>
							</template>
						</T>
					</p>
					<p>
						<T k="export-dialog.geojson-explanation">
							<template #geojson>
								<strong>{{i18n.t("export-dialog.geojson-explanation-interpolation-geojson")}}</strong>
							</template>
						</T>
					</p>
					<p>
						<T k="export-dialog.html-explanation">
							<template #html>
								<strong>{{i18n.t("export-dialog.html-explanation-interpolation-html")}}</strong>
							</template>
						</T>
					</p>
					<p>
						<T k="export-dialog.csv-explanation">
							<template #csv>
								<strong>{{i18n.t("export-dialog.csv-explanation-interpolation-csv")}}</strong>
							</template>
						</T>
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
			<label class="col-sm-3 col-form-label" :for="`${id}-method`">{{i18n.t("export-dialog.export-method")}}</label>
			<div class="col-sm-9">
				<select class="form-select" v-model="method" :id="`${id}-method`">
					<option v-for="(label, value) in methodOptions" :value="value" :key="value">{{label}}</option>
				</select>
			</div>
		</div>

		<div v-if="canSelectRouteType" class="row mb-3">
			<label class="col-sm-3 col-form-label" :for="`${id}-route-type-select`">
				{{i18n.t("export-dialog.route-type")}}
				<HelpPopover>
					<p>
						<T k="export-dialog.track-explanation">
							<template #track>
								<strong>{{i18n.t("export-dialog.track-explanation-interpolation-track")}}</strong>
							</template>
						</T>
					</p>
					<p>
						<T k="export-dialog.track-zip-explanation">
							<template #trackZip>
								<strong>{{i18n.t("export-dialog.track-zip-explanation-interpolation-trackZip")}}</strong>
							</template>
						</T>
					</p>
					<p>
						<T k="export-dialog.route-explanation">
							<template #route>
								<strong>{{i18n.t("export-dialog.route-explanation-interpolation-route")}}</strong>
							</template>
						</T>
					</p>
				</HelpPopover>
			</label>
			<div class="col-sm-9">
				<select class="form-select" v-model="routeType" :id="`${id}-route-type-select`">
					<option v-for="(label, value) in routeTypeOptions" :value="value" :key="value">{{label}}</option>
				</select>
			</div>
		</div>

		<div v-if="canSelectType" class="row mb-3">
			<label class="col-sm-3 col-form-label" :for="`${id}-type-select`">
				{{i18n.t("export-dialog.type")}}
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
						<option v-for="type of orderedTypes" :key="type.id" :value="type.id">{{formatTypeName(type.name)}}</option>
					</select>
					<div class="invalid-tooltip">
						{{slotProps.validationError}}
					</div>
				</template>
			</ValidatedField>
		</div>

		<div v-if="canSelectHide" class="row mb-3">
			<label class="col-sm-3 col-form-label">{{i18n.t("export-dialog.include-columns")}}</label>
			<div class="col-sm-9 fm-export-dialog-hide-options">
				<template v-for="(label, value) in hideOptions" :key="value">
					<div class="form-check fm-form-check-with-label">
						<input
							class="form-check-input"
							type="checkbox"
							:id="`${id}-show-${value}-checkbox`"
							:checked="!hide.has(value)"
							@change="hide.has(value) ? hide.delete(value) : hide.add(value)"
						>
						<label class="form-check-label" :for="`${id}-show-${value}-checkbox`">{{label}}</label>
					</div>
				</template>
			</div>
		</div>

		<div v-if="mapContext.filter" class="row mb-3">
			<label class="col-sm-3 col-form-label" :for="`${id}-filter-checkbox`">{{i18n.t("export-dialog.apply-filter")}}</label>
			<div class="col-sm-9">
				<div class="form-check fm-form-check-with-label">
					<input
						class="form-check-input"
						type="checkbox"
						:id="`${id}-filter-checkbox`"
						v-model="filter"
					>
					<label class="form-check-label" :for="`${id}-filter-checkbox`">{{i18n.t("export-dialog.apply-filter-label")}}</label>
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