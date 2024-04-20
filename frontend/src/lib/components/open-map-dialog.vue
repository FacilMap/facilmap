<script setup lang="ts">
	import Icon from "./ui/icon.vue";
	import type { FindMapsResult } from "facilmap-types";
	import { computed, ref } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import Pagination from "./ui/pagination.vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { getUniqueId } from "../utils/utils";
	import ValidatedForm from "./ui/validated-form/validated-form.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import type { FacilMapContext } from "./facil-map-context-provider/facil-map-context";
	import ValidatedField from "./ui/validated-form/validated-field.vue";
	import { parseMapUrl } from "facilmap-utils";
	import { useI18n } from "../utils/i18n";

	const toasts = useToasts();
	const i18n = useI18n();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const ITEMS_PER_PAGE = 20;

	function parseMapId(val: string, context: FacilMapContext): { mapId: string; hash: string } | undefined {
		const url = val.startsWith(context.baseUrl) ? val : `${context.baseUrl}${val}`;
		return parseMapUrl(url, context.baseUrl);
	}

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

	const id = getUniqueId("fm-open-map");

	const mapId = ref("");
	const searchQuery = ref("");
	const submittedSearchQuery = ref<string>();
	const isSearching = ref(false);
	const results = ref<FindMapsResult[]>([]);
	const pages = ref(0);
	const activePage = ref(0);

	const modalRef = ref<InstanceType<typeof ModalDialog>>();
	const openFormRef = ref<InstanceType<typeof ValidatedForm>>();

	const url = computed(() => {
		const parsed = parseMapId(mapId.value, context);
		if (parsed) {
			return context.baseUrl + encodeURIComponent(parsed.mapId) + parsed.hash;
		}
	});

	function handleSubmit(): void {
		const parsed = parseMapId(mapId.value, context);
		if (parsed) {
			client.value.openMap(parsed.mapId);
			modalRef.value!.modal.hide();

			setTimeout(() => {
				// TODO: This is called too early
				mapContext.value.components.hashHandler.applyHash(parsed.hash);
			}, 0);
		}
	}

	function openResult(result: FindMapsResult): void {
		client.value.openMap(result.id);
		modalRef.value!.modal.hide();

		setTimeout(() => {
			// TODO: This is called too early
			mapContext.value.components.hashHandler.applyHash("#");
		}, 0);
	}

	async function search(query: string, page: number): Promise<void> {
		if (!query) {
			submittedSearchQuery.value = undefined;
			results.value = [];
			pages.value = 0;
			activePage.value = 0;
			return;
		}

		isSearching.value = true;
		toasts.hideToast(`fm${context.id}-open-map-search-error`);

		try {
			const newResults = await client.value.findMaps({
				query,
				start: page * ITEMS_PER_PAGE,
				limit: ITEMS_PER_PAGE
			});
			submittedSearchQuery.value = query;
			activePage.value = page;
			results.value = newResults.results;
			pages.value = Math.ceil(newResults.totalLength / ITEMS_PER_PAGE);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-open-map-search-error`, () => i18n.t("open-map-dialog.find-maps-error"), err);
		} finally {
			isSearching.value = false;
		}
	}

	function validateMapIdFormat(mapId: string) {
		const parsed = parseMapId(mapId, context);

		if (!parsed) {
			return i18n.t("open-map-dialog.map-id-format-error");
		}
	}

	async function validateMapExistence(mapId: string) {
		const parsed = parseMapId(mapId, context);

		if (parsed) {
			const mapInfo = await client.value.getMap({ padId: parsed.mapId });
			if (!mapInfo) {
				return i18n.t("open-map-dialog.map-not-found-error");
			}
		}
	}
</script>

<template>
	<ModalDialog
		:title="i18n.t('open-map-dialog.title')"
		size="lg"
		class="fm-open-map"
		ref="modalRef"
		@hidden="emit('hidden')"
	>
		<p>{{i18n.t("open-map-dialog.introduction")}}</p>
		<ValidatedField
			:value="mapId"
			:validators="mapId ? [
				validateMapIdFormat,
				validateMapExistence
			] : []"
			:reportValid="!!mapId"
			:debounceMs="300"
			class="input-group has-validation position-relative"
		>
			<template #default="slotProps">
				<input
					class="form-control"
					v-model="mapId"
					:form="`${id}-open-form`"
					:ref="slotProps.inputRef"
				/>
				<button
					type="submit"
					class="btn btn-primary"
					:disabled="!mapId"
					:form="`${id}-open-form`"
				>
					<div v-if="openFormRef?.formData.isValidating" class="spinner-border spinner-border-sm"></div>
					{{i18n.t("open-map-dialog.open-map-by-id-button")}}
				</button>
				<div class="invalid-tooltip">
					{{slotProps.validationError}}
				</div>
			</template>
		</ValidatedField>

		<hr/>

		<h4>{{i18n.t("open-map-dialog.search-public-maps")}}</h4>

		<div class="input-group">
			<input
				class="form-control"
				type="search"
				v-model="searchQuery"
				placeholder="Search term"
				:form="`${id}-search-form`"
			/>
			<button
				type="submit"
				class="btn btn-secondary"
				:disabled="isSearching"
				:form="`${id}-search-form`"
			>
				<div v-if="isSearching" class="spinner-border spinner-border-sm"></div>
				<Icon v-else icon="search" :alt="i18n.t('open-map-dialog.search-alt')"></Icon>
			</button>
		</div>

		<div v-if="submittedSearchQuery && results.length == 0" class="alert alert-danger mt-2">
			{{i18n.t("open-map-dialog.no-maps-found")}}
		</div>

		<template v-if="submittedSearchQuery && results.length > 0">
			<div class="table-wrapper">
				<table class="table table-hover table-striped">
					<thead>
						<tr>
							<th>{{i18n.t("open-map-dialog.name")}}</th>
							<th>{{i18n.t("open-map-dialog.description")}}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="result in results" :key="result.id">
							<td>{{result.name}}</td>
							<td>{{result.description}}</td>
							<td class="td-buttons">
								<a
									class="btn btn-secondary"
									:href="context.baseUrl + encodeURIComponent(result.id)"
									@click.exact.prevent="openResult(result)"
								>{{i18n.t("open-map-dialog.open-map-by-search-button")}}</a>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<Pagination
				v-if="pages > 1"
				:pages="pages"
				:modelValue="activePage"
				@update:modelValue="search(submittedSearchQuery, $event)"
			></Pagination>
		</template>
	</ModalDialog>

	<ValidatedForm
		:id="`${id}-open-form`"
		method="get"
		:action="url"
		@submit.prevent="handleSubmit"
		ref="openFormRef"
	></ValidatedForm>

	<ValidatedForm
		:id="`${id}-search-form`"
		@submit.prevent="$event.waitUntil(search(searchQuery, 0))"
		class="results"
	></ValidatedForm>
</template>

<style lang="scss">
	.fm-open-map {
		.modal-body {
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		hr {
			width: 100%;
		}

		.results {
			min-height: 0;
			display: flex;
			flex-direction: column;

			.alert, .table-wrapper {
				margin-top: 1rem;
			}

			.table-wrapper {
				overflow: auto;
				min-height: 7rem;
			}
		}
	}
</style>