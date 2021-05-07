import { mergeTypeObject } from "../edit-type-utils";

function merge(oldType: any, newType: any, targetType: any): any {
	mergeTypeObject(oldType, newType, targetType);
	return targetType;
}

test('mergeTypeObjects', () => {
	expect(merge(
		{ fields: [
			{ name: "field1", test: "string" },
			{ name: "field2", test: "string" },
			{ name: "field3", test: "string" },
			{ name: "field4", test: "string" },
			{ name: "field5", test: "string" },
			{ name: "field6", test: "string" },
			{ name: "field7", test: "string" }
		] },
		{ fields: [
			{ name: "field1", test: "string1" }, // Update test
			// Delete field2
			// Delete field3
			{ name: "field4" }, // Delete test
			{ name: "field4a", test: "string4a" }, // New field
			{ name: "field5", test: "string", test2: "bla" }, // Add test2
			{ name: "field6", test: "string6" }, // Update test
			{ name: "field7a", test: "string" }, // Rename
			{ name: "field8", test: "string" } // New field
		] },
		{ fields: [
			{ oldName: "field1", name: "field1", test: "string" }, // Unchanged
			{ oldName: "field4", name: "field4a", test: "string" }, // Rename and reorder
			{ oldName: "field2", name: "field2", test: "string" }, // Unchanged
			{ oldName: "field3", name: "field3b", test: "string2" }, // Rename and update test
			{ name: "newField", test: "string3a" }, // New field
			{ oldName: "field5", name: "field5", test: "string5" }, // Update test
			// Delete field6
			{ oldName: "field7", name: "field7", test: "string" }, // Unchanged
			{ name: "field8", test: "string8" } // New field (name conflict)
		] }
	)).toEqual(
		{ fields: [
			{ oldName: "field1", name: "field1", test: "string1" },
			{ oldName: "field4", name: "field4a" },
			{ oldName: "field4a", name: "field4a", test: "string4a" },
			{ name: "newField", test: "string3a" },
			{ oldName: "field5", name: "field5", test: "string5", test2: "bla" },
			{ oldName: "field7a", name: "field7a", test: "string" },
			{ oldName: "field8", name: "field8", test: "string" },
			{ name: "field8", test: "string8" }
		] }
	);
});