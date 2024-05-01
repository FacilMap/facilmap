import { expect, test } from "vitest";
import { streamToString, stringToStream } from "../utils/streams";
import { loadSubRelations } from "../osm";

test("loadSubRelations", async () => {
	const relation1 =
`<relation id="1">
 <member type="node" ref="101"/>
 <member type="relation" ref="2"/>
 <member type="relation" ref="3"/>
</relation>`;
	const relation2 =
`<relation id="2">
 <member type="node" ref="102"/>
 <member type="relation" ref="4"/>
</relation>`;
	const relation3 =
`<relation id="3">
 <member type="node" ref="103"/>
</relation>`;
	const relation4 =
`<relation id="4">
 <member type="node" ref="104"/>
</relation>`;

	const before =
`<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="CGImap 0.9.2 (3356841 spike-08.openstreetmap.org)" copyright="OpenStreetMap and contributors" attribution="http://www.openstreetmap.org/copyright" license="http://opendatacommons.org/licenses/odbl/1-0/">
`;

	const after = `</osm>
`;

	const relation1Content =
` <node id="101"/>
 ${relation1}
`;
	const relation2Content =
` <node id="102"/>
 ${relation2}
`;
	const relation3Content =
` <node id="103"/>
 ${relation3}
`;
	const relation4Content =
` <node id="104"/>
 ${relation4}
`;

	const fetchBkp = fetch;

	try {
		global.fetch = async (url) => {
			switch (url) {
				case "https://api.openstreetmap.org/api/0.6/relation/2/full":
					return new Response(`${before}${relation2Content}${after}`);

				case "https://api.openstreetmap.org/api/0.6/relation/3/full":
					return new Response(`${before}${relation3Content}${after}`);

				case "https://api.openstreetmap.org/api/0.6/relation/4/full":
					return new Response(`${before}${relation4Content}${after}`);

				default:
					throw new Error(`Unexpected url: ${JSON.stringify(url)}`);
			}
		};

		expect(await streamToString(stringToStream(`${before}${relation1Content}${after}`).pipeThrough(loadSubRelations()))).toEqual(
`${before}${relation1Content}

${relation2Content}


${relation3Content}


${relation4Content}
${after}`
		);
	} finally {
		global.fetch = fetchBkp;
	}
});