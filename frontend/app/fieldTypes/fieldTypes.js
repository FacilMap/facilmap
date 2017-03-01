import fm from '../app';
import $ from 'jquery';
import commonFormat from '../../common/format';

fm.app.directive("fmTypeField", function($parse, $compile) {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			if($parse(attrs.fmTypeFieldModel)(scope) == null)
				$parse(attrs.fmTypeFieldModel+'='+attrs.fmTypeField+'.default')(scope);

			var update = function() {
				var field = $parse(attrs.fmTypeField)(scope);

				var el;
				switch(field.type) {
					case "textarea":
						el = $('<textarea class="form-control"/>');
						break;
					case "dropdown":
						el = $('<select class="form-control"/>');
						if(field.options) {
							for(var i=0; i<field.options.length; i++) {
								$('<option/>').text(field.options[i].value).appendTo(el);
							}
						}
						break;
					case "checkbox":
						el = $('<input type="checkbox" ng-true-value="\'1\'" ng-false-value="\'0\'" />');
						break;
					case "input":
					default:
						el = $('<input type="text" class="form-control"/>');
						break;
				}

				el.attr("ng-model", attrs.fmTypeFieldModel);

				if(attrs.fmTypeFieldId)
					el.attr("id", attrs.fmTypeFieldId);

				el.appendTo(element.empty());

				// For some reason, if we call $compile directly, select boxes will not select the right value
				// with newer versions of angular
				scope.$evalAsync(function() {
					$compile(el)(scope);
				});
			};

			scope.$watch(attrs.fmTypeField+".type", update);
			scope.$watch(attrs.fmTypeField+".options", update, true);
			if(attrs.fmTypeFieldIgnoreDefault == null)
				scope.$watch(attrs.fmTypeField+".default", update);
		}
	};
});

fm.app.directive("fmTypeFieldContent", function($parse) {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			var update = function() {
				var field = $parse(attrs.fmTypeFieldContent)(scope);
				var value = $parse(attrs.fmTypeFieldModel)(scope);

				element.empty().append(commonFormat.formatField(field, value));
			};

			scope.$watch(attrs.fmTypeFieldModel, update);
			scope.$watch(attrs.fmTypeFieldContent+".type", update);
			scope.$watch(attrs.fmTypeFieldContent+".options", update, true);
			if(attrs.fmTypeFieldIgnoreDefault == null)
				scope.$watch(attrs.fmTypeFieldContent+".default", update);
		}
	}
});
