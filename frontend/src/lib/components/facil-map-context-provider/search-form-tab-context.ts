export interface WritableSearchFormTabContext {
	setQuery(query: string, zoom?: boolean, smooth?: boolean, autofocus?: boolean): {
		/**
		 * A promise that is resolved when the bbox of the result is known and has been zoomed to (may be much earlier
		 * than when the result is finished loading, for example for changesets.
		 */
		zoomed: Promise<void>;

		/**
		 * A promise that is resolved when the result has finished loading and is displayed.
		 */
		loaded: Promise<void>;
	}
}

export type SearchFormTabContext = Readonly<WritableSearchFormTabContext>;