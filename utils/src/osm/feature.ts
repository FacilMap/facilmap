import * as OSM from "osm-api";
import { getBboxForNodeList, getFeatureKey } from "./utils";
import { intersection, pull, sortBy, sum, uniqBy } from "lodash-es";
import type { Bbox, DeepReadonly } from "facilmap-types";
import { calculateDistance } from "../routing";

export type ResolvedOsmRelationMember = OSM.OsmRelation["members"][number] & {
	feature: ResolvedOsmFeature;
};

export type ResolvedOsmRelation = Omit<OSM.OsmRelation, "members"> & {
	members: ResolvedOsmRelationMember[];
	bbox: Bbox;
};

export type ResolvedOsmWay = Omit<OSM.OsmWay, "nodes"> & {
	nodes: OSM.OsmNode[];
	bbox: Bbox;
};

export type ResolvedOsmFeature = ResolvedOsmRelation | ResolvedOsmWay | OSM.OsmNode;

async function fetchOsmRelationFeatures(id: number, _handledRelationIds: number[] = []): Promise<Record<string, OSM.OsmFeature>> {
	const features = Object.fromEntries((await OSM.getFeature("relation", id, true)).map((f) => [getFeatureKey(f), f]));

	const handledRelationIds = [..._handledRelationIds, id];
	for (const member of (features[getFeatureKey("relation", id)] as OSM.OsmRelation).members) {
		if (member.type === "relation" && !handledRelationIds.includes(member.ref)) {
			Object.assign(features, await fetchOsmRelationFeatures(member.ref, handledRelationIds));
		}
	}

	return features;
}

export async function fetchOsmRelation(id: number): Promise<ResolvedOsmRelation> {
	const rawFeatures = await fetchOsmRelationFeatures(id);

	const features: Record<string, ResolvedOsmRelationMember["feature"]> = Object.fromEntries(Object.entries(rawFeatures).map(([id, f]): [string, ResolvedOsmFeature] => {
		if (f.type === "relation") {
			// Fill relation members later to allow for recursive membership
			return [id, { ...f, members: [], bbox: undefined as any }];
		} else if (f.type === "way") {
			return [id, resolveOsmWay(f, rawFeatures)];
		} else {
			return [id, f];
		}
	}));

	for (const [id, feature] of Object.entries(features)) {
		if (feature.type === "relation") {
			feature.members = (rawFeatures[id] as OSM.OsmRelation).members.map((m) => ({
				...m,
				feature: features[getFeatureKey(m)]
			}));
			const segments = relationToSegments(feature);
			feature.bbox = getBboxForNodeList([...segments.segments.flatMap((s) => s), ...segments.singleNodes]);
		}
	}

	return features[getFeatureKey("relation", id)] as ResolvedOsmRelation;
}

function resolveOsmWay(way: OSM.OsmWay, features: Record<string, OSM.OsmFeature>): ResolvedOsmWay {
	const nodes = way.nodes.map((nodeId) => features[getFeatureKey("node", nodeId)] as OSM.OsmNode);
	const bbox = getBboxForNodeList(nodes);
	return { ...way, nodes, bbox };
}

export async function fetchOsmWay(id: number): Promise<ResolvedOsmWay> {
	const features = Object.fromEntries((await OSM.getFeature("way", id, true)).map((f) => [getFeatureKey(f), f]));
	const way = features[getFeatureKey("way", id)] as OSM.OsmWay;
	return resolveOsmWay(way, features);
}

export async function fetchOsmFeature(type: OSM.OsmFeatureType, id: number): Promise<ResolvedOsmFeature> {
	if (type === "relation") {
		return await fetchOsmRelation(id);
	} else if (type === "way") {
		return await fetchOsmWay(id);
	} else {
		return (await OSM.getFeature("node", id))[0];
	}
}

type Segment = [OSM.OsmNode, OSM.OsmNode];
export type AnalyzedOsmRelationSingleNode = OSM.OsmNode & { role?: string };

function relationToSegments(relation: DeepReadonly<ResolvedOsmRelation>, _handledRelationIds: number[] = []): { segments: Segment[]; singleNodes: AnalyzedOsmRelationSingleNode[] } {
	const handledRelationIds = [..._handledRelationIds, relation.id];
	const result = {
		segments: [] as Segment[],
		singleNodes: [] as AnalyzedOsmRelationSingleNode[]
	};
	for (const member of relation.members) {
		if (member.feature.type === "relation" && !handledRelationIds.includes(member.feature.id)) {
			const res = relationToSegments(member.feature, handledRelationIds);
			result.segments.push(...res.segments);
			result.singleNodes.push(...res.singleNodes);
		} else if (member.feature.type === "way") {
			result.segments.push(...member.feature.nodes.slice(1).map((n, i): Segment => [(member.feature as ResolvedOsmWay).nodes[i], n]));
		} else if (member.feature.type === "node") {
			result.singleNodes.push({ ...member.feature, role: member.role });
		}
	}
	return result;
}

function getSegmentKey(segment: Segment): string {
	return `${segment[0].id};${segment[1].id}`;
}

function isConnected(section1: OSM.OsmNode[], section2: OSM.OsmNode[]): boolean {
	return intersection([section1[0], section1[section1.length - 1]], [section2[0], section2[section2.length - 1]]).length > 0;
}

/**
 * Returns a map that maps each start/end node of the provided sections/segments to the sections/segments originating from it.
 * Each provided section/segment will appear in the map twice, once for its start node and once reversed for its end node.
 * This means that each node in the map always appears as the first node in the section/segment.
 */
function groupByNode<S>(sections: S[], getFirst: (section: S) => OSM.OsmNode, reverse: (section: S) => S): Map<OSM.OsmNode, S[]> {
	const result = new Map<OSM.OsmNode, S[]>();
	for (const section of [...sections, ...sections.map((s) => reverse(s))]) {
		const first = getFirst(section);
		if (!result.has(first)) {
			result.set(first, []);
		}
		result.get(first)!.push(section);
	}
	return result;
}

function groupSegmentsByNode(segments: Segment[]): Map<OSM.OsmNode, Segment[]> {
	return groupByNode(segments, (s) => s[0], (s) => [s[1], s[0]]);
}

/**
 * Yields the given start segment and then keeps yielding segments connected to each other. Stops as soon as a segment is connected to zero
 * or multiple other segments or when the start segment is reached again (for circular sections).
 */
function* walkThroughSegments(startSegment: Segment, waySegmentsByNode: Map<OSM.OsmNode, Segment[]>, reverse = false): Iterable<Segment, void, void> {
	let segment: Segment = reverse ? [startSegment[1], startSegment[0]] : startSegment;
	const startSegmentKey = getSegmentKey(segment);
	while (true) {
		yield segment;
		const next = waySegmentsByNode.get(segment[1])!.filter((s) => s[1] !== segment[0]);
		if (next.length === 1 && getSegmentKey(next[0]) !== startSegmentKey) {
			segment = next[0];
		} else {
			break;
		}
	}
}

type Section = { key: number; path: OSM.OsmNode[]; distance: number };

const MAX_ROUNDABOUT_DISTANCE = 1;

function detectRoundabouts(sections: Section[]): Section[][] {
	const sectionsByNode = groupByNode(sections, (s) => s.path[0], (s) => ({ ...s, path: [...s.path].reverse() }));

	function createChains(chain: Section[]): Section[][] {
		const last = chain[chain.length - 1];
		const nextSections = sectionsByNode.get(last.path[last.path.length - 1])!;
		return nextSections.flatMap((next) => {
			if (chain[0].key === next.key) {
				return [chain];
			} else if (chain.some((s) => s.key === next.key) || sum([...chain, next].map((s) => s.distance)) > MAX_ROUNDABOUT_DISTANCE) {
				return [];
			} else {
				return createChains([...chain, next]);
			}
		});
	}

	const roundabouts = sortBy(sections.flatMap((section) => createChains([section])), (chain) => sum(chain.map((s) => s.distance)));

	// Every section can only be part of one roundabout. Smaller circles are preferred.
	const handledSections = new Set<number>();
	return roundabouts.filter((chain) => {
		if (chain.some((s) => handledSections.has(s.key))) {
			return false;
		}
		for (const s of chain) {
			handledSections.add(s.key);
		}
		return true;
	});
}

export type AnalyzedOsmRelationSection = {
	paths: OSM.OsmNode[][];
	distance: number;
};

export type AnalyzedOsmRelation = DeepReadonly<ResolvedOsmRelation> & {
	singleNodes: AnalyzedOsmRelationSingleNode[];
	sections: AnalyzedOsmRelationSection[];
	distance: number;
}

export type AnalyzedOsmFeature = AnalyzedOsmRelation | ResolvedOsmWay | OSM.OsmNode;

export function analyzeOsmRelation(relation: DeepReadonly<ResolvedOsmRelation>): AnalyzedOsmRelation {
	const segments = relationToSegments(relation);
	const singleNodes = segments.singleNodes;
	const waySegments = uniqBy(segments.segments, (s) => getSegmentKey(s));
	const waySegmentsByNode = groupSegmentsByNode(waySegments);

	const segmentsHandled = new Set<string>();
	const sections: Section[] = [];
	for (const originSegment of waySegments) {
		if (segmentsHandled.has(getSegmentKey(originSegment))) {
			continue;
		}

		// Search for an end point of the section (one connected to 0 or more than 1 other segment).
		// If there is none, this is a circular section, so we use the current point as the end point
		let startSegment: Segment;
		for (const segment of walkThroughSegments(originSegment, waySegmentsByNode, true)) {
			startSegment = segment;
		}
		startSegment = [startSegment![1], startSegment![0]]; // startSegment is reversed, so we reverse it again

		const path = [startSegment[0]];
		for (const segment of walkThroughSegments(startSegment, waySegmentsByNode)) {
			segmentsHandled.add(getSegmentKey(segment));
			segmentsHandled.add(getSegmentKey([segment[1], segment[0]]));
			path.push(segment[1]);
		}
		sections.push({ key: sections.length, path, distance: calculateDistance(path) });
	}

	// Detect roundabouts
	const roundabouts = detectRoundabouts(sections);
	const roundaboutSectionKeys = new Set(roundabouts.flat().map((r) => r.key));
	const rawSectionGroups = sections.filter((s) => !roundaboutSectionKeys.has(s.key)).map((s) => [s]);

	for (const roundabout of roundabouts) {
		const touchingSectionGroups = rawSectionGroups.filter((g) => g.some((s1) => roundabout.some((s2) => isConnected(s1.path, s2.path))));
		if (touchingSectionGroups.length === 0) {
			rawSectionGroups.push(roundabout);
		} else if (touchingSectionGroups.length === 2) {
			touchingSectionGroups[0].push(...roundabout, ...touchingSectionGroups[1]);
			pull(rawSectionGroups, touchingSectionGroups[1]);
		} else {
			touchingSectionGroups[0].push(...roundabout);
		}
	}

	const sectionGroups = rawSectionGroups.map((g) => ({
		distance: sum(g.map((s) => s.distance)),
		paths: g.map((s) => s.path)
	}));

	return {
		...relation,
		singleNodes,
		sections: sectionGroups,
		// sections: sections.map((s) => ({ distance: s.distance, paths: [s.path] })),
		distance: sum(sectionGroups.map((g) => g.distance))
	};
}