import FmClient from "facilmap-client";
import { InjectionKey, Ref, inject, provide } from "vue";

export type Client = FmClient;

const clientInject = Symbol("clientInject") as InjectionKey<Ref<Client | undefined>>;

export function provideClient(client: Ref<Client | undefined>): void {
	return provide(clientInject, client);
}

export function injectClientOptional(): Ref<Client | undefined> | undefined {
	return inject(clientInject);
}

export function injectClientRequired(): Ref<Client> {
	const client = injectClientOptional();
	if (!client || !client.value) {
		throw new Error("No client injected.");
	}
	return client as Ref<Client>;
}