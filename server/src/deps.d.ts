interface JsonFormatConfig {
	type: "space" | "tab",
	size: number
}

declare module "json-format" {
	export default function jsonFormat(obj: any, config?: JsonFormatConfig | null): string;
}
