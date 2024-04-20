import { expect, test, vi } from "vitest";
import { createTemporaryMapV2, openClient } from "../utils";
import { SocketVersion } from "facilmap-types";

test("Socket v1 pad name", async () => {
	const client = await openClient(undefined, SocketVersion.V1);

	const onPadData = vi.fn();
	client.on("padData", onPadData);

	await createTemporaryMapV2(client, {}, async (createPadData, padData) => {
		expect(onPadData).toBeCalledTimes(1);
		expect(onPadData.mock.calls[0][0].name).toBe("Unnamed map");

		const result2 = await client.editPad({ name: "New name" });
		expect(result2.name).toBe("New name");
		expect(onPadData).toBeCalledTimes(2);
		expect(onPadData.mock.calls[1][0].name).toBe("New name");

		const result3 = await client.editPad({ name: "" });
		expect(result3.name).toBe("Unnamed map");
		expect(onPadData).toBeCalledTimes(3);
		expect(onPadData.mock.calls[2][0].name).toBe("Unnamed map");
	});
});