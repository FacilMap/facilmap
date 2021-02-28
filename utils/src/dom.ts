export const isBrowser = (typeof window !== "undefined");
export const jQuery: JQueryStatic = isBrowser ? require("jquery") : null;
export const cheerio: cheerio.CheerioAPI = isBrowser ? null : eval('require')("cheerio");
export const $: cheerio.CheerioAPI = isBrowser ? jQuery as any : cheerio;

export function createDiv(): cheerio.Cheerio {
	return isBrowser ? jQuery("<div/>") as any : cheerio.load("<div/>").root();
}