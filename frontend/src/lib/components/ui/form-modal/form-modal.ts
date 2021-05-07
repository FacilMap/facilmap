import WithRender from "./form-modal.vue";
import Vue from "vue";
import Component from "vue-class-component";
import { ValidationObserver } from "vee-validate";
import { Prop, Ref } from "vue-property-decorator";

@WithRender
@Component({
	components: { ValidationObserver }
})
export default class FormModal extends Vue {

	@Ref() form!: HTMLElement;

	@Prop({ type: String, required: true }) readonly id!: string;
	@Prop({ type: String }) readonly title?: string;
	@Prop({ type: String }) readonly dialogClass?: string;
	@Prop({ type: Boolean }) readonly noCancel?: boolean;
	@Prop({ type: Boolean }) readonly isSaving?: boolean;
	@Prop({ type: Boolean }) readonly isBusy?: boolean;
	@Prop({ type: Boolean }) readonly isCreate?: boolean;
	@Prop({ type: Boolean, default: true }) readonly isModified?: boolean;
	@Prop({ type: String }) readonly size?: string;
	@Prop({ type: String }) readonly okTitle?: string;

	async handleSubmit(observer: InstanceType<typeof ValidationObserver>): Promise<void> {
		if (await observer.validate())
			this.$emit("submit");
		else {
			const error = this.form.querySelector(".is-invalid");
			if (error)
				error.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}

}