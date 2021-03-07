<div class="fm-search-box" :class="{ isNarrow }" v-touch:start="handleTouchStart" v-touch:moving="handleTouchMove" v-touch:end="handleTouchEnd">
	<b-card no-body>
		<b-tabs card align="center" @changed="handleChanged" v-model="tab">
			<portal-target name="fm-search-box" multiple></portal-target>
		</b-tabs>
	</b-card>
	<portal to="fm-search-box">
		<b-tab title="Search">
			<p>Search</p>
		</b-tab>
		<b-tab title="Route">
			<p>Route</p>
		</b-tab>
	</portal>
</div>