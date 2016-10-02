(function(fp, $, ng, undefined) {

	fp.app.factory("fpMapTypes", function(fpDialogs, fpUtils) {
		return function(map) {
			var ret = {
				editTypes : function() {
					var scope = map.socket.$new();

					var dialog = fpDialogs.open("map/types/edit-types.html", scope, "Object types");

					scope.create = function() {
						scope.edit({
							fields : [ ]
						});
					};

					scope.edit = ret.editType.bind(ret);

					scope['delete'] = function(type) {
						scope.error = null;
						map.socket.emit("deleteType", { id: type.id }, function(err) {
							if(err)
								scope.error = err;
						});
					};
				},
				editType : function(type) {
					var scope = map.socket.$new();

					scope.type = type; // In case it is not in global types object
					var preserve = fpUtils.preserveObject(map.socket, type.id ? "types["+fpUtils.quoteJavaScript(type.id)+"]" : "type", "type");

					var editDialog = fpDialogs.open("map/types/edit-type.html", scope, "Edit object type", preserve.revert.bind(preserve));

					scope.editDropdown = function(field) {
						ret.editTypeDropdown(type, field);
					};

					scope.createField = function() {
						type.fields.push({ name: "", type: "input", "default": "" });
					};

					scope.deleteField = function(field) {
						var idx = type.fields.indexOf(field);
						if(idx != -1)
							type.fields = type.fields.slice(0, idx).concat(type.fields.slice(idx+1));
					};

					scope.save = function() {
						scope.error = null;
						map.socket.emit(type.id == null ? "addType" : "editType", type, function(err) {
							if(err)
								return scope.error = err;

							editDialog.close(false);
						});
					};
				},
				editTypeDropdown : function(type, field) {
					var scope = map.socket.$new();
					scope.type = type;
					scope.field = field;

					var dialog;

					var preserve = fpUtils.preserveObject(scope, "field", "field", function() {
						dialog.close(false);
					});

					dialog = fpDialogs.open("map/types/edit-type-dropdown.html", scope, "Edit dropdown", preserve.revert.bind(preserve));

					scope.canControl = function(what) {
						return ret.canControl(type, what, field);
					};

					scope.addOption = function() {
						if(field.options == null)
							field.options = [ ];

						field.options.push({ key: fpUtils.generateRandomPadId(), value: "" });
					};

					scope.deleteOption = function(option) {
						var idx = field.options.indexOf(option);
						if(idx != -1)
							field.options = field.options.slice(0, idx).concat(field.options.slice(idx+1));
					};

					scope.save = function() {
						dialog.close(false);
					};
				},
				canControl : function(type, what, ignoreField) {
					var idx = "control"+what.charAt(0).toUpperCase() + what.slice(1);
					for(var i=0; i<(type && type.fields && type.fields || [ ]).length; i++) {
						if(type.fields[i][idx] && (!ignoreField || type.fields[i] !== ignoreField))
							return false;
					}
					return true;
				}
			};
			return ret;
		};
	});

})(FacilPad, jQuery, angular);