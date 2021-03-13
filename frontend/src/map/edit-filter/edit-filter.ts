import WithRender from "./edit-filter.vue";
import "./edit-filter.scss";
import Vue from "vue";
import { extend, ValidationProvider } from 'vee-validate';
import { filterHasError } from 'facilmap-utils';
import { Component, Prop } from "vue-property-decorator";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import Client from "facilmap-client";
import { Type } from "facilmap-types";
import FormModal from "../ui/form-modal/form-modal";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";

extend("filter", (filter: string): string | true => {
	return filterHasError(filter)?.message ?? true;
});

@WithRender
@Component({
	components: { FormModal, ValidationProvider }
})
export default class EditFilter extends Vue {

	@InjectMapContext() mapContext!: MapContext;
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectClient() client!: Client;

	@Prop({ type: String, required: true }) id!: string;

	filter: string = null as any;

	get types(): Type[] {
		return Object.values(this.client.types);
	}

	initialize(): void {
		this.filter = this.mapContext.filter ?? "";
	}

	get isModified(): boolean {
		return this.filter != (this.mapContext.filter ?? "");
	}

	save(): void {
		this.mapComponents.map.setFmFilter(this.filter || undefined);
		this.$bvModal.hide(this.id);
	}

}