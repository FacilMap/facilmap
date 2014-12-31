(function(fp, $, ng, undefined) {

	fp.app.factory("fpMarked", function() {
		marked.setOptions({
			breaks: true,
			sanitize: true
		});

		return {
			block: marked,
			inline: function(string, options) {
				var ret = $("<div/>").html(marked(string, options));
				$("p", ret).replaceWith(function() { return $(this).contents(); });
				return ret.html();
			}
		};
	});

})(FacilPad, jQuery, angular);