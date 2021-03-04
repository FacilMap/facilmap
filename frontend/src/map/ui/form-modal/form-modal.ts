import WithRender from "./form-modal.vue";
import Vue from "vue";
import Component from "vue-class-component";
import { ValidationObserver } from "vee-validate";
import { Prop } from "vue-property-decorator";

@WithRender
@Component({
	components: { ValidationObserver }
})
export default class FormModal extends Vue {

	@Prop({ type: String, required: true }) readonly id!: string;
	@Prop({ type: String }) readonly title?: string;
	@Prop({ type: String }) readonly dialogClass?: string;
	@Prop({ type: Boolean }) readonly noCancel?: boolean;
	@Prop({ type: Boolean }) readonly isSaving?: boolean;
	@Prop({ type: Boolean }) readonly isCreate?: boolean;
	@Prop({ type: Boolean, default: true }) readonly isModified?: boolean;

	handleSubmit(e: Event): void {
		this.$emit("submit", e);
	}

}