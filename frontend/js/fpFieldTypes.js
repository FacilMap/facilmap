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

	fp.app.directive("fpTypeFieldContent", [ "$parse", "fpMarked", function($parse, fpMarked) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				var update = function() {
					var field = $parse(attrs.fpTypeFieldContent)(scope);
					var value = $parse(attrs.fpTypeFieldModel)(scope);

					if(value == null)
						value = field['default'] || "";
					switch(field.type) {
						case "textarea":
							element.empty().append(fpMarked.block(value));
							break;
						case "checkbox":
							element.text(value == "1" ? "✔" : "✘");
							break;
						case "dropdown":
							function _resolve(value) {
								for(var i=0; i<(field.options || [ ]).length; i++) {
									if(field.options[i].key == value) {
										element.text(field.options[i].value);
										return true;
									}
								}
								return false;
							}

							if(!_resolve(value) && !_resolve(field['default']))
								element.text("");

							break;
						case "input":
						default:
							element.empty().append(fpMarked.inline(value));
					}
				};

				scope.$watch(attrs.fpTypeFieldModel, update);
				scope.$watch(attrs.fpTypeFieldContent+".type", update);
				scope.$watch(attrs.fpTypeFieldContent+".options", update, true);
				if(attrs.fpTypeFieldIgnoreDefault == null)
					scope.$watch(attrs.fpTypeFieldContent+".default", update);
			}
		}
	} ]);

})(FacilPad, jQuery, angular);