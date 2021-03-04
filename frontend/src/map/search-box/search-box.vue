<div class="fm-search-box" :class="{ isNarrow }" v-model="tab" v-touch:start="handleTouchStart" v-touch:moving="handleTouchMove" v-touch:end="handleTouchEnd">
	<b-card no-body>
		<b-tabs card align="center">
			<b-tab title=""></b-tab> <!-- title-item-class="d-none" -->
			<b-tab title="Test 1">
				<p>Test 1</p>
			</b-tab>
			<b-tab title="Test 2">
				<p>Test 2</p>
			</b-tab>
			<portal-target name="fm-search-box"></portal-target>
		</b-tabs>
	</b-card>
</div>