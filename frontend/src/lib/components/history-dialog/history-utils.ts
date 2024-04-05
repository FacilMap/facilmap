import type { HistoryEntry } from "facilmap-types";
import { getObjectDiff, type ObjectDiffItem } from "facilmap-utils";
import type { ClientContext } from "../facil-map-context-provider/client-context";
import { getI18n } from "../../utils/i18n";

function existsNow(client: ClientContext, entry: HistoryEntry) {
	// Look through the history of this particular object and see if the last entry indicates that the object exists now

	let ret = null;
	let time = 0;
	for(const i in client.history) {
		const item2 = client.history[i];

		const time2 = new Date(item2.time).getTime();
		if(item2.type == entry.type && item2.objectId == entry.objectId && time2 > time) {
			ret = (item2.action != "delete");
			time = time2;
		}
	}

	return ret;
}

export interface HistoryEntryLabels {
	description: string;
	revert?: {
		title: string;
		message: string;
		button: string;
		okLabel: string;
	},
	diff?: Array<ObjectDiffItem>;
}

export function getLabelsForHistoryEntry(client: ClientContext, entry: HistoryEntry): HistoryEntryLabels {
	const i18n = getI18n();

	if(entry.type == "Pad") {
		return {
			description: i18n.t("history-utils.description-update-map"),
			revert: {
				title: i18n.t("history-utils.revert-update-map-title"),
				message: i18n.t("history-utils.revert-update-map-message"),
				button: i18n.t("history-utils.revert-update"),
				okLabel: i18n.t("history-utils.revert-update-button")
			},
			...(entry.objectBefore && entry.objectAfter ? { diff: getObjectDiff(entry.objectBefore, entry.objectAfter) } : {}),
		};
	}

	const nameStrBefore = entry.objectBefore && entry.objectBefore.name ? i18n.t("history-utils.description-interpolation-quotedName", { name: entry.objectBefore.name }) : "";
	const nameStrAfter = entry.objectAfter && entry.objectAfter.name ? i18n.t("history-utils.description-interpolation-quotedName", { name: entry.objectAfter.name }) : "";
	const exists = existsNow(client, entry);
	const descriptionName = (nameStrBefore && nameStrAfter && nameStrBefore != nameStrAfter ? (
		i18n.t("history-utils.description-interpolation-quotedName-renamed", { quotedBefore: nameStrBefore, quotedAfter: nameStrAfter })
	) : (nameStrBefore || nameStrAfter));
	const diff = entry.objectBefore && entry.objectAfter ? getObjectDiff(entry.objectBefore, entry.objectAfter) : undefined;
	const revert = (
		entry.action === "create" ? (
			exists ? {
				button: i18n.t("history-utils.revert-create"),
				title: {
					Marker: i18n.t("history-utils.revert-create-marker-title"),
					Line: i18n.t("history-utils.revert-create-line-title"),
					View: i18n.t("history-utils.revert-create-view-title"),
					Type: i18n.t("history-utils.revert-create-type-title")
				}[entry.type],
				message: {
					Marker: nameStrBefore || nameStrAfter
						? i18n.t("history-utils.revert-create-marker-message-named", { quotedName: nameStrBefore || nameStrAfter })
						: i18n.t("history-utils.revert-create-marker-message-unnamed"),
					Line: nameStrBefore || nameStrAfter
						? i18n.t("history-utils.revert-create-line-message-named", { quotedName: nameStrBefore || nameStrAfter })
						: i18n.t("history-utils.revert-create-line-message-unnamed"),
					View: nameStrBefore || nameStrAfter
						? i18n.t("history-utils.revert-create-view-message-named", { quotedName: nameStrBefore || nameStrAfter })
						: i18n.t("history-utils.revert-create-view-message-unnamed"),
					Type: nameStrBefore || nameStrAfter
						? i18n.t("history-utils.revert-create-type-message-named", { quotedName: nameStrBefore || nameStrAfter })
						: i18n.t("history-utils.revert-create-type-message-unnamed"),
				}[entry.type],
				okLabel: i18n.t("history-utils.revert-create-button")
			} : undefined
		) : exists ? {
			button: i18n.t("history-utils.revert-update"),
			title: {
				Marker: i18n.t("history-utils.revert-update-marker-title"),
				Line: i18n.t("history-utils.revert-update-line-title"),
				View: i18n.t("history-utils.revert-update-view-title"),
				Type: i18n.t("history-utils.revert-update-type-title")
			}[entry.type],
			message: {
				Marker: nameStrBefore || nameStrAfter
					? i18n.t("history-utils.revert-update-marker-message-named", { quotedName: nameStrBefore || nameStrAfter })
					: i18n.t("history-utils.revert-update-marker-message-unnamed"),
				Line: nameStrBefore || nameStrAfter
					? i18n.t("history-utils.revert-update-line-message-named", { quotedName: nameStrBefore || nameStrAfter })
					: i18n.t("history-utils.revert-update-line-message-unnamed"),
				View: nameStrBefore || nameStrAfter
					? i18n.t("history-utils.revert-update-view-message-named", { quotedName: nameStrBefore || nameStrAfter })
					: i18n.t("history-utils.revert-update-view-message-unnamed"),
				Type: nameStrBefore || nameStrAfter
					? i18n.t("history-utils.revert-update-type-message-named", { quotedName: nameStrBefore || nameStrAfter })
					: i18n.t("history-utils.revert-update-type-message-unnamed"),
			}[entry.type],
			okLabel: i18n.t("history-utils.revert-update-button")
		} : {
			button: i18n.t("history-utils.revert-delete"),
			title: {
				Marker: i18n.t("history-utils.revert-delete-marker-title"),
				Line: i18n.t("history-utils.revert-delete-line-title"),
				View: i18n.t("history-utils.revert-delete-view-title"),
				Type: i18n.t("history-utils.revert-delete-type-title")
			}[entry.type],
			message: {
				Marker: nameStrBefore || nameStrAfter
					? i18n.t("history-utils.revert-delete-marker-message-named", { quotedName: nameStrBefore || nameStrAfter })
					: i18n.t("history-utils.revert-delete-marker-message-unnamed"),
				Line: nameStrBefore || nameStrAfter
					? i18n.t("history-utils.revert-delete-line-message-named", { quotedName: nameStrBefore || nameStrAfter })
					: i18n.t("history-utils.revert-delete-line-message-unnamed"),
				View: nameStrBefore || nameStrAfter
					? i18n.t("history-utils.revert-delete-view-message-named", { quotedName: nameStrBefore || nameStrAfter })
					: i18n.t("history-utils.revert-delete-view-message-unnamed"),
				Type: nameStrBefore || nameStrAfter
					? i18n.t("history-utils.revert-delete-type-message-named", { quotedName: nameStrBefore || nameStrAfter })
					: i18n.t("history-utils.revert-delete-type-message-unnamed"),
			}[entry.type],
			okLabel: i18n.t("history-utils.revert-delete-button")
		}
	);

	return {
		description: {
			create: {
				Marker: i18n.t("history-utils.description-create-marker", { id: entry.objectId, quotedName: descriptionName }),
				Line: i18n.t("history-utils.description-create-line", { id: entry.objectId, quotedName: descriptionName }),
				View: i18n.t("history-utils.description-create-view", { id: entry.objectId, quotedName: descriptionName }),
				Type: i18n.t("history-utils.description-create-type", { id: entry.objectId, quotedName: descriptionName })
			}[entry.type],
			update: {
				Marker: i18n.t("history-utils.description-update-marker", { id: entry.objectId, quotedName: descriptionName }),
				Line: i18n.t("history-utils.description-update-line", { id: entry.objectId, quotedName: descriptionName }),
				View: i18n.t("history-utils.description-update-view", { id: entry.objectId, quotedName: descriptionName }),
				Type: i18n.t("history-utils.description-update-type", { id: entry.objectId, quotedName: descriptionName })
			}[entry.type],
			delete: {
				Marker: i18n.t("history-utils.description-delete-marker", { id: entry.objectId, quotedName: descriptionName }),
				Line: i18n.t("history-utils.description-delete-line", { id: entry.objectId, quotedName: descriptionName }),
				View: i18n.t("history-utils.description-delete-view", { id: entry.objectId, quotedName: descriptionName }),
				Type: i18n.t("history-utils.description-delete-type", { id: entry.objectId, quotedName: descriptionName })
			}[entry.type]
		}[entry.action],
		revert,
		...(diff ? { diff } : {})
	};
}