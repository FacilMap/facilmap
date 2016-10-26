(function(fm, $, ng, undefined) {

	fm.app.factory("fmFilter", function(compileExpression, $rootScope, $uibModal) {
		var currentVal;

		var fmFilter = {
			customFuncs: {
				prop: function(obj, key) {
					return obj && obj[key];
				},

				random: function() { } // Does not work well with angular digest cycles
			},

			hasError: function(expr) {
				try {
					if(expr && expr.trim())
						compileExpression(expr, fmFilter.customFuncs);
				} catch(e) {
					return e;
				}
			},

			compileExpression: function(expr) {
				if(!expr || !expr.trim())
					return function() { return true; };
				else {
					try {
						var customFuncs = { };
						Object.keys(fmFilter.customFuncs).forEach(function(i) {
							customFuncs[i] = function() {
								return fmFilter.customFuncs[i].apply(currentVal, arguments);
							};
						});

						var func = compileExpression(expr, customFuncs);
						return function(val) {
							try {
								currentVal = val;
								return func(val);
							} finally {
								currentVal = null;
							}
						};
					} catch(e) {
						console.error(e);
						return function() { return false; };
					}
				}
			},

			quote: function(str) {
				return '"' + (""+str).replace(/["\\]/g, '\\\1').replace(/\n/g, "\\n") + '"';
			},

			makeTypeFilter: function(previousFilter, typeId, filteredData) {
				function removePart(str, regexp) {
					return (str || "")
						.replace(new RegExp("^" + regexp + "($|\\s+and\\s+|\\s+or\\s+)", "ig"), "")
						.replace(new RegExp("\\s+(and|or)\\s+" + regexp + "($|[^0-9a-z])", "ig"), function() { return arguments[arguments.length-3]; })
				}

				var ret = removePart(previousFilter, "typeId\\s*!=\\s*" + typeId);
				ret = removePart(ret, "not\\s+\\(typeId\\s*==\\s*" + typeId + "\\s([^\\(\\)]*(\\([^\\)]*\\))?)*?\\)");

				if(typeof filteredData == "boolean") {
					if(filteredData)
						ret = (ret ? ret + " and " : "") + "typeId!=" + typeId;
				} else {
					var append = [ ];
					for(var i in filteredData)
						append.push("prop(data," + fmFilter.quote(i) + ")" + (filteredData[i].length > 1 ? " in (" + filteredData[i].map(fmFilter.quote).join(",") + ")" : "==" + fmFilter.quote(filteredData[i][0])));

					if(append.length > 0)
						ret = (ret ? ret + " and " : "") + "not (typeId=="+typeId+" and " + append.join(" or ") + ")";
				}

				return ret;
			},

			prepareObject: function(obj, type) {
				obj = $.extend(true, { }, obj);

				if(type) {
					obj.type = type.type;

					// Resolve dropdown keys to their values
					type.fields.forEach(function(field) {
						if(field.type == "dropdown") {
							var val = field.options.filter(function(option) { return obj.data[field.name] == option.key; });
							if(val.length == 0)
								val = field.options.filter(function(option) { return option.key == field.default; });

							if(val.length > 0)
								obj.data[field.name] = val[0].value;
						}
					});
				}

				return obj;
			},

			showFilterDialog: function(currentFilter, types) {
				var dialog = $uibModal.open({
					templateUrl: "filter/filter-dialog.html",
					scope: $rootScope,
					controller: "fmFilterDialogCtrl",
					size: "lg",
					resolve: {
						currentFilter: function() { return currentFilter; },
						types: function() { return types; }
					}
				});

				return dialog.result;
			}
		};

		return fmFilter;
	});

	fm.app.controller("fmFilterDialogCtrl", function(currentFilter, types, $scope, fmFilter) {
		$scope.filter = currentFilter;
		$scope.types = types;

		$scope.$watch("filter", function(newFilter) {
			$scope.error = fmFilter.hasError(newFilter);
		})
	});

})(FacilMap, jQuery, angular);