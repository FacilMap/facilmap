import $ from "jquery";
import "tablesorter/dist/js/jquery.tablesorter";
import "tablesorter/dist/js/widgets/widget-uitheme.min.js";
import "tablesorter/dist/js/widgets/widget-resizable.min.js";
import "tablesorter/dist/css/theme.bootstrap_4.min.css";
import "./table.scss";
import { registerDeobfuscationHandlers } from "../utils/obfuscate";

// Bootstrap import, see https://getbootstrap.com/docs/5.3/customize/optimize/#lean-javascript
// import 'bootstrap/js/dist/alert';
// import 'bootstrap/js/dist/button';
// import 'bootstrap/js/dist/carousel';
import 'bootstrap/js/dist/collapse';
// import 'bootstrap/js/dist/dropdown';
// import 'bootstrap/js/dist/modal';
// import 'bootstrap/js/dist/offcanvas';
// import 'bootstrap/js/dist/popover';
// import 'bootstrap/js/dist/scrollspy';
// import 'bootstrap/js/dist/tab';
// import 'bootstrap/js/dist/toast';
// import 'bootstrap/js/dist/tooltip';

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
