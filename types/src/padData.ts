import { View } from "./view.js";
import { ID } from "./base.js";

export type PadId = string;

export interface PadDataBase {
	id: PadId;
	writeId: PadId;
	adminId: PadId;
	name: string;
	searchEngines: boolean;
	description: string;
	clusterMarkers: boolean;
	legend1: string;
	legend2: string;
	defaultViewId: ID | null;
}

export enum Writable {
	READ = 0,
	WRITE = 1,
	ADMIN = 2
}

export type PadData = Omit<PadDataBase, "writeId" | "adminId"> & Partial<Pick<PadDataBase, "writeId" | "adminId">> & {
	writable: Writable;
	defaultView?: View;
}

export type PadDataCreate = PadDataBase;
export type PadDataUpdate = Partial<PadDataCreate>;
