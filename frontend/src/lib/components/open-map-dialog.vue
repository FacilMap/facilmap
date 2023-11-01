<script setup lang="ts">
	import Icon from "./ui/icon.vue";
	import { FindPadsResult } from "facilmap-types";
	import decodeURIComponent from "decode-uri-component";
	import { Context, injectContextRequired } from "../utils/context";
	import { injectClientContextRequired, injectClientRequired } from "./client-context.vue";
	import { injectMapContextRequired } from "./leaflet-map/leaflet-map.vue";
	import { computed, ref } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import Pagination from "./ui/pagination.vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { getUniqueId } from "../utils/utils";
	import ValidatedForm from "./ui/validated-form/validated-form.vue";
	import pDebounce from "p-debounce";
	import vValidity from "./ui/validated-form/validity";

	const toasts = useToasts();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const ITEMS_PER_PAGE = 20;

	function parsePadId(val: string, context: Context): { padId: string; hash: string } {
		if (val.startsWith(context.baseUrl))
			val = decodeURIComponent(val.substr(context.baseUrl.length));

		const hashIdx = val.indexOf("#");
		if (hashIdx == -1)
			return { padId: val, hash: "" };
		else
			return { padId: val.substr(0, hashIdx), hash: val.substr(hashIdx) };
	}

	const context = injectContextRequired();
	const client = injectClientRequired();
	const clientContext = injectClientContextRequired();
	const mapContext = injectMapContextRequired();

	const id = getUniqueId("fm-open-map");

	const padId = ref("");
	const searchQuery = ref("");
	const submittedSearchQuery = ref<string>();
	const isSearching = ref(false);
	const results = ref<FindPadsResult[]>([]);
	const pages = ref(0);
	const activePage = ref(1);

	const modalRef = ref<InstanceType<typeof ModalDialog>>();
	const openFormRef = ref<InstanceType<typeof ValidatedForm>>();

	const url = computed(() => {
		const parsed = parsePadId(padId.value, context);
		return context.baseUrl + encodeURIComponent(parsed.padId) + parsed.hash;
	});

	function handleSubmit(): void {
		const parsed = parsePadId(padId.value, context);
		clientContext.openPad(parsed.padId);
		modalRef.value!.modal.hide();

		setTimeout(() => {
			// TODO: This is called too early
			mapContext.components.hashHandler.applyHash(parsed.hash);
		}, 0);
	}

	function openResult(result: FindPadsResult): void {
		clientContext.openPad(result.id);
		modalRef.value!.modal.hide();

		setTimeout(() => {
			// TODO: This is called too early
			mapContext.components.hashHandler.applyHash("#");
		}, 0);
	}

	async function search(query: string, page: number): Promise<void> {
		if (!query) {
			submittedSearchQuery.value = undefined;
			results.value = [];
			pages.value = 0;
			activePage.value = 1;
			return;
		}

		isSearching.value = true;
		toasts.hideToast(`fm${context.id}-open-map-search-error`);

		try {
			const newResults = await client.findPads({
				query,
				start: (page - 1) * ITEMS_PER_PAGE,
				limit: ITEMS_PER_PAGE
			});
			submittedSearchQuery.value = query;
			activePage.value = page;
			results.value = newResults.results;
			pages.value = Math.ceil(newResults.totalLength / ITEMS_PER_PAGE);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-open-map-search-error`, "Error searching for public maps", err);
		} finally {
			isSearching.value = false;
		}
	}

	const debouncedValidatePadId = pDebounce(async (padId: string) => {
		const padInfo = await client.getPad({ padId });
		if (!padInfo) {
			return "No map with this ID could be found.";
		}
	}, 300);

	// eslint-disable-next-line vue/no-async-in-computed-properties
	const openFormError = computed(async () => {
		const parsed = parsePadId(padId.value, context);

		if (parsed.padId.includes("/")) {
			return "Please enter a valid map ID or URL.";
		}

		return debouncedValidatePadId(parsed.padId);
	});
</script>

<template>
	<ModalDialog
		title="Open collaborative map"
		size="lg"
		class="fm-open-map"
		ref="modalRef"
		@hidden="emit('hidden')"
	>
		<p>Enter the link or ID of an existing collaborative map here to open that map.</p>
		<div class="input-group">
			<input
				class="form-control"
				v-model="padId"
				v-validity="openFormError"
				:form="`${id}-open-form`"
			/>
			<button
				type="submit"
				class="btn btn-primary"
				:disabled="!padId"
				:form="`${id}-open-form`"
			>
				<div v-if="openFormRef?.formData.isValidating" class="spinner-border spinner-border-sm"></div>
				Open
			</button>
		</div>
		<div class="invalid-feedback" v-if="openFormError">
			{{openFormError}}
		</div>

		<hr/>

		<h4>Search public maps</h4>

		<div class="input-group">
			<input
				class="form-control"
				type="search"
				v-model="searchQuery"
				placeholder="Search term"
				:form="`${id}-open-form`"
			/>
			<button
				type="submit"
				class="btn btn-secondary"
				:disabled="isSearching"
				:form="`${id}-open-form`"
			>
				<div v-if="isSearching" class="spinner-border spinner-border-sm"></div>
				<Icon v-else icon="search" alt="Search"></Icon>
			</button>
		</div>

		<div v-if="submittedSearchQuery && results.length == 0" class="alert alert-danger">
			No maps could be found.
		</div>

		<template v-if="submittedSearchQuery && results.length > 0">
			<div class="table-wrapper">
				<table class="table table-hover table-striped">
					<thead>
						<tr>
							<th>Name</th>
							<th>Description</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="result in results" :key="result.id">
							<td>{{result.name}}</td>
							<td>{{result.description}}</td>
							<td class="td-buttons">
								<button
									type="button"
									class="btn btn-light"
									:href="context.baseUrl + encodeURIComponent(result.id)"
									@click.exact.prevent="openResult(result)"
								>Open</button>
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
		@submit="handleSubmit"
		ref="openFormRef"
	></ValidatedForm>

	<ValidatedForm
		:id="`${id}-search-form`"
		@submit="$event.waitUntil(search(searchQuery, 1))"
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