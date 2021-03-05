<portal to="fm-search-box">
	<b-tab v-if="selection.length > 0" :title="selection.length + ' selected items'">
		{{mapContext.selection}}
	</b-tab>
</portal>