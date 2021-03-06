<portal to="fm-search-box">
	<b-tab v-if="selection.length > 0" :title="title">
		<template v-if="selection.length == 1">
			<MarkerInfo v-if="selection[0].type == 'marker'" :markerId="selection[0].id"></MarkerInfo>
		</template>
	</b-tab>
</portal>