import { InjectionKey, inject, provide } from "vue";

export interface Context {
	id: number;
	activePadId: string | undefined;
	activePadName: string | undefined;
	serverUrl: string;
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