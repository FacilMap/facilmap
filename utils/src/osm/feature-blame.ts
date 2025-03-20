import * as OSM from "osm-api";
import { scaleProgress, sendProgress, generateUniqueColours, type OnProgress } from "../utils";
import type { Bbox, Colour } from "facilmap-types";
import { memoize, orderBy, uniqBy } from "lodash-es";
import { getBboxForNodeList, getFeatureAtTimestamp, getFeatureKey, nodeListToSegments } from "./utils";

/**
 * A section represents a path of nodes or a single node that is a (direct or indirect) member of the relation/way.
 * One section in this array represents a continuous piece of path that ended up in the relation through a single changeset.
 */
export type OsmFeatureBlameSection = {
	/**
	 * A segment can be added to a relation in the following ways:
	 * - A node somewhere in the hierarchy of relations and ways is moved
	 * - A node, way or relation is added to a way or relation in the hierarchy of relations and ways
	 * This property contains the specific revisions of the specific nodes/ways/relations that caused the current segment to be
	 * in the relation.
	 */
	causingChanges: CausingChange[];
	paths: OSM.OsmNode[][];
	user: { name: string; colour: Colour };
	changeset: OSM.Changeset;
	timestamp: string;
};

export type OsmFeatureBlame = {
	feature: OSM.OsmRelation | OSM.OsmWay;
	sections: OsmFeatureBlameSection[];
	bbox: Bbox;
}

type FeatureSegment = {
	a: OSM.OsmNode;
	b: OSM.OsmNode;
	cause: CausingChange;
};

type Membership = Array<{ feature: OSM.OsmRelation | OSM.OsmWay; role?: string }>;

type CausingChange = {
	feature: OSM.OsmFeature;
	featureMembership: Membership;
};

function getSegmentKey(segment: FeatureSegment): string {
	return `${segment.a.lat},${segment.a.lon};${segment.b.lat},${segment.b.lon}`;
}

type RecursiveMember = { type: "relation"; id: number; feature: OSM.OsmRelation; prevFeatures: OSM.OsmRelation[]; membership: Membership } | { type: "way" | "node"; id: number; membership: Membership };

export async function blameOsmFeature(type: "relation" | "way", id: number, onProgress?: OnProgress & { onBbox?: (bbox: Bbox) => void }): Promise<OsmFeatureBlame> {
	const getFeatureHistory = memoize((type: OSM.OsmFeatureType, id: number) => OSM.getFeatureHistory(type, id), (type, id) => `${type}-${id}`) as typeof OSM.getFeatureHistory;

	async function getRecursiveMembersAtTimestamp(relation: OSM.OsmRelation, date: Date | undefined, onProgress: OnProgress, _membership: Membership = []): Promise<RecursiveMember[]> {
		const result: RecursiveMember[] = [];
		const totalRelations = relation.members.filter((m) => m.type === "relation").length;
		let doneRelations = 0;
		for (const member of relation.members) {
			const membership = [..._membership, { feature: relation, role: member.role }];
			if (member.type === "relation") {
				if (!membership.some((m) => m.feature.type === member.type && m.feature.id === member.ref)) { // Avoid recursion
					const history = await getFeatureHistory("relation", member.ref);
					const relation = getFeatureAtTimestamp(history, date)!;
					const prevRelations = history.filter((f) => f.version < relation.version);
					result.push({ type: member.type, id: member.ref, membership, feature: relation, prevFeatures: prevRelations });
					result.push(...await getRecursiveMembersAtTimestamp(relation, date, scaleProgress(onProgress, doneRelations / totalRelations, (doneRelations + 1) / totalRelations), membership));
					doneRelations++;
				}
			} else {
				result.push({ type: member.type, id: member.ref, membership });
			}
		}
		sendProgress(onProgress, 1);
		return result;
	}

	function getCause(a: OSM.OsmNode, b: OSM.OsmNode, membership: Membership, date: Date | undefined): CausingChange {
		return orderBy([
			...membership.map((m, i) => ({ feature: m.feature, featureMembership: membership.slice(0, i) })),
			{ feature: a, featureMembership: membership },
			{ feature: b, featureMembership: membership }
		].filter((f) => date == null || new Date(f.feature.timestamp) <= date), (f) => f.feature.timestamp, "desc")[0];
	}

	async function getSegmentsAtTimestamp(thisType: "relation" | "way", thisId: number, date: Date | undefined, onProgress: OnProgress): Promise<{ feature: OSM.OsmWay | OSM.OsmRelation | undefined; prevFeature: OSM.OsmFeature[]; features: OSM.OsmFeature[]; prevFeatures: OSM.OsmFeature[]; segments: FeatureSegment[] }> {
		const mainHistory = await getFeatureHistory(thisType, thisId);
		const mainFeature = getFeatureAtTimestamp(mainHistory, date);
		if (!mainFeature) {
			sendProgress(onProgress, 1);
			return { feature: undefined, prevFeature: [], features: [], prevFeatures: [], segments: [] };
		}

		const prevMainFeature = mainHistory.filter((f) => f.version < mainFeature.version);

		sendProgress(onProgress, 0.02);

		let members: RecursiveMember[];
		if (mainFeature.type === "relation") {
			members = uniqBy(await getRecursiveMembersAtTimestamp(mainFeature, date, scaleProgress(onProgress, 0.02, 0.1)), (m) => `${m.type}-${m.id}`);
		} else {
			members = [{ type: "way", id: thisId, membership: [] }];
		}

		const wayFactor = 50; // Assume that a way has this amount of nodes for the progress calculation
		const totalMembers = members.reduce((p, c) => p + (c.type === "way" ? wayFactor : c.type === "node" ? 1 : 0), 0);
		let doneMembers = 0;
		const memberProgress = scaleProgress(onProgress, 0.1, 1);

		const features: OSM.OsmFeature[] = [];
		const prevFeatures: OSM.OsmFeature[] = [];
		const segments: FeatureSegment[] = [];

		for (const member of members) {
			if (member.type === "relation") {
				features.push(member.feature);
				prevFeatures.push(...member.prevFeatures);
			} else {
				const history = await getFeatureHistory(member.type, member.id);
				const feature = getFeatureAtTimestamp(history, date);
				if (feature) {
					features.push(feature);
					prevFeatures.push(...history.filter((f) => f.version < feature.version));

					if (feature.type === "node") {
						segments.push({ a: feature, b: feature, cause: getCause(feature, feature, member.membership, date) });
						sendProgress(memberProgress, (++doneMembers) / totalMembers);
					} else if (feature.type === "way") {
						let doneNodes = 0;
						let nodeProgress = scaleProgress(memberProgress, doneMembers / totalMembers, (doneMembers + wayFactor) / totalMembers);
						const nodes: OSM.OsmNode[] = [];
						for (const nodeId of feature.nodes) {
							const nodeHistory = await getFeatureHistory("node", nodeId);
							const node = getFeatureAtTimestamp(nodeHistory, date);
							if (node) {
								nodes.push(node);
								features.push(node);
								prevFeatures.push(...nodeHistory.filter((f) => f.version < node.version));
							}
							sendProgress(nodeProgress, (++doneNodes) / feature.nodes.length);
						}
						let wayMembership = [...member.membership, { feature }];
						segments.push(...nodeListToSegments(nodes).map(([a, b]) => ({ a, b, cause: getCause(a, b, wayMembership, date) })));
						doneMembers += wayFactor;
					}
				}
			}
		}

		return { feature: mainFeature, prevFeature: prevMainFeature, features, prevFeatures, segments };
	}

	sendProgress(onProgress, 0);
	let mainData;
	let bbox;
	let segments = new Map<string, FeatureSegment>();
	let date: number | undefined = undefined;
	let iterations = 0;
	const timelineProgress = scaleProgress(onProgress, 0, 0.9);

	while (date == null || date > -Infinity) {
		const data = await getSegmentsAtTimestamp(type, id, date != null ? new Date(date) : undefined, scaleProgress(timelineProgress, iterations / (iterations + 1), (iterations + 1) / (iterations + 2)));

		if (date == null) {
			// First iteration
			mainData = data;
			bbox = getBboxForNodeList(mainData.segments.flatMap((s) => [s.a, s.b]));
			onProgress?.onBbox?.(bbox);
			segments = new Map(data.segments.map((s) => [getSegmentKey(s), s]));
			date = Math.max(...[...data.feature ? [data.feature] : [], ...data.features].map((f) => new Date(f.timestamp).getTime()));
		} else {
			let handled = 0;
			for (const segment of data.segments) {
				const key = getSegmentKey(segment);
				if (segments.has(key)) {
					handled++;
					segments.set(key, segment);
				}
			}
			if (handled === 0) {
				// This version of the relation has no common segments with the latest version, so we are finished.
				break;
			}
		}

		date = Math.max(...[...data.prevFeature, ...data.prevFeatures].map((f) => new Date(f.timestamp).getTime()).filter((d) => d < date!));
		iterations++;
	}

	// Group segments by changeset
	const sectionsByChangeset = new Map<number, Pick<OsmFeatureBlameSection, "causingChanges" | "paths">>();
	let lastChangesetId: number | undefined = undefined;
	let lastNode: OSM.OsmNode | undefined = undefined;
	for (const segment of segments.values()) {
		const isIndividualNode = segment.a === segment.b;

		let section = sectionsByChangeset.get(segment.cause.feature.changeset);
		if (!section) {
			section = {
				causingChanges: [],
				paths: []
			};
			sectionsByChangeset.set(segment.cause.feature.changeset, section);
		}

		if (lastChangesetId == null || lastChangesetId !== segment.cause.feature.changeset || isIndividualNode || !lastNode || lastNode.lat !== segment.a.lat || lastNode.lon !== segment.a.lon) {
			section.paths.push([segment.a]);
			lastNode = segment.a;
		}

		section.causingChanges.push(segment.cause);

		if (!isIndividualNode) {
			section.paths[section.paths.length - 1].push(segment.b);
			lastNode = segment.b;
		}

		lastChangesetId = segment.cause.feature.changeset;
	}

	const allChangesets = Object.fromEntries((await OSM.listChangesets({ changesets: [...sectionsByChangeset.keys()] })).map((c) => [c.id, c]));
	const users = new Map<string, OsmFeatureBlameSection["user"]>();
	const sections = orderBy([...sectionsByChangeset.values()].map((section) => {
		const ordered = orderBy(section.causingChanges, (c) => c.feature.timestamp, "desc");

		let user = users.get(ordered[0].feature.user);
		if (!user) {
			user = { name: ordered[0].feature.user, colour: "" };
			users.set(user.name, user);
		}

		return {
			paths: section.paths,
			causingChanges: uniqBy(ordered, (c) => getFeatureKey(c.feature)),
			user,
			changeset: allChangesets[ordered[0].feature.changeset],
			timestamp: ordered[0].feature.timestamp
		};
	}), (s) => s.timestamp, "desc");

	// Assign colours now that changesets are ordered, so that the more distinguishable colours come first
	const colourGen = generateUniqueColours();
	for (const section of sections) {
		if (!section.user.colour) {
			section.user.colour = colourGen.next().value!;
		}
	}

	sendProgress(onProgress, 1);

	return { feature: mainData!.feature!, sections, bbox: bbox! };
}