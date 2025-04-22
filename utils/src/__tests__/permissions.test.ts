import { expect, test } from "vitest";
import { deserializeMapPermissions, serializeMapPermissions } from "../permissions";

test("serializeMapPermissions", () => {
	for (const read of [false, "own", true] as const) {
		for (const update of [false, "own", true] as const) {
			for (const settings of [false, true]) {
				for (const admin of [false, true]) {
					for (const types of [false, true]) {
						const permissions = {
							read,
							update,
							settings,
							admin,
							...types ? {
								types: {
									1: {
										read: true,
										update: true
									},
									1000: {
										read: true,
										update: false
									},
									2000: {
										read: false,
										update: true
									},
									3000: {
										read: false,
										update: false,
										fields: {
											2: {
												read: true,
												update: true
											},
											1100: {
												read: true,
												update: false
											},
											2100: {
												read: false,
												update: true
											},
											3100: {
												read: false,
												update: false
											}
										}
									}
								}
							} : {}
						};
						const serialized = serializeMapPermissions(permissions);
						if (types) {
							expect(serialized.split(";").length).toBe(5);
							expect(serialized.split(",").length).toBe(5);
						} else {
							expect(serialized).toHaveLength(1);
						}
						expect(deserializeMapPermissions(serialized)).toEqual(permissions);
					}
				}
			}
		}
	}
});