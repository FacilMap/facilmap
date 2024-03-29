export interface WritableSearchFormTabContext {
	setQuery(query: string, zoom?: boolean, smooth?: boolean, autofocus?: boolean): void;
}

export type SearchFormTabContext = Readonly<WritableSearchFormTabContext>;