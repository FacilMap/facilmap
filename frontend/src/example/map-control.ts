import WithRender from "./map-control.vue";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { InjectMapContext, MapContext } from "../lib";

@WithRender
@Component({})
export default class MapControl extends Vue {

	@InjectMapContext() mapContext!: MapContext;

}