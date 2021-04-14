<portal to="fm-search-box">
	<b-tab v-for="(result, idx) in results" :id="`fm-click-marker-tab-${idx}`">
		<template #title>
			<span class="closeable-tab-title">
				<span>{{result.short_name}}</span>
				<object><a href="javascript:" @click="close(result)"><Icon icon="remove" alt="Close"></Icon></a></object>
			</span>
		</template>
		<SearchResultInfo
			:result="result"
			:is-adding="isAdding"
			@add-to-map="addToMap(result, $event)"
			@use-as-from="useAsFrom(result)"
			@use-as-via="useAsVia(result)"
			@use-as-to="useAsTo(result)"
		></SearchResultInfo>
	</b-tab>
</portal>