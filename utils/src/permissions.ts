import { entries, keys, Writable, type DeepReadonly, type Line, type MapDataWithWritable, type MapPermissions, type Marker, type Type, type View } from "facilmap-types";
import { base64ToNumber, numberToBase64 } from "./utils";

export function canEditMapData(mapData: DeepReadonly<MapDataWithWritable>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function canCreateType(mapData: DeepReadonly<MapDataWithWritable>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function canEditType(mapData: DeepReadonly<MapDataWithWritable>, type: DeepReadonly<Type>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function canDeleteType(mapData: DeepReadonly<MapDataWithWritable>, type: DeepReadonly<Type>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function canCreateView(mapData: DeepReadonly<MapDataWithWritable>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function canEditView(mapData: DeepReadonly<MapDataWithWritable>, view: DeepReadonly<View>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function canDeleteView(mapData: DeepReadonly<MapDataWithWritable>, view: DeepReadonly<View>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function canCreateObject(mapData: DeepReadonly<MapDataWithWritable>, type: DeepReadonly<Type>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function canEditObject(mapData: DeepReadonly<MapDataWithWritable>, type: DeepReadonly<Type>, object: DeepReadonly<Marker | Line>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function canDeleteObject(mapData: DeepReadonly<MapDataWithWritable>, type: DeepReadonly<Type>, object: DeepReadonly<Marker | Line>): boolean {
	return mapData.writable === Writable.ADMIN;
}

export function getSmallestMapPermission<T extends boolean | "own">(permissions: T[]): T {
	return permissions.includes(false as any) ? false : permissions.includes("own" as any) ? "own" : permissions.includes(true as any) ? true : false as any;
}

export function mergeMapPermissions(...permissions: MapPermissions[]): MapPermissions {
	const typeIds = new Set(permissions.flatMap((p) => p.types ? keys(p.types) : []));
	return {
		read: getSmallestMapPermission(permissions.map((p) => p.read)),
		update: getSmallestMapPermission(permissions.map((p) => p.update)),
		settings: getSmallestMapPermission(permissions.map((p) => p.settings)),
		admin: getSmallestMapPermission(permissions.map((p) => p.admin)),
		...typeIds.size > 0 ? {
			types: Object.fromEntries([...typeIds].map((typeId) => {
				const fieldIds = new Set(permissions.flatMap((p) => p.types?.[typeId].fields ? keys(p.types[typeId].fields) : []));
				return [typeId, {
					read: getSmallestMapPermission(permissions.map((p) => (p.types?.[typeId] ?? p).read)),
					update: getSmallestMapPermission(permissions.map((p) => (p.types?.[typeId] ?? p).update)),
					...fieldIds.size > 0 ? {
						fields: Object.fromEntries([...fieldIds].map((fieldId) => [fieldId, {
							read: getSmallestMapPermission(permissions.map((p) => (p.types?.[typeId]?.fields?.[fieldId] ?? p.types?.[typeId] ?? p).read)),
							update: getSmallestMapPermission(permissions.map((p) => (p.types?.[typeId]?.fields?.[fieldId] ?? p.types?.[typeId] ?? p).update))
						}]))
					} : {}
				}];
			}))
		} : {}
	};
}

function permissionToBinary(permission: boolean | "own"): number {
	return permission === "own" ? 0b10 : permission === true ? 0b01 : 0b00;
}

function binaryToPermission<Own extends boolean = true>(binary: number, own: Own): boolean | (Own extends true ? "own" : never) {
	return own && binary & 0b10 ? "own" as (Own extends true ? "own" : never) : binary & 0b01 ? true : false;
}

export function serializeMapPermissions(permissions: MapPermissions): string {
	return numberToBase64(
		(permissionToBinary(permissions.read)) |
		(permissionToBinary(permissions.update) << 2) |
		(permissionToBinary(permissions.settings) << 4) |
		(permissionToBinary(permissions.admin) << 5)
	) + entries(permissions.types ?? {}).map(([typeId, p]) => (
		";" +
		numberToBase64(Number(typeId)) +
		":" +
		numberToBase64(
			(permissionToBinary(p.read)) |
			(permissionToBinary(p.update) << 2)
		) +
		entries(p.fields ?? {}).map(([fieldId, p]) => (
			"," +
			numberToBase64(Number(fieldId)) +
			":" +
			numberToBase64(
				(permissionToBinary(p.read)) |
				(permissionToBinary(p.update) << 2)
			)
		)).join("")
	)).join("");
}

export function deserializeMapPermissions(permissions: string): MapPermissions {
	const [mapCodeStr, ...typesStr] = permissions.split(";");
	const mapCode = base64ToNumber(mapCodeStr);
	const types = typesStr.map((typeSettingsStr) => {
		const [typeStr, ...fieldsStr] = typeSettingsStr.split(",");
		const [typeIdStr, typeCodeStr] = typeStr.split(":");
		const typeCode = base64ToNumber(typeCodeStr);
		const fields = fieldsStr.map((fieldStr) => {
			const [fieldIdStr, fieldCodeStr] = fieldStr.split(":");
			const fieldCode = base64ToNumber(fieldCodeStr);
			return [base64ToNumber(fieldIdStr), {
				read: binaryToPermission(fieldCode & 0b11, true),
				update: binaryToPermission((fieldCode >> 2) & 0b11, true)
			}];
		});
		return [base64ToNumber(typeIdStr), {
			read: binaryToPermission(typeCode & 0b11, true),
			update: binaryToPermission((typeCode >> 2) & 0b11, true),
			...fields.length > 0 ? { fields: Object.fromEntries(fields) } : {}
		}];
	});
	return {
		read: binaryToPermission(mapCode & 0b11, true),
		update: binaryToPermission((mapCode >> 2) & 0b11, true),
		settings: binaryToPermission((mapCode >> 4) & 0b1, false),
		admin: binaryToPermission((mapCode >> 5) & 0b1, false),
		...types.length > 0 ? { types: Object.fromEntries(types) } : {}
	};
}