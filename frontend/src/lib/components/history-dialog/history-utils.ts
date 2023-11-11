import type { HistoryEntry } from "facilmap-types";
import { getObjectDiff, type ObjectDiffItem } from "facilmap-utils";
import type { ClientContext } from "../facil-map-context-provider/client-context";

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
	if(entry.type == "Pad") {
		return {
			description: "Changed map settings",
			revert: {
				title: "Revert map settings",
				message: "Do you really want to restore the old version of the map settings?",
				button: "Revert",
				okLabel: "Revert"
			},
			...(entry.objectBefore && entry.objectAfter ? { diff: getObjectDiff(entry.objectBefore, entry.objectAfter) } : {}),
		};
	}

	const nameStrBefore = entry.objectBefore && entry.objectBefore.name ? `“${entry.objectBefore.name}”` : "";
	const nameStrAfter = entry.objectAfter && entry.objectAfter.name ? `“${entry.objectAfter.name}”` : "";
	const exists = existsNow(client, entry);
	const descriptionAction = { create: "Created", update: "Changed", delete: "Deleted" }[entry.action];
	const descriptionName = (nameStrBefore && nameStrAfter && nameStrBefore != nameStrAfter ? `${nameStrBefore} (new name: ${nameStrAfter})` : (nameStrBefore || nameStrAfter));
	const diff = entry.objectBefore && entry.objectAfter ? getObjectDiff(entry.objectBefore, entry.objectAfter) : undefined;
	const revert = (
		entry.action === "create" ? (
			exists ? {
				title: `Delete ${entry.type}`,
				button: "Revert (delete)",
				message: "delete",
				okLabel: "Delete"
			} : undefined
		) : exists ? {
			title: `Revert ${entry.type}`,
			button: "Revert",
			message: "restore the old version of",
			okLabel: "Revert"
		} : {
			title: `Restore ${entry.type}`,
			button: "Restore",
			message: "restore",
			okLabel: "Restore"
		}
	);

	return {
		description: `${descriptionAction} ${entry.type} ${entry.objectId} ${descriptionName}`,
		revert: revert && {
			...revert,
			message: `Do you really want to ${revert.message} ${((nameStrBefore || nameStrAfter) ? `the ${entry.type} ${(nameStrBefore || nameStrAfter)}` : `this ${entry.type}`)}?`
		},
		...(diff ? { diff } : {})
	};
}