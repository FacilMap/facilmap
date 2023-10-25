<script setup lang="ts">
	import { getValidationState } from "../utils/validation";
	import Icon from "./ui/icon.vue";
	import { FindPadsResult } from "facilmap-types";
	import decodeURIComponent from "decode-uri-component";
	import { Context, injectContextRequired } from "../utils/context";
	import { injectClientContextRequired, injectClientRequired } from "./client-context.vue";
	import { injectMapContextRequired } from "./leaflet-map/leaflet-map.vue";
	import { computed, ref } from "vue";
	import { hideToast, showErrorToast } from "./ui/toasts/toasts.vue";

	const emit = defineEmits<{
		(type: "hide"): void;
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

	extend("openPadId", {
		validate: async (val: string, data: any) => {
			const client = data.getClient() as Client;
			const context = data.context as Context;
			const parsed = parsePadId(val, context);

			if (parsed.padId.includes("/"))
				return "Please enter a valid map ID or URL.";

			const padInfo = await client.getPad({ padId: parsed.padId });
			if (!padInfo)
				return "No map with this ID could be found.";

			return true;
		},

		params: ["getClient", "context"]
	});

	const context = injectContextRequired();
	const client = injectClientRequired();
	const clientContext = injectClientContextRequired();
	const mapContext = injectMapContextRequired();

	const padId = ref("");
	const searchQuery = ref("");
	const submittedSearchQuery = ref<string>();
	const isSearching = ref(false);
	const results = ref<FindPadsResult[]>([]);
	const pages = ref(0);
	const activePage = ref(1);

	const url = computed(() => {
		const parsed = parsePadId(padId.value, context);
		return context.baseUrl + encodeURIComponent(parsed.padId) + parsed.hash;
	});

	function handleSubmit(): void {
		const parsed = parsePadId(padId.value, context);
		clientContext.openPad(parsed.padId);
		this.$bvModal.hide(this.id);

		setTimeout(() => {
			// TODO: This is called too early
			mapContext.components.hashHandler.applyHash(parsed.hash);
		}, 0);
	}

	function openResult(result: FindPadsResult): void {
		clientContext.openPad(result.id);
		this.$bvModal.hide(this.id);

		setTimeout(() => {
			// TODO: This is called too early
			this.mapComponents.hashHandler.applyHash("#");
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
		hideToast(`fm${context.id}-open-map-search-error`);

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
			showErrorToast(`fm${context.id}-open-map-search-error`, "Error searching for public maps", err);
		} finally {
			isSearching.value = false;
		}
	}
</script>

<template>
	<b-modal :id="id" title="Open collaborative map" ok-only ok-title="Close" ok-variant="secondary" size="lg" dialog-class="fm-open-map" scrollable>
		<ValidationObserver v-slot="observer">
			<form method="get" :action="url" @submit.prevent="observer.handleSubmit(handleSubmit)">
				<p>Enter the link or ID of an existing collaborative map here to open that map.</p>
				<ValidationProvider name="Map ID/link" v-slot="v" :rules="{ openPadId: { getClient, context } }" :debounce="300">
					<b-form-group :state="v | validationState">
						<div class="input-group">
							<input class="form-control" v-model="padId" :state="v | validationState" />
							<button type="submit" class="btn btn-primary" :disabled="!padId">
								<div v-if="observer.pending" class="spinner-border spinner-border-sm"></div>
								Open
							</button>
						</div>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
					</b-form-group>
				</ValidationProvider>
			</form>
		</ValidationObserver>

		<hr/>

		<h4>Search public maps</h4>
		<form action="javascript:" @submit.prevent="search(searchQuery, 1)" class="results">
			<div class="input-group">
				<input class="form-control" type="search" v-model="searchQuery" placeholder="Search term" />
				<button type="submit" class="btn btn-secondary" :disabled="isSearching">
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
							<tr v-for="result in results">
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

				<b-pagination
					v-if="pages > 1"
					:total-rows="pages"
					:per-page="1"
					:value="activePage"
					align="center"
					@input="search(submittedSearchQuery, $event)"
				></b-pagination>
			</template>
		</form>
	</b-modal>
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