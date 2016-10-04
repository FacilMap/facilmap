(function(fp, $, ng, undefined) {

	fp.app.directive("fpTypeField", [ "$parse", "$compile", function($parse, $compile) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				if($parse(attrs.fpTypeFieldModel)(scope) == null)
					$parse(attrs.fpTypeFieldModel+'='+attrs.fpTypeField+'.default')(scope);

				var update = function() {
					var field = $parse(attrs.fpTypeField)(scope);

					var el;
					switch(field.type) {
						case "textarea":
							el = $('<textarea/>');
							break;
						case "dropdown":
							el = $('<select/>');
							if(field.options) {
								for(var i=0; i<field.options.length; i++) {
									$('<option/>').attr("value", field.options[i].key).text(field.options[i].value).appendTo(el);
								}
							}
							break;
						case "checkbox":
							el = $('<input type="checkbox" ng-true-value="\'1\'" ng-false-value="\'0\'" />');
							break;
						case "input":
						default:
							el = $('<input type="text"/>');
							break;
					}

					el.attr("ng-model", attrs.fpTypeFieldModel);

					if(attrs.fpTypeFieldId)
						el.attr("id", attrs.fpTypeFieldId);
					if(attrs.fpTypeFieldClass)
						el.attr("class", attrs.fpTypeFieldClass);

					el.appendTo(element.empty());
					$compile(el)(scope);
					scope.$evalAsync(); // $compile only replaces variables on next digest
				};

				scope.$watch(attrs.fpTypeField+".type", update);
				scope.$watch(attrs.fpTypeField+".options", update, true);
				if(attrs.fpTypeFieldIgnoreDefault == null)
					scope.$watch(attrs.fpTypeField+".default", update);
			}
		};
	} ]);

	fp.app.directive("fpTypeFieldContent", [ "$parse", "fpTypeFields", function($parse, fpTypeFields) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				var update = function() {
					var field = $parse(attrs.fpTypeFieldContent)(scope);
					var value = $parse(attrs.fpTypeFieldModel)(scope);

					element.empty().append(fpTypeFields.formatField(field, value));
				};

				scope.$watch(attrs.fpTypeFieldModel, update);
				scope.$watch(attrs.fpTypeFieldContent+".type", update);
				scope.$watch(attrs.fpTypeFieldContent+".options", update, true);
				if(attrs.fpTypeFieldIgnoreDefault == null)
					scope.$watch(attrs.fpTypeFieldContent+".default", update);
			}
		}
	} ]);

	fp.app.factory("fpTypeFields", [ "fpMarked", function(fpMarked) {
		return {
			formatField : function(field, value) {
				if(value == null)
					value = field['default'] || "";
				switch(field.type) {
					case "textarea":
						return fpMarked.block(value);
					case "checkbox":
						return value == "1" ? "✔" : "✘";
					case "dropdown":
						var val = null;
						function _resolve(value) {
							for(var i=0; i<(field.options || [ ]).length; i++) {
								if(field.options[i].key == value) {
									val = field.options[i].value;
									break;
								}
							}
						}

						_resolve(value);
						if(val == null)
							_resolve(field['default']);
						return val || "";
					case "input":
					default:
						return fpMarked.inline(value);
				}
			}
		}
	}])

})(FacilPad, jQuery, angular);