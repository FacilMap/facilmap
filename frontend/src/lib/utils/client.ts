import FmClient from "facilmap-client";
import StringMap from "./string-map";
import { InjectionKey, Ref, inject, provide } from "vue";

export type Client = FmClient<StringMap>;

const clientInject = Symbol("clientInject") as InjectionKey<Ref<Client>>;

export function provideClient(client: Ref<Client | undefined>): void {
	return provide(clientInject, client);
}

export function injectClientOptional(): Ref<Client> | undefined {
	return inject(clientInject);
}

export function injectClientRequired(): Ref<Client> {
	const client = injectClientOptional();
	if (!client) {
		throw new Error("No client injected.");
	}
	return client;
}