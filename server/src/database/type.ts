import { keys, typeValidator, type CRU, type ID, type Type } from "facilmap-types";
import Database from "./database.js";
import { iterableToArray } from "../utils/streams.js";
import { cloneDeep, insertIdx } from "facilmap-utils";
import type DatabaseTypesBackend from "../database-backend/type.js";
import { getI18n } from "../i18n.js";
import { isEqual } from "lodash-es";
import { pickIdentity } from "../utils/permissions.js";

const DEFAULT_TYPES: Type<CRU.CREATE_VALIDATED>[] = [
	typeValidator.create.parse({ name: "Marker", type: "marker" } satisfies Type<CRU.CREATE>),
	typeValidator.create.parse({ name: "Line", type: "line" } satisfies Type<CRU.CREATE>)
];

export default class DatabaseTypes {

	protected db: Database;
	protected backend: DatabaseTypesBackend;

	constructor(database: Database) {
		this.db = database;
		this.backend = database.backend.types;
	}

	getTypes(mapId: ID): AsyncIterable<Type> {
		return this.backend.getTypes(mapId);
	}

	async typeExists(mapId: ID, typeId: ID): Promise<boolean> {
		return await this.backend.typeExists(mapId, typeId);
	}

	async getType(mapId: ID, typeId: ID, options?: { notFound404?: boolean }): Promise<Type> {
		const result = await this.backend.getType(mapId, typeId);
		if (!result) {
			throw Object.assign(
				new Error(getI18n().t("database.object-not-found-in-map-error", { type: "Type", id: typeId, mapId })),
				options?.notFound404 ? { status: 404 } : {}
			);
		}
		return result;
	}

	async _freeTypeIdx(mapId: ID, typeId: ID | undefined, newIdx: number | undefined): Promise<number> {
		const existingTypes = await iterableToArray(this.getTypes(mapId));

		const resolvedNewIdx = newIdx ?? (existingTypes.length > 0 ? existingTypes[existingTypes.length - 1].idx + 1 : 0);

		const newIndexes = insertIdx(existingTypes, typeId, resolvedNewIdx).reverse();

		for (const obj of newIndexes) {
			if ((typeId == null || obj.id !== typeId) && obj.oldIdx !== obj.newIdx) {
				await this.backend.updateType(mapId, obj.id, { idx: obj.newIdx });
				const result = await this.getType(mapId, obj.id);
				this.db.emit("type", result.mapId, result);
			}
		}

		return resolvedNewIdx;
	}

	async createType(mapId: ID, data: Type<CRU.CREATE_VALIDATED>, options: {
		id?: ID;
		identities: Buffer[];
		noHistory?: boolean;
	}): Promise<Type> {
		const [idx, nextFieldId] = await Promise.all([
			this._freeTypeIdx(mapId, undefined, data.idx),
			this.db.maps.getNextFieldId(mapId, data.fields.length)
		]);

		const createdType = await this.backend.createType(mapId, {
			...data,
			fields: data.fields.map((f, i) => ({
				...f,
				id: nextFieldId + i
			})),
			idx,
			formerFieldIds: {},
			...options?.id ? { id: options.id } : {}
		});
		this.db.emit("type", createdType.mapId, createdType);

		if (!options.noHistory) {
			await this.db.history.addHistoryEntry(mapId, {
				type: "Type",
				action: "create",
				identity: pickIdentity(options.identities),
				objectId: createdType.id,
				objectAfter: createdType
			});
		}

		return createdType;
	}

	async updateType(mapId: ID, typeId: ID, data: Type<CRU.UPDATE_VALIDATED>, options: {
		notFound404?: boolean;
		identities: Buffer[];
	}): Promise<Type> {
		const rename: Record<string, Record<string, string>> = {};
		for (const field of (data.fields || [])) {
			for (const option of field.options ?? []) {
				if (option.oldValue && option.oldValue != option.value) {
					if (!rename[field.id]) {
						rename[field.id] = { };
					}
					rename[field.id][option.oldValue] = option.value;
				}

				delete option.oldValue;
			}
		}

		if (data.idx != null) {
			await this._freeTypeIdx(mapId, typeId, data.idx);
		}

		const typeBefore = await this.getType(mapId, typeId, options);

		const fieldIdsBefore = new Set(typeBefore.fields.map((f) => f.id));
		const cleanedFields = data.fields?.map((f) => {
			if (f.id != null && fieldIdsBefore.has(f.id)) {
				return f;
			} else if (typeBefore.formerFieldIds[f.name]) {
				return { ...f, id: typeBefore.formerFieldIds[f.name] };
			} else {
				return { ...f, id: null as any as ID };
			}
		});
		const newFields = cleanedFields?.filter((f) => f.id == null);
		if (newFields && newFields.length > 0) {
			const nextFieldId = await this.db.maps.getNextFieldId(mapId, newFields.length);
			for (let i = 0; i < newFields.length; i++) {
				newFields[i].id = nextFieldId + i;
			}
		}

		const fieldIdsAfter = cleanedFields && new Set(cleanedFields.map((f) => f.id));
		const formerFieldIds = {
			...typeBefore.formerFieldIds,
			...fieldIdsAfter ? Object.fromEntries(typeBefore.fields.flatMap((f) => fieldIdsAfter.has(f.id) ? [] : [[f.name, f.id]])) : {}
		};

		await this.backend.updateType(mapId, typeId, {
			...data,
			...cleanedFields ? { fields: cleanedFields } : {},
			formerFieldIds
		});
		const typeAfter = await this.getType(mapId, typeId, options);
		this.db.emit("type", typeAfter.mapId, typeAfter);

		await Promise.all([
			await this.db.history.addHistoryEntry(mapId, {
				type: "Type",
				action: "update",
				identity: pickIdentity(options.identities),
				objectId: typeId,
				objectBefore: typeBefore,
				objectAfter: typeAfter
			}),
			(async () => {
				if (Object.keys(rename).length > 0) {
					await this.renameObjectDataValue(mapId, typeAfter.id, rename, typeAfter.type == "line");
				}

				if (typeAfter.type === "marker") {
					for await (const marker of this.db.markers.getMapMarkersByType(mapId, typeId)) {
						await this.db.markers._updateMarker(marker, {}, typeAfter, { noHistory: true, identities: options.identities });
					}
				} else if (typeAfter.type === "line") {
					for await (const line of this.db.lines.getMapLinesByType(mapId, typeId)) {
						await this.db.lines._updateLine(line, {}, typeAfter, { noHistory: true, identities: options.identities });
					}
				}
			})()
		]);

		return typeAfter;
	}

	protected async renameObjectDataValue(mapId: ID, typeId: ID, rename: Record<ID, Record<string, string>>, isLine: boolean): Promise<void> {
		const objectStream = (isLine ? this.db.lines.getMapLinesByType(mapId, typeId) : this.db.markers.getMapMarkersByType(mapId, typeId));

		for await (const object of objectStream) {
			const newData = cloneDeep(object.data);

			for (const id of keys(rename)) {
				for (const oldValue of Object.keys(rename[id])) {
					if (object.data[id] === oldValue) {
						newData[id] = rename[id][oldValue];
					}
				}
			}

			if (!isEqual(object.data, newData)) {
				if(isLine) {
					await this.db.lines.updateLine(object.mapId, object.id, { data: newData }, { noHistory: true, identities: [] });
				} else {
					await this.db.markers.updateMarker(object.mapId, object.id, { data: newData }, { noHistory: true, identities: [] });
				}
			}
		}
	}

	async isTypeUsed(mapId: ID, typeId: ID): Promise<boolean> {
		const [markerUsed, lineUsed] = await Promise.all([
			this.db.backend.markers.isTypeUsed(mapId, typeId),
			this.db.backend.lines.isTypeUsed(mapId, typeId)
		]);
		return markerUsed || lineUsed;
	}

	async deleteType(mapId: ID, typeId: ID, options: { notFound404?: boolean; identities: Buffer[] }): Promise<Type> {
		if (await this.isTypeUsed(mapId, typeId)) {
			throw new Error("This type is in use.");
		}

		const oldType = await this.getType(mapId, typeId, options);
		await this.backend.deleteType(mapId, typeId);
		this.db.emit("deleteType", mapId, { id: typeId });

		await this.db.history.addHistoryEntry(mapId, {
			type: "Type",
			action: "delete",
			identity: pickIdentity(options.identities),
			objectId: typeId,
			objectBefore: oldType
		});

		return oldType;
	}

	async createDefaultTypes(mapId: ID): Promise<Type[]> {
		const result: Type[] = [];
		for (const type of DEFAULT_TYPES) {
			result.push(await this.createType(mapId, type, { noHistory: true, identities: [] }));
		}
		return result;
	}
}