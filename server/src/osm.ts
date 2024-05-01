import { LookupTransformStream, PipeableTransformStream, asyncIteratorToStream, streamReplace } from "./utils/streams";
import { ReadableStream, TextDecoderStream, TransformStream } from "stream/web";
import sax from "sax";
import { isEqual } from "lodash-es";
import { Writable } from "stream";
import config from "./config";
import { sleep } from "facilmap-utils";

/**
 * Returns a TransformStream that expects an OSM XML file as the input and outputs the file with the XML declaration and the
 * <osm> opening/closing tags omitted.
 */
function removeOsmRootTag(): TransformStream<string, string> {
	let inIgnoredTag = false;
	return new LookupTransformStream({
		lookupValues: ["<?xml ", ">", "<osm ", "<osm>", "</osm>"],
		transform(chunk, controller) {
			if (chunk === "<?xml " || chunk === "<osm ") {
				inIgnoredTag = true;
			} else if (chunk === ">" && inIgnoredTag) {
				inIgnoredTag = false;
			} else if (chunk === "<osm>" || chunk === "</osm>" || inIgnoredTag) {
				// ignore
			} else {
				controller.enqueue(chunk);
			}
		}
	});
}

function detectReferencedRelations(onRelation: (relationId: string) => void): TransformStream<string, string> {
	const parser = sax.createStream(false);
	const openTags: string[] = [];
	parser.on("opentag", (node) => {
		if (node.name === "MEMBER" && node.attributes.TYPE === "relation" && node.attributes.REF && isEqual(openTags, ["OSM", "RELATION"])) {
			onRelation(node.attributes.REF as string);
		}

		openTags.push(node.name);
	});
	parser.on("closetag", () => {
		openTags.pop();
	});

	const parserWriter = Writable.toWeb(parser).getWriter();

	return new TransformStream({
		transform: async (chunk, controller) => {
			controller.enqueue(chunk);
			await parserWriter.write(chunk);
		},

		flush: async (controller) => {
			controller.terminate();
			void parserWriter.close(); // Await doesn't work here as promise never seems to be resolved
		}
	});
}

export function loadSubRelations(): TransformStream<string, string> {
	return new PipeableTransformStream((readable) => {
		const loadedIds = new Set<string>();
		const loadStack: string[] = [];
		const onRelation = (relationId: string) => {
			if (!loadedIds.has(relationId)) {
				loadedIds.add(relationId);
				loadStack.push(relationId);
			}
		};
		return readable
			.pipeThrough(detectReferencedRelations(onRelation))
			.pipeThrough(streamReplace({
				"</osm>": asyncIteratorToStream((async function*() {
					await sleep(0); // Allow for relations to be detected
					while (loadStack.length > 0) {
						const relationId = loadStack.shift()!;
						const res = await fetch(
							`https://api.openstreetmap.org/api/0.6/relation/${encodeURIComponent(relationId)}/full`,
							{
								headers: {
									"User-Agent": config.userAgent
								}
							}
						);
						const stream = (res.body as ReadableStream<Uint8Array>)
							.pipeThrough(new TextDecoderStream())
							.pipeThrough(detectReferencedRelations(onRelation))
							.pipeThrough(removeOsmRootTag());

						for await (const chunk of stream) {
							yield chunk;
						}
					}
					yield `</osm>`;
				})())
			}));
	});
}
