import "bootstrap";
import $ from "jquery";
import "tablesorter/dist/js/jquery.tablesorter";
import "tablesorter/dist/js/widgets/widget-uitheme.min.js";
import "tablesorter/dist/js/widgets/widget-resizable.min.js";
import "tablesorter/dist/css/theme.bootstrap_3.min.css";
import "./table.css";
import { registerDeobfuscationHandlers } from "../utils/obfuscate";
import "bootstrap/dist/css/bootstrap.css";

// Dereferrer
$(document).on("click", "a", function() {
	const el = $(this);
	const href = el.attr("href");
	if(href && href.match(/^\s*(https?:)?\/\//i)) {
		el.attr("href", "app/static/deref.html?"+encodeURIComponent(href));

		setTimeout(function() {
			el.attr("href", href!);
		}, 0);
	}
});

$(() => {
	($("table.tablesorter") as any).tablesorter({
		theme: "bootstrap",
		headerTemplate: "{content} {icon}",
		widgets: ["uitheme", "resizable"]
	});
});

registerDeobfuscationHandlers();
