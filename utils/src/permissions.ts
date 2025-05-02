import { entries, keys, type DeepReadonly, type HistoryEntry, type ID, type MapPermissions, type Type } from "facilmap-types";
import { base64ToNumber, numberToBase64 } from "./utils";
import { getI18n } from "./i18n";

export function hasPermission(checkPermission: () => void): boolean {
	try {
		checkPermission();
		return true;
	} catch (err: any) {
		if (err.status === 403) {
			return false;
		} else {
			throw err;
		}
	}
}

export function canConfigureMap(permissions: MapPermissions): boolean {
	return permissions.settings;
}

export function checkConfigureMap(permissions: MapPermissions): void {
	if (!canConfigureMap(permissions)) {
		throw Object.assign(new Error(getI18n().t("permissions.configure-map-permission-needed")), { status: 403 });
	}
}

export function canAdministrateMap(permissions: MapPermissions): boolean {
	return permissions.admin;
}

export function checkAdministrateMap(permissions: MapPermissions): void {
	if (!canAdministrateMap(permissions)) {
		throw Object.assign(new Error(getI18n().t("permissions.administrate-map-permission-needed")), { status: 403 });
	}
}

export function canReadObject(permissions: MapPermissions, typeId: ID, isOwn: boolean): boolean {
	const permission = permissions.types?.[typeId]?.read ?? permissions.read;
	return permission === "own" ? isOwn : permission;
}

export function checkReadObject(permissions: MapPermissions, typeId: ID, isOwn: boolean): void {
	if (!canReadObject(permissions, typeId, isOwn)) {
		throw Object.assign(new Error(getI18n().t("permissions.read-type-permission-needed", { typeId })), { status: 403 });
	}
}

/**
 * Returns true if the user has permission to edit the general properties of objects of the given type, meaning for example
 * the marker position, style attributes etc. For data fields, the permission must be checked separately using canUpdateField().
 */
export function canUpdateObject(permissions: MapPermissions, typeId: ID, isOwn: boolean): boolean {
	const permission = permissions.types?.[typeId]?.update ?? permissions.update;
	return permission === "own" ? isOwn : permission;
}

/**
 * Throws an exception if the user does not have permission to edit the general properties of objects of the given type, meaning
 * such as the marker position, style attributes etc. For data fields, the permission must be checked separately using checkUpdateField().
 */
export function checkUpdateObject(permissions: MapPermissions, typeId: ID, isOwn: boolean): void {
	if (!canUpdateObject(permissions, typeId, isOwn)) {
		throw Object.assign(new Error(getI18n().t("permissions.update-type-permission-needed", { typeId })), { status: 403 });
	}
}

export function getCreatableTypes<T extends DeepReadonly<Type>>(permissions: MapPermissions, types: ReadonlyArray<T>, hasIdentity: boolean): T[] {
	return types.filter((type) => canUpdateObject(permissions, type.id, hasIdentity));
}

/**
 * Returns true if the user has permission to update the object and all its fields. This is a prerequisite for editing the object
 * type and for deleting the object.
 */
export function canManageObject(permissions: MapPermissions, typeId: ID, isOwn: boolean): boolean {
	return hasPermission(() => checkManageObject(permissions, typeId, isOwn));
}

/**
 * Throws an exception if the user doesn’t have permission to update the object and all its fields. That is a prerequisite for
 * editing the object type and for deleting the object.
 */
export function checkManageObject(permissions: MapPermissions, typeId: ID, isOwn: boolean): void {
	checkUpdateObject(permissions, typeId, isOwn);
	for (const fieldId of keys(permissions.types?.[typeId]?.fields ?? {})) {
		checkUpdateField(permissions, typeId, fieldId, isOwn);
	}
}

/**
 * Returns true if the user has permission to update and delete the type with the given ID.
 */
export function canUpdateType(permissions: MapPermissions, typeId: ID): boolean {
	return hasPermission(() => checkUpdateType(permissions, typeId));
}

/**
 * Throws an exception if the user does not have permission to update and delete the type with the given ID.
 */
export function checkUpdateType(permissions: MapPermissions, typeId: ID): void {
	checkConfigureMap(permissions);
	checkUpdateType(permissions, typeId);
}

export function canReadField(permissions: MapPermissions, typeId: ID, fieldId: ID | `${number}`, isOwn: boolean): boolean {
	const permission = permissions.types?.[typeId]?.fields?.[fieldId]?.read ?? canReadObject(permissions, typeId, isOwn);
	return permission === "own" ? isOwn : permission;
}

export function canUpdateField(permissions: MapPermissions, typeId: ID, fieldId: ID | `${number}`, isOwn: boolean): boolean {
	const permission = permissions.types?.[typeId]?.fields?.[fieldId]?.update ?? canUpdateObject(permissions, typeId, isOwn);
	return permission === "own" ? isOwn : permission;
}

export function checkUpdateField(permissions: MapPermissions, typeId: ID, fieldId: ID | `${number}`, isOwn: boolean): void {
	if (!canUpdateField(permissions, typeId, fieldId, isOwn)) {
		throw Object.assign(new Error(getI18n().t("permissions.update-field-permission-needed", { typeId, fieldId })), { status: 403 });
	}
}

export function canUpdateAnyField(permissions: MapPermissions, typeId: ID, isOwn: boolean): boolean {
	return (
		canUpdateObject(permissions, typeId, isOwn)
		|| (
			!!permissions.types?.[typeId]?.fields
			&& keys(permissions.types[typeId].fields).some((fieldId) => canUpdateField(permissions, typeId, fieldId, isOwn))
		)
	);
}

export function canRevertHistoryEntry(permissions: MapPermissions, entry: HistoryEntry, isOwnBefore: boolean, isOwnAfter: boolean): boolean {
	return hasPermission(() => checkRevertHistoryEntry(permissions, entry, isOwnBefore, isOwnAfter));
}

export function checkRevertHistoryEntry(permissions: MapPermissions, entry: HistoryEntry, isOwnBefore: boolean, isOwnAfter: boolean): void {
	switch (entry.type) {
		case "Map": case "Type": case "View":
			checkConfigureMap(permissions);
			break;

		case "Marker": case "Line":
			if (entry.objectBefore) {
				checkUpdateObject(permissions, entry.objectBefore.typeId, isOwnBefore);
			}
			if (entry.objectAfter) {
				checkUpdateObject(permissions, entry.objectAfter.typeId, isOwnAfter);
			}
			break;
	}
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