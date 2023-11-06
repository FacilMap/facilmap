import $ from "jquery";
import "./obfuscate.scss";
import { deobfuscate } from "facilmap-utils";

export function registerDeobfuscationHandlers(): void {
	const clickHandler = (e: JQuery.ClickEvent) => {
		deobfuscate($(e.target).closest(".emobf") as any);
	};

	const actionHandler = () => {
		$(".emobf,.emobf2").each(function() {
			deobfuscate($(this) as any);
		});

		$(document).off("click", ".emobf", clickHandler);
		$(document).off("mousemove", actionHandler);
		$(document).off("keydown", actionHandler);
	};

	$(document).on("click", ".emobf", clickHandler);
	$(document).one("mousemove", actionHandler);
	$(document).one("keydown", actionHandler);
}