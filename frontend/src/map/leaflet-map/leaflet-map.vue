<div class="fm-leaflet-map-container">
    <div class="fm-leaflet-map"></div>

    <a v-if="isInFrame" :href="selfUrl" target="_blank" class="fm-open-external" uib-tooltip="Open FacilMap in full size" tooltip-placement="right"></a>
	<img src="./logo.png" class="fm-attribution-icon"/>
	<div class="fm-leaflet-map-spinner" v-show="clientContext.loading > 0">
		<img src="./spinner.gif" alt="Loading…">
	</div>
    
    <slot v-if="mapContext"></slot>

    <!-- <div class="fm-leaflet-map-disabled-cover" v-show="client.padId && (client.disconnected || client.serverError || client.deleted)"></div>
    <div class="fm-leaflet-map-loading" v-show="!loaded && !client.serverError">
        Loading...
    </div> -->
</div>