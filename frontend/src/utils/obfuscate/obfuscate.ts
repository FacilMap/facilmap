import $ from 'jquery';
import './obfuscate.scss';

function deobfuscate($a: JQuery) {
	if($a.hasClass("emobf")) {
		$a.attr({
			href: `mailto:${$a.attr("data-u")}@${$a.attr("data-d")}`,
			target: ""
		});
	}

	if($a.hasClass("emobf2")) {
		$a.text(`${$a.attr("data-u")}@${$a.attr("data-d")}`);
	}

	$a.removeClass("emobf emobf2");
}

export function registerDeobfuscationHandlers() {
	const clickHandler = (e: JQuery.ClickEvent) => {
		deobfuscate($(e.target).closest(".emobf"));
	};

	const actionHandler = () => {
		$(".emobf,.emobf2").each(function() {
			deobfuscate($(this));
		});

		$(document).off("click", ".emobf", clickHandler);
		$(document).off("mousemove", actionHandler);
		$(document).off("keydown", actionHandler);
	};

	$(document).on("click", ".emobf", clickHandler);
	$(document).one("mousemove", actionHandler);
	$(document).one("keydown", actionHandler);
}