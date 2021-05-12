const isBrowser = (typeof window !== "undefined");
const jQuery: JQueryStatic = isBrowser ? require("jquery") : null;
const cheerio: cheerio.CheerioAPI = isBrowser ? null : eval('require')("cheerio");

export function createDiv(): [cheerio.Cheerio, cheerio.Root] {
	if (isBrowser)
		return [jQuery("<div/>"), jQuery] as any;
	else {
		const $ = cheerio.load("<div/>");
		return [$.root(), $];
	}
}