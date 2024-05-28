import { expectTypeOf, test } from "vitest";
import type { DeletableKeysOf, WritableKeysOf } from "../reactivity";

test("WritableKeysOf", () => {
	expectTypeOf("" as WritableKeysOf<{ a: string, b?: string; readonly c: string; readonly d?: string }>)
		.toEqualTypeOf<"a" | "b">();
	expectTypeOf("" as WritableKeysOf<Record<string, number>>)
		.toEqualTypeOf<string>();
	expectTypeOf("" as WritableKeysOf<Readonly<Record<string, number>>>)
		.toEqualTypeOf<never>();
});

test("DeletableKeysOf", () => {
	expectTypeOf("" as DeletableKeysOf<{ a: string, b?: string; readonly c: string; readonly d?: string }>)
		.toEqualTypeOf<"b">();
	expectTypeOf("" as DeletableKeysOf<Record<string, number>>)
		.toEqualTypeOf<string>();
	expectTypeOf("" as DeletableKeysOf<Readonly<Record<string, number>>>)
		.toEqualTypeOf<never>();
});