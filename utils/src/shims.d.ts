declare module "virtual:language-names" {
	const languageNames: Record<string, string>;
	export default languageNames;
}

declare module "virtual:language-stats" {
	const languageStats: Record<string, number>;
	export default languageStats;
}

declare module "virtual:news-mtimes" {
	const newsMtimes: {
		news: string;
		i18n: Record<string, string>;
	};
	export default newsMtimes;
}