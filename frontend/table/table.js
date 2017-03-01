import 'bootstrap';
import $ from 'jquery';
import 'tablesorter/dist/js/jquery.tablesorter';
import 'tablesorter/dist/js/widgets/widget-uitheme.min.js';
import 'tablesorter/dist/js/widgets/widget-resizable.min.js';
import 'tablesorter/dist/css/theme.bootstrap_3.min.css';
import './table.css';

// Dereferrer
$(document).on("click", "a", function(e) {
	var el = $(this);
	var href = el.attr("href");
	if(href && href.match(/^\s*(https?:)?\/\//i)) {
		el.attr("href", "deref.html?"+encodeURIComponent(href));

		setTimeout(function() {
			el.attr("href", href);
		}, 0);
	}
});

$(document).ready(() => {
	$("table.tablesorter").tablesorter({
		theme: "bootstrap",
		headerTemplate: "{content} {icon}",
		widgets: ["uitheme", "resizable"]
	});
});
