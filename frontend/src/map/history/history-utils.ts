import Client from "facilmap-client";
import { HistoryEntry } from "facilmap-types";
import { getObjectDiff, ObjectDiffItem } from "facilmap-utils";

function existsNow(client: Client, entry: HistoryEntry) {
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
	button: string;
	confirm: string;
	diff?: Array<ObjectDiffItem>;
}

export function getLabelsForHistoryEntry(client: Client, entry: HistoryEntry): HistoryEntryLabels {
	if(entry.type == "Pad") {
		return {
			description: "Changed pad settings",
			button: "Revert",
			confirm: "Do you really want to restore the old version of the pad settings?"
		};
	}

	const nameStrBefore = entry.objectBefore && entry.objectBefore.name ? "“" + entry.objectBefore.name + "”" : "";
	const nameStrAfter = entry.objectAfter && entry.objectAfter.name ? "“" + entry.objectAfter.name + "”" : "";

	const exists = existsNow(client, entry);

	const ret: Partial<HistoryEntryLabels> = {
		description: {
			create: "Created",
			update: "Changed",
			delete: "Deleted"
		}[entry.action] + " " + entry.type + " " + entry.objectId + " " + (nameStrBefore && nameStrAfter && nameStrBefore != nameStrAfter ? nameStrBefore + " (new name: " + nameStrAfter + ")" : (nameStrBefore || nameStrAfter)),
	};

	if(entry.action == "create") {
		if(exists) {
			ret.button = "Revert (delete)";
			ret.confirm = "delete";
		}
	} else if(exists) {
			ret.button = "Revert";
			ret.confirm = "restore the old version of";
	} else {
		ret.button = "Restore";
		ret.confirm = "restore";
	}

	if(ret.confirm)
		ret.confirm = "Do you really want to " + ret.confirm + " " + ((nameStrBefore || nameStrAfter) ? "the " + entry.type + " " + (nameStrBefore || nameStrAfter) : "this " + entry.type);

	if(entry.objectBefore && entry.objectAfter)
		ret.diff = getObjectDiff(entry.objectBefore, entry.objectAfter);

	return ret as HistoryEntryLabels;
}