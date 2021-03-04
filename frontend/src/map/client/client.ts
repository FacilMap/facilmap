import { Component, InjectReactive, Prop, ProvideReactive, Watch } from "vue-property-decorator";
import Vue from "vue";
import Client from "facilmap-client";
import "./client.scss";
import WithRender from "./client.vue";
import { PadId } from "facilmap-types";
import { VueDecorator } from "vue-class-component";

const CLIENT_KEY = "fm-client";

export function InjectClient(): VueDecorator {
    return InjectReactive(CLIENT_KEY);
}

@WithRender
@Component({})
export class ClientProvider extends Vue {

    @Prop({ type: String, default: "/" }) readonly serverUrl!: string;
    @Prop({ type: String }) readonly padId: string | undefined;

    @ProvideReactive(CLIENT_KEY) client: Client = null as any;

    created(): void {
        const client = new Client(this.serverUrl, this.padId);
        client._set = Vue.set;
        client._delete = Vue.delete;

        this.client = client;
    }

    beforeDestroy(): void {
        this.client.disconnect();
    }

    @Watch("client.padId")
    handlePadIdChange(padId: PadId): void {
        this.$emit("padId", padId);
    }

    @Watch("client.padData.name")
    handlePadNameChange(padName: string): void {
        this.$emit("padName", padName);
    }

}