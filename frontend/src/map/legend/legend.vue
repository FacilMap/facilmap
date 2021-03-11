<div class="fm-legend" v-if="legendItems.length > 0 || legend1 || legend2">
	<b-card v-if="!isNarrow" class="fm-legend-absolute" :style="{ transform: `scale(${scale})` }" ref="absoluteContainer">
		<LegendContent :items="legendItems" :legend1="legend1" :legend2="legend2"></LegendContent>
	</b-card>
	<portal v-else to="fm-search-box">
		<b-tab title="Legend">
			<LegendContent :items="legendItems" :legend1="legend1" :legend2="legend2" no-popover></LegendContent>
		</b-tab>
	</portal>
</div>