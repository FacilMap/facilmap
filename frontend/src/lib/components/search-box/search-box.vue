<b-card v-show="hasTabs" no-body ref="searchBox" class="fm-search-box" :class="{ isNarrow: context.isNarrow, hasFocus }" @focusin="handleFocusIn" @focusout="handleFocusOut">
	<b-tabs card align="center" v-model="tab" ref="tabsComponent" @changed="handleChanged" @activate-tab="handleActivateTab" no-fade>
		<SearchFormTab v-if="context.search"></SearchFormTab>
		<RouteFormTab v-if="context.search"></RouteFormTab>
		<MarkerInfoTab></MarkerInfoTab>
		<LineInfoTab></LineInfoTab>
		<MultipleInfoTab></MultipleInfoTab>
		<OverpassInfoTab></OverpassInfoTab>
		<portal-target name="fm-search-box" multiple></portal-target>
	</b-tabs>
	<a v-show="!context.isNarrow" href="javascript:" class="fm-search-box-resize" v-b-tooltip.hover.right="'Drag to resize, click to reset'" ref="resizeHandle"><Icon icon="resize-horizontal"></Icon></a>
</b-card>