import { Component, Prop, ProvideReactive } from "vue-property-decorator";
import Vue from "vue";
import Client from "facilmap-client";
import "./client.scss";

export const CLIENT_KEY = "fm-client";

@Component({
    template: `<div class="fm-client-provider"><slot/></div>`
})
export class ClientProvider extends Vue {

    @Prop({ type: String, default: "/" }) readonly serverUrl!: string;
    @Prop({ type: String }) readonly padId: string | undefined;

    @ProvideReactive(CLIENT_KEY) client!: Client;

    created(): void {
        this.client = new Client(this.serverUrl, this.padId);
    }

}