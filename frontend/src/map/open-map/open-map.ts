import WithRender from "./open-map.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Client, InjectClient } from "../../utils/decorators";
import { extend, ValidationObserver, ValidationProvider } from "vee-validate";
import context from "../context";
import { getValidationState } from "../../utils/validation";
import { showErrorToast } from "../../utils/toasts";
import Icon from "../ui/icon/icon";
import { FindPadsResult } from "facilmap-types";
import "./open-map.scss";
import decodeURIComponent from "decode-uri-component";

const ITEMS_PER_PAGE = 20;

function parsePadId(val: string): { padId: string; hash: string } {
	if (val.startsWith(context.urlPrefix))
		val = decodeURIComponent(val.substr(context.urlPrefix.length));

	const hashIdx = val.indexOf("#");
	if (hashIdx == -1)
		return { padId: val, hash: "" };
	else
		return { padId: val.substr(0, hashIdx), hash: val.substr(hashIdx) };
}

extend("openPadId", {
	validate: async (val: string, data: any) => {
		const client = data.getClient() as Client;
		const parsed = parsePadId(val);

		if (parsed.padId.includes("/"))
			return "Please enter a valid map ID or URL.";

		const padInfo = await client.getPad({ padId: parsed.padId });
		if (!padInfo)
			return "No map with this ID could be found.";

		return true;
	},

	params: ["getClient"]
});

@WithRender
@Component({
	components: { Icon, ValidationObserver, ValidationProvider }
})
export default class OpenMap extends Vue {

	@InjectClient() client!: Client;

	@Prop({ type: String, required: true }) id!: string;

	padId = "";

	searchQuery = "";
	submittedSearchQuery: string | null = null;
	isSearching = false;
	results: FindPadsResult[] = [];
	pages = 0;
	activePage = 1;

	get url(): string {
		const parsed = parsePadId(this.padId);
		return context.urlPrefix + encodeURIComponent(parsed.padId) + parsed.hash;
	}

	get urlPrefix(): string {
		return context.urlPrefix;
	}

	getValidationState = getValidationState;

	getClient(): Client {
		return this.client;
	}

	handleSubmit(): void {
		location.href = this.url;
	}

	async search(query: string, page: number): Promise<void> {
		if (!query) {
			this.submittedSearchQuery = null;
			this.results = [];
			this.pages = 0;
			this.activePage = 1;
			return;
		}

		this.isSearching = true;
		this.$bvModal.hide("fm-open-map-search-error");

		try {
			const results = await this.client.findPads({
				query,
				start: (page - 1) * ITEMS_PER_PAGE,
				limit: ITEMS_PER_PAGE
			});
			this.submittedSearchQuery = query;
			this.activePage = page;
			this.results = results.results;
			this.pages = Math.ceil(results.totalLength / ITEMS_PER_PAGE);
		} catch (err) {
			showErrorToast(this, "fm-open-map-search-error", "Error searching for public maps", err);
		} finally {
			this.isSearching = false;
		}
	}

}
