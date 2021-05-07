<b-tab title="Search" :id="`fm${context.id}-search-form-tab`" class="fm-search-form-tab" :fm-hash-query="hashQuery">
	<SearchForm ref="searchForm" @hash-query-change="hashQuery = $event"></SearchForm>
</b-tab>