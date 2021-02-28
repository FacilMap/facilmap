import { Component, InjectReactive, Prop, ProvideReactive } from "vue-property-decorator";
import Vue from "vue";
import Client from "facilmap-client";
import "./client.scss";
import WithRender from "./client.vue";

const CLIENT_KEY = "fm-client";
const CLIENT_CONTEXT_KEY = "fm-client-context";

export function InjectClient() {
    return InjectReactive(CLIENT_KEY);
}

export function InjectClientContext() {
    return InjectReactive(CLIENT_CONTEXT_KEY);
}

export interface ClientContext {
    loading: number;
    /* padId: string | undefined;
    disconnected: boolean;
    serverError: Error | undefined;
    deleted: boolean; */
}

@WithRender
@Component({})
export class ClientProvider extends Vue {

    @Prop({ type: String, default: "/" }) readonly serverUrl!: string;
    @Prop({ type: String }) readonly padId: string | undefined;

    @ProvideReactive(CLIENT_KEY) client!: Client;
    @ProvideReactive(CLIENT_CONTEXT_KEY) clientContext: ClientContext = {
        loading: 0
    };

    created(): void {
        const client = new Client(this.serverUrl, this.padId);

        this.client = client;

        client.on("loadStart", () => {
            this.clientContext.loading++;
        });
        client.on("loadEnd", () => {
            this.clientContext.loading--;
        });
    }

}