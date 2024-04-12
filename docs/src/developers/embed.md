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
* `search`: Show the search box (default: `true`)
* `route`: Show the route tab in the search box (default: `true`)
* `pois`: Show the POIs tab in the search box (default: `true`)
* `autofocus`: Autofocus the search field (default: `false`)
* `legend`: Show the legend if available (default: `true`)
* `locate`: Show the locate control to zoom to the user’s location (default: `true`)
* `interactive`: Enable [interactive mode](#interactive-mode) (default: `false`)
* `lang`: Use this display language (for example `en`) by default, instead of the language set by the user in the user preferences dialog or in their browser.
* `units`: Use this type of units (either `metric` or `us_customary`) by default, instead of what the user has configured in the user preferences dialog.

Example:

```html
<iframe style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap?search=false&amp;toolbox=false"></iframe>
```

## Interactive mode

When embedding FacilMap into a website, you may want to disable certain UI interactions that make more sense when FacilMap runs as a standalone app. For example, when you want to embed a specific collaborative map, you may want to disable any interactions that will navigate the user away from the map, such as closing the map or navigating to a bookmark. Disabling interactive mode will hide the following UI interactions:

* “Collaborative map” menu in the toolbox, including bookmarks, the “Open collaborative map” dialog and “Close current map”.
* “Share” dialog.
* “Open file” or dragging a geographic file onto the map.
* “Create collaborative map” dialog when opening a map ID that does not exist.
* “Close map” button when the open map is deleted.

## Location hash

When a FacilMap is opened directly in the browser, the current view of the map is [added to the location hash](../users/share/) (the part after the `#` in the URL). This means that users can easily share the current view by copying the URL straight from the address bar of their browser, and reloading the page will not cause the current view to be lost.

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
