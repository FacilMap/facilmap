<portal to="fm-search-box">
	<b-tab v-if="selection.length > 0" :title="title">
		<template v-if="selection.length == 1">
			<MarkerInfo v-if="selection[0].type == 'marker'" :markerId="selection[0].id"></MarkerInfo>
			<LineInfo v-else-if="selection[0].type == 'line'" :lineId="selection[0].id"></LineInfo>
		</template>
	</b-tab>
</portal>