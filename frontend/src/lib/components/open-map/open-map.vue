<script setup lang="ts">
	import WithRender from "./open-map.vue";
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import { Client, InjectClient, InjectContext, InjectMapComponents } from "../../utils/decorators";
	import { extend, ValidationObserver, ValidationProvider } from "vee-validate";
	import { getValidationState } from "../../utils/validation";
	import { showErrorToast } from "../../utils/toasts";
	import Icon from "../ui/icon/icon";
	import { FindPadsResult } from "facilmap-types";
	import "./open-map.scss";
	import decodeURIComponent from "decode-uri-component";
	import { Context } from "../facilmap/facilmap";
	import { MapComponents } from "../leaflet-map/leaflet-map";

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

	@WithRender
	@Component({
		components: { Icon, ValidationObserver, ValidationProvider }
	})
	export default class OpenMap extends Vue {

		@InjectContext() context!: Context;
		@InjectClient() client!: Client;
		@InjectMapComponents() mapComponents!: MapComponents;

		@Prop({ type: String, required: true }) id!: string;

		padId = "";

		searchQuery = "";
		submittedSearchQuery: string | null = null;
		isSearching = false;
		results: FindPadsResult[] = [];
		pages = 0;
		activePage = 1;

		get url(): string {
			const parsed = parsePadId(this.padId, this.context);
			return this.context.baseUrl + encodeURIComponent(parsed.padId) + parsed.hash;
		}

		getValidationState = getValidationState;

		getClient(): Client {
			return this.client;
		}

		handleSubmit(): void {
			const parsed = parsePadId(this.padId, this.context);
			this.context.activePadId = parsed.padId;
			this.$bvModal.hide(this.id);

			setTimeout(() => {
				// TODO: This is called too early
				this.mapComponents.hashHandler.applyHash(parsed.hash);
			}, 0);
		}

		openResult(result: FindPadsResult): void {
			this.context.activePadId = result.id;
			this.$bvModal.hide(this.id);

			setTimeout(() => {
				// TODO: This is called too early
				this.mapComponents.hashHandler.applyHash("#");
			}, 0);
		}

		async search(query: string, page: number): Promise<void> {
			if (!query) {
				this.submittedSearchQuery = null;
				this.results = [];
				this.pages = 0;
				this.activePage = 1;
				return;
			}

			this.isSearching = true;
			this.$bvToast.hide(`fm${this.context.id}-open-map-search-error`);

			try {
				const results = await this.client.findPads({
					query,
					start: (page - 1) * ITEMS_PER_PAGE,
					limit: ITEMS_PER_PAGE
				});
				this.submittedSearchQuery = query;
				this.activePage = page;
				this.results = results.results;
				this.pages = Math.ceil(results.totalLength / ITEMS_PER_PAGE);
			} catch (err) {
				showErrorToast(this, `fm${this.context.id}-open-map-search-error`, "Error searching for public maps", err);
			} finally {
				this.isSearching = false;
			}
		}

	}

</script>

<template>
	<b-modal :id="id" title="Open collaborative map" ok-only ok-title="Close" ok-variant="secondary" size="lg" dialog-class="fm-open-map" scrollable>
		<ValidationObserver v-slot="observer">
			<b-form method="get" :action="url" @submit.prevent="observer.handleSubmit(handleSubmit)">
				<p>Enter the link or ID of an existing collaborative map here to open that map.</p>
				<ValidationProvider name="Map ID/link" v-slot="v" :rules="{ openPadId: { getClient, context } }" :debounce="300">
					<b-form-group :state="v | validationState">
						<b-input-group>
							<b-form-input v-model="padId" :state="v | validationState"></b-form-input>
							<b-input-group-append>
								<b-button type="submit" variant="primary" :disabled="!padId">
									<b-spinner small v-if="observer.pending"></b-spinner>
									Open
								</b-button>
							</b-input-group-append>
						</b-input-group>
						<template #invalid-feedback><span v-html="v.errors[0]"></span></template>
					</b-form-group>
				</ValidationProvider>
			</b-form>
		</ValidationObserver>

		<hr/>

		<h4>Search public maps</h4>
		<b-form @submit.prevent="search(searchQuery, 1)" class="results">
			<b-input-group>
				<b-form-input type="search" v-model="searchQuery" placeholder="Search term"></b-form-input>
				<b-input-group-append>
					<b-button type="submit" variant="secondary" :disabled="isSearching">
						<b-spinner small v-if="isSearching"></b-spinner>
						<Icon v-else icon="search" alt="Search"></Icon>
					</b-button>
				</b-input-group-append>
			</b-input-group>

			<b-alert v-if="submittedSearchQuery && results.length == 0" variant="danger" show>
				No maps could be found.
			</b-alert>

			<template v-if="submittedSearchQuery && results.length > 0">
				<div class="table-wrapper">
					<b-table-simple hover striped>
						<b-thead>
							<b-tr>
								<b-th>Name</b-th>
								<b-th>Description</b-th>
								<b-th></b-th>
							</b-tr>
						</b-thead>
						<b-tbody>
							<b-tr v-for="result in results">
								<b-td>{{result.name}}</b-td>
								<b-td>{{result.description}}</b-td>
								<b-td class="td-buttons">
									<b-button
										:href="context.baseUrl + encodeURIComponent(result.id)"
										@click.exact.prevent="openResult(result)"
									>Open</b-button>
								</b-td>
							</b-tr>
						</b-tbody>
					</b-table-simple>
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
		</b-form>
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