<div class="fm-leaflet-map-container" :class="{ isNarrow: context.isNarrow }">
    <slot name="before" v-if="mapContext"></slot>

    <div class="fm-leaflet-map-wrapper">
        <div class="fm-leaflet-map-inner-container" ref="innerContainer">
            <div class="fm-leaflet-map"></div>

            <a v-if="context.linkLogo" :href="selfUrl" target="_blank" class="fm-open-external" uib-tooltip="Open FacilMap in full size" tooltip-placement="right"></a>
            <div class="fm-logo">
                <img src="./logo.png"/>
            </div>
            <b-spinner class="fm-leaflet-map-spinner" v-show="client.loading > 0"></b-spinner>

            <slot v-if="mapContext"></slot>
        </div>

        <slot name="after" v-if="mapContext"></slot>
    </div>

    <div class="fm-leaflet-map-disabled-cover" v-show="client.padId && (client.disconnected || client.serverError || client.deleted)"></div>
    <div class="fm-leaflet-map-loading" v-show="!loaded && !client.serverError">
        Loading...
    </div>
</div>