<b-card no-body ref="searchBox" class="fm-search-box" :class="{ isNarrow, hasFocus }" @focusin="handleFocusIn" @focusout="handleFocusOut">
	<b-tabs card align="center" v-model="tab" ref="tabsComponent" @changed="handleChanged" @activate-tab="handleActivateTab" no-fade>
		<SearchFormTab></SearchFormTab>
		<RouteFormTab></RouteFormTab>
		<MarkerInfoTab></MarkerInfoTab>
		<LineInfoTab></LineInfoTab>
		<portal-target name="fm-search-box" multiple></portal-target>
	</b-tabs>
	<a v-show="!isNarrow" href="javascript:" class="fm-search-box-resize" v-b-tooltip.right="'Drag to resize, click to reset'" ref="resizeHandle"><Icon icon="resize-horizontal"></Icon></a>
</b-card>