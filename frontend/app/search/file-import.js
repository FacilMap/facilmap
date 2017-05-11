import fm from '../app';
import $ from 'jquery';

fm.app.factory("fmSearchFileImport", function($q) {
	return function(map) {
		var fileEl = $('<input type="file" multiple="multiple">').css("display", "none").appendTo("body");

		fileEl.on("change", function() {
			fmMapImport.importFiles(fileEl.prop("files"));
		});

		map.el.on("dragenter.fmSearchFileImport", false);
		map.el.on("dragover.fmSearchFileImport", false);
		map.el.on("drop.fmSearchFileImport", function(e) {
			e.preventDefault();

			fmMapImport.importFiles(e.originalEvent.dataTransfer.files);
		});

		var fmMapImport = {
			openImportDialog: function() {
				fileEl.click();
			},

			importFiles: function(files) {
				if(!files || files.length == 0)
					return;

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
			},

			destroy: function() {
				fileEl.remove();
				map.el.off(".fmSearchFileImport");
			}
		};

		return fmMapImport;
	}
});
