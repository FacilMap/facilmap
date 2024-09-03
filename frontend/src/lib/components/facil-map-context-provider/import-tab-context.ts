export interface WritableImportTabContext {
	openFilePicker: () => void;
	importFiles: (files: FileList | File[]) => Promise<void>;
}

export type ImportTabContext = Readonly<WritableImportTabContext>;