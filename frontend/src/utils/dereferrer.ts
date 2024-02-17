export function registerDereferrerHandler(): void {
	const handleClick = (e: MouseEvent) => {
		const link = (e.target instanceof Element) ? e.target.closest("a") : undefined;
		if (link) {
			const href = link.getAttribute("href");
			if(href && href.match(/^\s*(https?:)?\/\//i)) {
				link.setAttribute("href", `_app/static/deref.html?${encodeURIComponent(href)}`);

				setTimeout(function() {
					link.setAttribute("href", href);
				}, 0);
			}
		}
	};
	document.addEventListener("click", handleClick);
	document.addEventListener("auxclick", handleClick);
}