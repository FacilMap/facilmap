(function(fm, $, ng, undefined) {

	fm.app.factory("fmFilter", function(compileExpression, $rootScope, $uibModal, fmUtils) {
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

			_getMatchesWithBrackets: function(str, regexp) {
				var ret = [ ];

				(str || "").replace(new RegExp(regexp, "gi"), function() {
					var offset = arguments[arguments.length-2];
					var match = arguments[0];

					var open = match.match(/\(/g);
					var close = match.match(/\)/g);
					var needBraces = (open ? open.length : 0) - (close ? close.length : 0);
					for(var i=offset+match.length; i<str.length && needBraces > 0; i++) {
						if(str[i] == "(")
							needBraces++;
						else if(str[i] == ")")
							needBraces--;
					}

					ret.push(str.substring(offset, i));
				});

				return ret;
			},

			makeTypeFilter: function(previousFilter, typeId, filteredData) {
				function removePart(str, regexp) {
					str = str || "";
					regexp.forEach(function(r) {
						str = str
							.replace(new RegExp("^" + r + "($|\\s+and\\s+|\\s+or\\s+)", "ig"), "")
							.replace(new RegExp("\\s+(and|or)\\s+" + r + "($|[^0-9a-z])", "ig"), function() { return arguments[arguments.length-3]; })
					});
					return str;
				}

				var ret = removePart(previousFilter,
					fmFilter._getMatchesWithBrackets(previousFilter, "(not\\s+)?\\(typeId\\s*==\\s*" + typeId).map(fmUtils.quoteRegExp)
						.concat([ "typeId\\s*[!=]=\\s*" + typeId ]));

				if(typeof filteredData == "boolean") {
					if(filteredData)
						ret = (ret ? ret + " and " : "") + "typeId!=" + typeId;
				} else {
					var append = [ ];
					for(var i in filteredData) {
						var no = Object.keys(filteredData[i]).filter(function(it) { return !filteredData[i][it]; });
						var yes = Object.keys(filteredData[i]).filter(function(it) { return filteredData[i][it]; });

						if(no.length == 0) // No item is not filtered, so we can filter the whole type
							return (ret ? ret + " and " : "") + "typeId!=" + typeId;

						if(yes.length > 0) {
							var negative = "prop(data," + fmFilter.quote(i) + ")" + (no.length > 1 ? " not in (" + no.map(fmFilter.quote).join(",") + ")" : "!=" + fmFilter.quote(no[0]));
							var positive = "prop(data," + fmFilter.quote(i) + ")" + (yes.length > 1 ? " in (" + yes.map(fmFilter.quote).join(",") + ")" : "==" + fmFilter.quote(yes[0]));

							append.push(negative.length < positive.length ? negative : positive);
						}
					}

					if(append.length > 0)
						ret = (ret ? ret + " and " : "") + "not (typeId=="+typeId+" and " + (append.length > 1 ? "(" + append.join(" or ") + ")" : append[0]) + ")";
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