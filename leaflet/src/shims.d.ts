declare module "virtual:icons:keys" {
	export const coreIconKeys: string[];
	const iconKeys: Record<string, string[]>;
	export default iconKeys;
}

declare module "virtual:icons:core" {
	const rawIconsCore: Record<string, Record<string, string>>;
	export default rawIconsCore;
}

declare module "virtual:icons:extra" {
	const rawIconsExtra: Record<string, Record<string, string>>;
	export default rawIconsExtra;
}