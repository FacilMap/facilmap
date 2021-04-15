# Embed FacilMap

You can embed a map into any website using an iframe:

```html
<iframe style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap"></iframe>
```

If you use a map ID that does not exist yet, the “Create Collaborative Map” dialog will be opened when accessing the
map (unless the `interactive` parameter is `false`).

## Options

You can control the display of different components by using the following query parameters:

* `toolbox`: Show the toolbox (default: `true`)
* `search`: Show the search bar (default: `true`)
* `autofocus`: Autofocus the search field (default: `false`)
* `legend`: Show the legend if available (default: `true`)
* `interactive`: Show certain items (“Create collaborative map”, “Open file”) in the toolbox (default: `false`)

Example:

```html
<iframe style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap?search=false&amp;toolbox=false"></iframe>
```

## Location hash

When a FacilMap is opened directly in the browser, the current view of the map is [added to the location hash](../users/hash/) (the part after the `#` in the URL). This means that users can easily share the current view by copying the URL straight from the address bar of their browser, and reloading the page will not cause the current view to be lost.

FacilMap emits a [cross-origin message](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) every time it updates the location map. You can listen to it to synchronize the location hash of your website with the one of FacilMap by using the following script:

```html
<iframe id="facilmap" style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap"></iframe>
<script>
	window.addEventListener("message", function(evt) {
		if(evt.data && evt.data.type == "facilmap-hash" && location.hash != "#" + evt.data.hash)
			location.replace("#" + evt.data.hash);
	});

	function handleHashChange() {
		var iframe = document.getElementById("facilmap");
		iframe.src = iframe.src.replace(/(#.*)?$/, "") + location.hash;
	}

	window.addEventListener("hashchange", handleHashChange);
	if (location.hash)
		handleHashChange();
</script>
```
