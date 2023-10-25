import { FieldUpdate, Type, TypeUpdate } from "facilmap-types";
import { clone } from "facilmap-utils";
import Vue from "vue";
import { mergeObject } from "../../utils/utils";

function getIdxForInsertingField(targetFields: FieldUpdate[], targetField: FieldUpdate, mergedFields: FieldUpdate[]): number {
	// Check which field comes after the field in the target field list, and return the index of that field in mergedFields

	for(let i = targetFields.indexOf(targetField) + 1; i < targetFields.length; i++) {
		if(!targetFields[i].oldName)
			continue;

		let thisIdxInMergedFields = mergedFields.findIndex(field => field.oldName == targetFields[i].oldName);
		if(thisIdxInMergedFields != -1)
			return thisIdxInMergedFields;
	}

	return mergedFields.length;
}

function mergeFields(oldFields: FieldUpdate[], newFields: FieldUpdate[], customFields: FieldUpdate[]): FieldUpdate[] {
	let mergedFields = newFields.map((newField) => {
		let oldField = oldFields.find((field) => (field.name == newField.name));
		let customField = customFields.find((field) => (field.oldName == newField.name));

		if(oldField && !customField) // Field has been removed in customFields
			return null;
		else if(!customField)
			return Object.assign({}, newField, {oldName: newField.name});

		let mergedField = clone(customField);
		mergeObject(oldField, newField, mergedField);

		return mergedField;
	}).filter(field => field != null) as FieldUpdate[];

	// Fields that don't have an oldName have been created, so we have to add them again
	for(let customField of customFields.filter(field => !field.oldName))
		mergedFields.splice(getIdxForInsertingField(customFields, customField, mergedFields), 0, customField);

	return mergedFields;
}

export function mergeTypeObject(oldObject: Type, newObject: Type, targetObject: Type & TypeUpdate): void {
	let customFields = clone(targetObject.fields);

	mergeObject(oldObject, newObject, targetObject);

	targetObject.fields = mergeFields(oldObject.fields, newObject.fields, customFields);
};