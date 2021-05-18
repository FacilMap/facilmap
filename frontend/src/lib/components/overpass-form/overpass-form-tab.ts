import WithRender from "./overpass-form-tab.vue";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { InjectContext } from "../../utils/decorators";
import "./overpass-form-tab.scss";
import { Context } from "../facilmap/facilmap";
import OverpassForm from "./overpass-form";

@WithRender
@Component({
	components: { OverpassForm }
})
export default class OverpassFormTab extends Vue {

	@InjectContext() context!: Context;

}