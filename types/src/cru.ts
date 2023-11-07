import * as z from "zod";

export enum CRU {
	READ = "read",
	CREATE = "create",
	UPDATE = "update"
}

export type CRUValidator<
	ReadValidator extends z.ZodType,
	CreateValidator extends z.ZodType,
	UpdateValidator extends z.ZodType
> = {
	read: ReadValidator;
	create: CreateValidator;
	update: UpdateValidator
};

export type CRUValidatorDeclaration<
	AllShape extends z.ZodRawShape = {},
	AllPartialCreateShape extends z.ZodRawShape = {},
	AllPartialUpdateShape extends z.ZodRawShape = {},
	OnlyReadShape extends z.ZodRawShape = {},
	ExceptReadShape extends z.ZodRawShape = {},
	OnlyCreateShape extends z.ZodRawShape = {},
	ExceptCreateShape extends z.ZodRawShape = {},
	OnlyUpdateShape extends z.ZodRawShape = {},
	ExceptUpdateShape extends z.ZodRawShape = {},
> = {
	all?: AllShape;
	/** All properties required for read, all properties optional for create/update */
	allPartialCreate?: AllPartialCreateShape;
	/** All properties required for read/create, all properties optional for update */
	allPartialUpdate?: AllPartialUpdateShape;
	onlyRead?: OnlyReadShape;
	exceptRead?: ExceptReadShape;
	onlyCreate?: OnlyCreateShape;
	exceptCreate?: ExceptCreateShape;
	onlyUpdate?: OnlyUpdateShape;
	exceptUpdate?: ExceptUpdateShape;
};

type PartialZodShape<T extends z.ZodRawShape> = {
	[k in keyof T]: z.ZodOptional<T[k]>;
};

// https://fettblog.eu/typescript-union-to-intersection/
type ZodRawShapeUnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R extends z.ZodRawShape) => any ? R : never;
type ZodExtendedObjects<Obj extends Array<z.ZodRawShape>> = Obj extends Array<infer T> ? z.ZodObject<ZodRawShapeUnionToIntersection<T>> : never;

export type CRUValidatorForDeclaration<
	AllShape extends z.ZodRawShape = {},
	AllPartialCreateShape extends z.ZodRawShape = {},
	AllPartialUpdateShape extends z.ZodRawShape = {},
	OnlyReadShape extends z.ZodRawShape = {},
	ExceptReadShape extends z.ZodRawShape = {},
	OnlyCreateShape extends z.ZodRawShape = {},
	ExceptCreateShape extends z.ZodRawShape = {},
	OnlyUpdateShape extends z.ZodRawShape = {},
	ExceptUpdateShape extends z.ZodRawShape = {},
> = CRUValidator<
	ZodExtendedObjects<[
		AllShape,
		AllPartialCreateShape,
		AllPartialUpdateShape,
		OnlyReadShape,
		ExceptCreateShape,
		ExceptUpdateShape
	]>,
	ZodExtendedObjects<[
		AllShape,
		PartialZodShape<AllPartialCreateShape>,
		AllPartialUpdateShape,
		OnlyCreateShape,
		ExceptReadShape,
		ExceptUpdateShape
	]>,
	ZodExtendedObjects<[
		AllShape,
		PartialZodShape<AllPartialCreateShape>,
		PartialZodShape<AllPartialUpdateShape>,
		OnlyUpdateShape,
		ExceptReadShape,
		ExceptCreateShape
	]>
>;

export function cruValidator<
	AllShape extends z.ZodRawShape = {},
	AllPartialCreateShape extends z.ZodRawShape = {},
	AllPartialUpdateShape extends z.ZodRawShape = {},
	OnlyReadShape extends z.ZodRawShape = {},
	ExceptReadShape extends z.ZodRawShape = {},
	OnlyCreateShape extends z.ZodRawShape = {},
	ExceptCreateShape extends z.ZodRawShape = {},
	OnlyUpdateShape extends z.ZodRawShape = {},
	ExceptUpdateShape extends z.ZodRawShape = {},
>(
	declaration: CRUValidatorDeclaration<AllShape, AllPartialCreateShape, AllPartialUpdateShape, OnlyReadShape, ExceptReadShape, OnlyCreateShape, ExceptCreateShape, OnlyUpdateShape, ExceptUpdateShape>
): CRUValidatorForDeclaration<AllShape, AllPartialCreateShape, AllPartialUpdateShape, OnlyReadShape, ExceptReadShape, OnlyCreateShape, ExceptCreateShape, OnlyUpdateShape, ExceptUpdateShape> {
	return {
		read: z.object({
			...declaration.all,
			...declaration.allPartialCreate,
			...declaration.allPartialUpdate,
			...declaration.onlyRead,
			...declaration.exceptCreate,
			...declaration.exceptUpdate
		}),
		create: z.object({
			...declaration.all,
			...Object.fromEntries(Object.entries(declaration.allPartialCreate ?? {}).map(([k, v]) => [k, v.optional()])),
			...declaration.allPartialUpdate,
			...declaration.onlyCreate,
			...declaration.exceptRead,
			...declaration.exceptUpdate
		}),
		update: z.object({
			...declaration.all,
			...Object.fromEntries(Object.entries(declaration.allPartialCreate ?? {}).map(([k, v]) => [k, v.optional()])),
			...Object.fromEntries(Object.entries(declaration.allPartialUpdate ?? {}).map(([k, v]) => [k, v.optional()])),
			...declaration.onlyUpdate,
			...declaration.exceptRead,
			...declaration.exceptCreate
		})
	} as any;
}

export type CRUType<Mode extends CRU, Validator extends CRUValidator<any, any, any>> = (
	Mode extends CRU.READ ? z.infer<Validator["read"]> :
	Mode extends CRU.CREATE ? z.infer<Validator["create"]> :
	Mode extends CRU.UPDATE ? z.infer<Validator["update"]> : never
);
