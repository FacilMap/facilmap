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