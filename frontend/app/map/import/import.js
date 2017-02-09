import fm from '../../app';
import $ from 'jquery';

fm.app.factory("fmMapImport", function($q) {
	return function(map) {
		var fileEl = $('<input type="file" multiple="multiple">').css("display", "none").appendTo("body");

		fileEl.one("change", function() {
			fmMapImport.importFiles(fileEl.prop("files"));
		});

		map.el.on("dragenter", false);
		map.el.on("dragover", false);
		map.el.on("drop", function(e) {
			e.preventDefault();

			fmMapImport.importFiles(e.originalEvent.dataTransfer.files);
		});

		var fmMapImport = {
			openImportDialog: function() {
				fileEl.click();
			},

			importFiles: function(files) {
				var readers = [ ];

				for(var i=0; i<files.length; i++) {
					readers.push($q(function(resolve, reject) {
						var reader = new FileReader();
						reader.onload = function(e) {
							resolve(e.target.result);
						};
						reader.readAsText(files[i]);
					}));
				}

				$q.all(readers).then(function(files) {
					map.searchUi.showFiles(files);
				});
			}
		};

		return fmMapImport;
	}
});
