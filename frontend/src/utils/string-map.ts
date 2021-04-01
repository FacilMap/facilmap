import Vue from "vue";

export default class StringMap {

	entries!: Array<[key: string, value: string]>;

	constructor(data?: Record<string, string>) {
		Vue.set(this, "entries", data ? Object.keys(data).map((key) => [key, data[key]]) : []);
	}

	get(key: string): string | undefined {
		return this.entries.find((e) => e[0] == key)?.[1];
	}

	set(key: string, value: string): this {
		const entry = this.entries.find((e) => e[0] == key);
		if (entry)
			Vue.set(entry, 1, value);
		else
			this.entries.push([key, value]);
		return this;
	}

	has(key: string): boolean {
		return this.entries.some((e) => e[0] == key);
	}

	delete(key: string): boolean {
		const idx = this.entries.findIndex((e) => e[0] == key);
		if (idx != -1)
			this.entries.splice(idx, 1);
		return idx != -1;
	}

	clear(): void {
		Vue.set(this, "entries", []);
	}

	[Symbol.iterator](): Iterator<[key: string, value: string]> {
		return this.entries[Symbol.iterator]();
	}

	toObject(): Record<string, string> {
		const result = Object.create(null);
		for (const [key, value] of this.entries)
			result[key] = value;
		return result;
	}

}