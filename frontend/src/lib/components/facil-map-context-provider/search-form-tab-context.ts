export interface WritableSearchFormTabContext {
	setQuery(query: string, zoom?: boolean, smooth?: boolean, autofocus?: boolean): Promise<void>;
}

export type SearchFormTabContext = Readonly<WritableSearchFormTabContext>;