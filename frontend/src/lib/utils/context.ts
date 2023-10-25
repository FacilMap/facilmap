import { InjectionKey, inject, provide } from "vue";

export interface WritableContext {
	id: number;
	baseUrl: string;
	toolbox: boolean;
	search: boolean;
	autofocus: boolean;
	legend: boolean;
	interactive: boolean;
	isNarrow: boolean;
	linkLogo: boolean;
	updateHash: boolean;
}

export type Context = Readonly<WritableContext>;

const contextInject = Symbol("contextInject") as InjectionKey<Context>;

export function provideContext(context: Context): void {
	return provide(contextInject, context);
}

export function injectContextOptional(): Context | undefined {
	return inject(contextInject);
}

export function injectContextRequired(): Context {
	const context = injectContextOptional();
	if (!context) {
		throw new Error("No context injected.");
	}
	return context;
}