<b-card no-body ref="searchBox" class="fm-search-box" :class="{ isNarrow, hasFocus }" @focusin="hasFocus = true" @focusout="hasFocus = false">
	<b-tabs card align="center" v-model="tab" ref="tabsComponent" @changed="handleChanged" @activate-tab="handleActivateTab" no-fade>
		<SearchFormTab></SearchFormTab>
		<MarkerInfoTab></MarkerInfoTab>
		<LineInfoTab></LineInfoTab>
		<portal-target name="fm-search-box" multiple></portal-target>
	</b-tabs>
	<a v-show="!isNarrow" href="javascript:" class="fm-search-box-resize" :title="isResizing ? '' : 'Drag to resize, click to reset'" v-b-tooltip.bottom ref="resizeHandle"><Icon icon="resize-horizontal"></Icon></a>
</b-card>