import { Component, Prop, ProvideReactive, Watch } from "vue-property-decorator";
import Vue from "vue";
import FmClient from "facilmap-client";
import "./client.scss";
import WithRender from "./client.vue";
import { PadData, PadId } from "facilmap-types";
import context from "../context";
import PadSettings from "../pad-settings/pad-settings";
import { Client, CLIENT_INJECT_KEY } from "../../utils/decorators";
import StringMap from "../../utils/string-map";
import storage from "../../utils/storage";

@WithRender
@Component({
    components: { PadSettings }
})
export class ClientProvider extends Vue {

    @Prop({ type: String }) readonly padId: string | undefined;

    @ProvideReactive(CLIENT_INJECT_KEY) client: Client = null as any;

    createId: string | null = null;
    connecting = true;
    loaded = false;

    created(): void {
        const client = new FmClient<StringMap>(context.urlPrefix, this.padId);
        client._set = Vue.set;
        client._delete = Vue.delete;
        client._encodeData = (data) => data.toObject();
        client._decodeData = (data) => new StringMap(data);

        client.on("connect", () => {
            this.connecting = false;
        });

        this.client = client;

        client.once(this.padId ? "padData" : "connect", () => {
            this.loaded = true;
        });
    }

    beforeDestroy(): void {
        this.client.disconnect();
    }

    get closeHref(): string {
        return context.urlPrefix;
    }

    @Watch("client.padId")
    handlePadIdChange(padId: PadId, oldPadId: PadId | undefined): void {
        this.$emit("padId", padId);

        if (oldPadId) {
            for (const bookmark of storage.bookmarks) {
                if (bookmark.id == oldPadId)
                    bookmark.id = padId;
            }
        }
    }

    @Watch("client.padData.name")
    handlePadNameChange(padName: string): void {
        this.$emit("padName", padName);
    }

    @Watch("client.padData")
    handlePadDataChange(newPadData: PadData, oldPadData: PadData | undefined): void {
        for (const bookmark of storage.bookmarks) {
            if (oldPadData && oldPadData.id == bookmark.padId)
                bookmark.padId = newPadData.id;

            if (bookmark.padId == newPadData.id)
                bookmark.name = newPadData.name;
        }
    }

    @Watch("client.serverError")
    handleServerErrorChange(serverError: Error | undefined): void {
        if (serverError?.message?.includes("does not exist") && context.interactive) {
            this.client.serverError = undefined;
            this.createId = context.activePadId;
            setTimeout(() => {
                this.$bvModal.show("fm-client-create-pad");
            }, 0);
        }
    }


}