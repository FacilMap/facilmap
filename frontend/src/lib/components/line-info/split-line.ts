import { reactive, ref, toRef, type Ref } from "vue";
import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
import { useToasts, type ToastAction } from "../ui/toasts/toasts.vue";
import { useI18n } from "../../utils/i18n";
import type { Line, Point } from "facilmap-types";

export function useSplitLine(line: Ref<Line>): {
	split: (touchMode: boolean) => Promise<void>;
} {
	const toasts = useToasts();
	const i18n = useI18n();

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);

	async function split(touchMode: boolean) {
		toasts.hideToast(`fm${context.id}-line-info-split`);
		toasts.hideToast(`fm${context.id}-line-info-split-error`);

		mapContext.value.components.map.fire('fmInteractionStart');

		const isSaving = ref(false);
		const hasMarkerPos = ref(false);

		const done = async (pos?: Point) => {
			toasts.hideToast(`fm${context.id}-line-info-split-error`);

			try {
				if (pos) {
					isSaving.value = true;
					await client.value.splitLine({ id: line.value.id, lat: pos.lat, lon: pos.lon });
				}

				toasts.hideToast(`fm${context.id}-line-info-split`);
				mapContext.value.components.map.fire('fmInteractionEnd');
			} catch (err) {
				toasts.showErrorToast(`fm${context.id}-line-info-split-error`, () => i18n.t("line-info.split-line-error"), err);
				isSaving.value = false;
				return false;
			}
		};

		const expectClick = mapContext.value.components.linesLayer.expectLineClick(line.value.id, touchMode, done, (point) => {
			hasMarkerPos.value = !!point;
		});

		toasts.showToast(
			`fm${context.id}-line-info-split`,
			() => i18n.t("line-info.split-line-title"),
			() => touchMode ? i18n.t("line-info.split-line-message-touch") : i18n.t("line-info.split-line-message-click"),
			reactive({
				noCloseButton: true,
				actions: toRef((): ToastAction[] => [
					...touchMode ? [{
						label: i18n.t("line-info.split-line-split"),
						onClick: () => { expectClick.finish(); },
						isDisabled: !hasMarkerPos.value,
						variant: "primary" as const
					}] : [],
					{
						label: i18n.t("line-info.split-line-cancel"),
						onClick: () => { expectClick.cancel(); void done(); },
						isDisabled: isSaving.value
					}
				])
			})
		);
	}

	return {
		split
	};
};