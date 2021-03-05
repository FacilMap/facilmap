<div class="fm-search-box" :class="{ isNarrow }" v-model="tab" v-touch:start="handleTouchStart" v-touch:moving="handleTouchMove" v-touch:end="handleTouchEnd">
	<b-card no-body>
		<b-tabs card align="center">
			<b-tab title="Search">
				<p>Search</p>
			</b-tab>
			<b-tab title="Route">
				<p>Route</p>
			</b-tab>
			<portal-target name="fm-search-box"></portal-target>
		</b-tabs>
	</b-card>
</div>