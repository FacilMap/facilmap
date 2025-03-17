import { getOsmFeatureLabel, getOsmFeatureName, type ChangesetFeature } from "facilmap-utils";
import { getI18n } from "../../utils/i18n";
import type { DeepReadonly } from "vue";

export function getChangesetFeatureLabel(feature: DeepReadonly<ChangesetFeature>): string {
	const i18n = getI18n();
	const oldName = getOsmFeatureName(feature.old?.tags ?? {}, i18n.currentLanguage);
	const newName = getOsmFeatureName(feature.new?.tags ?? {}, i18n.currentLanguage);
	const name = oldName && newName && oldName !== newName ? `${oldName} → ${newName}` : (oldName ?? newName);
	return getOsmFeatureLabel(feature.type, feature.id, name);
}