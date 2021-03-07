import WithRender from "./field-popover.vue";
import "./field-popover.scss";
import Vue from "vue";
import { Component } from "vue-property-decorator";
import { BPopover } from "bootstrap-vue";

@WithRender
@Component({
	props: {
		...(BPopover as any).options.props
	}
})
export default class FieldPopover extends Vue {

}