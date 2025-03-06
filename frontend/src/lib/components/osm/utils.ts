import { getOsmFeatureName, type ChangesetFeature } from "facilmap-utils";
import { getI18n } from "../../utils/i18n";
import type { OsmFeatureType } from "osm-api";

export function getOsmObjectLabel(type: OsmFeatureType, id: number): string {
	const i18n = getI18n();
	return (
		type === "node" ? i18n.t("osm-feature-link.node", { id }) :
		type === "way" ? i18n.t("osm-feature-link.way", { id }) :
		type === "relation" ? i18n.t("osm-feature-link.relation", { id }) :
		""
	);
}

export function getChangesetFeatureLabel(feature: ChangesetFeature): string {
	const i18n = getI18n();
	const oldName = getOsmFeatureName(feature.old?.tags ?? {}, i18n.currentLanguage);
	const newName = getOsmFeatureName(feature.new?.tags ?? {}, i18n.currentLanguage);
	const name = oldName && newName && oldName !== newName ? `${oldName} → ${newName}` : (oldName ?? newName);
	const label = getOsmObjectLabel(feature.type, feature.id);
	return `${label}${name ? ` (${name})` : ""}`;
}