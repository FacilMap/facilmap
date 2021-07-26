<b-modal :id="id" title="Share" ok-only ok-title="Close" size="lg" dialog-class="fm-share" @show="initialize">
	<b-form-group label="Settings" label-cols-sm="3" label-class="pt-0">
		<b-form-checkbox v-model="includeMapView" :disabled="!client.padData">
			Include current map view (centre: <code>{{mapContext.center.lat | round(5)}},{{mapContext.center.lng | round(5)}}</code>; zoom level: <code>{{mapContext.zoom}}</code>; layer(s): {{layers}}<template v-if="mapContext.overpassIsCustom ? !!mapContext.overpassCustom : mapContext.overpassPresets.length > 0">; POIs: <code v-if="mapContext.overpassIsCustom">{{mapContext.overpassCustom}}</code><template v-else>{{mapContext.overpassPresets.map((p) => p.label).join(', ')}}</template></template><template v-if="mapContext.activeQuery">; active object(s): <template v-if="mapContext.activeQuery.description">{{mapContext.activeQuery.description}}</template><code v-else>{{mapContext.activeQuery.query}}</code></template><template v-if="mapContext.filter">; filter: <code>{{mapContext.filter}}</code></template>)
		</b-form-checkbox>

		<b-form-checkbox v-model="showToolbox">Show toolbox</b-form-checkbox>
		<b-form-checkbox v-model="showSearch">Show search box</b-form-checkbox>
		<b-form-checkbox v-model="showLegend" v-if="hasLegend">Show legend</b-form-checkbox>
	</b-form-group>

	<b-form-group v-if="client.padData" label="Link type" :label-for="`${id}-padIdType-input`" label-cols-sm="3">
		<b-form-select :id="`${id}-padIdType-input`" :options="padIdTypes" v-model="padIdType"></b-form-select>
	</b-form-group>

	<b-tabs>
		<b-tab title="Share link">
			<b-input-group class="mt-2">
				<b-form-input :value="url" readonly></b-form-input>
				<b-input-group-append>
					<b-button @click="copyUrl()">Copy</b-button>
				</b-input-group-append>
			</b-input-group>
			<p class="mt-2">Share this link with others to allow them to open your map. <a href="https://docs.facilmap.org/users/share/" target="_blank">Learn more</a></p>
		</b-tab>
		<b-tab title="Embed">
			<b-input-group class="mt-2">
				<b-form-textarea :value="embedCode" readonly></b-form-textarea>
				<b-input-group-append>
					<b-button @click="copyEmbedCode()">Copy</b-button>
				</b-input-group-append>
			</b-input-group>
			<p class="mt-2">Add this HTML code to a web page to embed FacilMap. <a href="https://docs.facilmap.org/developers/embed.html" target="_blank">Learn more</a></p>
		</b-tab>
	</b-tabs>
</b-modal>