import { Writable, type DeepReadonly, type Line, type MapDataWithWritable, type Marker, type Type, type View } from "facilmap-types";

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