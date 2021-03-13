import WithRender from "./main.vue";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Client from 'facilmap-client';
import "./main.scss";
import { InjectClient } from "../../utils/decorators";
import Toolbox from "../toolbox/toolbox";
import context from "../context";
import SearchBox from "../search-box/search-box";
import Legend from "../legend/legend";
import LeafletMap from "../leaflet-map/leaflet-map";

@WithRender
@Component({
    components: { LeafletMap, Legend, SearchBox, Toolbox }
})
export default class Main extends Vue {

    @InjectClient() client!: Client;

    context = context;

}