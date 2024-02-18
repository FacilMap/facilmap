declare module "virtual:icons:keys" {
	const rawIconKeys: Record<string, string[]>;
	export default rawIconKeys;
}

declare module "virtual:icons" {
	const rawIcons: Record<string, Record<string, string>>;
	export default rawIcons;
}