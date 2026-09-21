import { reactive, ref, toRef, type Ref } from "vue";
import { injectContextRequired, requireClientContext, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
import { useToasts } from "../ui/toasts/toasts.vue";
import { useI18n } from "../../utils/i18n";
import type { Line } from "facilmap-types";

export function useMoveLine(line: Ref<Line>): {
	move: () => Promise<void>;
	isMoving: boolean;
} {
	const toasts = useToasts();
	const i18n = useI18n();

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);

	const isMoving = ref(false);

	async function move(): Promise<void> {
		toasts.hideToast(`fm${context.id}-line-info-move`);

		mapContext.value.components.map.fire('fmInteractionStart');
		const routeId = `l${line.value.id}`;

		try {
			await client.value.lineToRoute({ id: line.value.id, routeId });

			mapContext.value.components.linesLayer.hideLine(line.value.id);

			const isSaving = ref(false);

			const done = async (save: boolean) => {
				const route = client.value.routes[routeId];
				if (save && !route)
					return;

				try {
					if(save) {
						isSaving.value = true;
						await client.value.editLine({ id: line.value.id, routePoints: route.routePoints, mode: route.mode });
					}

					toasts.hideToast(`fm${context.id}-line-info-move`);
				} catch (err) {
					toasts.showErrorToast(`fm${context.id}-line-info-move`, () => i18n.t("line-info.save-line-error"), err);
				} finally {
					mapContext.value.components.map.fire('fmInteractionEnd');
					isMoving.value = false;

					// Clear route after editing line so that the server can take the trackPoints from the route
					client.value.clearRoute({ routeId }).catch((err) => {
						console.error("Error clearing route", err);
					});

					mapContext.value.components.linesLayer.unhideLine(line.value.id);
				}
			};

			toasts.showToast(`fm${context.id}-line-info-move`, () => i18n.t("line-info.move-line-title"), () => i18n.t("line-info.move-line-message"), reactive({
				noCloseButton: true,
				actions: toRef(() => [
					{
						label: i18n.t("line-info.move-line-finish"),
						variant: "primary" as const,
						onClick: () => { void done(true); },
						isPending: isSaving.value,
						isDisabled: isSaving.value
					},
					{
						label: i18n.t("line-info.move-line-cancel"),
						onClick: () => { void done(false); },
						isDisabled: isSaving.value
					}
				])
			}));

			isMoving.value = true;
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-line-info-move-error`, () => i18n.t("line-info.save-line-error"), err);

			toasts.hideToast(`fm${context.id}-line-info-move`);
			mapContext.value.components.map.fire('fmInteractionEnd');
			isMoving.value = false;
			client.value.clearRoute({ routeId }).catch((err) => {
				console.error("Error clearing route", err);
			});
			mapContext.value.components.linesLayer.unhideLine(line.value.id);
		}
	}

	return reactive({
		move,
		isMoving
	});
}