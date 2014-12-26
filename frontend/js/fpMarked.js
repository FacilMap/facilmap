(function(fp, $, ng, undefined) {

	marked.setOptions({
		breaks: true
	});

	fp.app.factory("fpMarked", function() {
		return marked;
	});

})(FacilPad, jQuery, angular);