<b-tab title="Search" id="fm-search-form-tab" class="fm-search-form-tab" :fm-hash-query="hashQuery">
	<SearchForm ref="searchForm" @hash-query-change="hashQuery = $event"></SearchForm>
</b-tab>