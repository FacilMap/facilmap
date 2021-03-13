fm.app.directive("fmScrollToView", (fmUtils) => {
	return {
		restrict: 'A',
		link: (scope, element, attrs) => {
			let wasActiveBefore = false;
			scope.$watch(attrs.fmScrollToView, (scrollToView) => {
				scrollToView = !!scrollToView;

				if(scrollToView && !wasActiveBefore) {
					fmUtils.scrollIntoView(element);
				}

				wasActiveBefore = scrollToView;
			});
		}
	};
});