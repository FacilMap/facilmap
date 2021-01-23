import template from "./main.vue";
import Vue from "vue";
import { Component, InjectReactive } from "vue-property-decorator";
import { CLIENT_KEY } from "../client/client";
import Client from 'facilmap-client';
import LeafletMap from '../leaflet-map/leaflet-map';
import "./main.scss";

@Component({
    template,
    components: { LeafletMap }
})
export default class Main extends Vue {

    @InjectReactive(CLIENT_KEY) client!: Client;

}