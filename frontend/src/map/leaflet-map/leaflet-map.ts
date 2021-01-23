import template from "./leaflet-map.vue";
import Vue from "vue";
import { Component, InjectReactive } from "vue-property-decorator";
import { CLIENT_KEY } from "../client/client";
import Client from 'facilmap-client';
import { LMap, LTileLayer } from "vue2-leaflet";
import "./leaflet-map.scss";
import LeafletMapLayers from "./leaflet-map-layers";

@Component({
    template,
    components: { LMap, LTileLayer, LeafletMapLayers }
})
export default class LeafletMap extends Vue {

    @InjectReactive(CLIENT_KEY) client!: Client;

}