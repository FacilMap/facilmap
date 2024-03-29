export interface WritableImportTabContext {
	openFilePicker: () => void;
}

export type ImportTabContext = Readonly<WritableImportTabContext>;