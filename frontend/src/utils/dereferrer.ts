export function registerDereferrerHandler(baseUrl: string): void {
	const handleClick = (e: MouseEvent) => {
		const link = (e.target instanceof Element) ? e.target.closest("a") : undefined;
		if (link) {
			const href = link.getAttribute("href");
			if(href && href.match(/^\s*(https?:)?\/\//i) && !href.startsWith(baseUrl)) {
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