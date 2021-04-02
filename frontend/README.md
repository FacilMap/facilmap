Embedding FacilMap into a website
=================================

Using an iframe
---------------

It is perfectly fine to embed a map from [facilmap.org](https://facilmap.org/) into an iframe.

```html
<iframe style="height: 500px; width: 100%; border: none;" src="https://facilmap.org/mymap"></iframe>
```

If you use a map ID that does not exist yet, the “Create Collaborative Map” dialog will be opened when accessing the
map.

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

To synchronize the map state with the location hash (to add something like #9/31/24 to the address bar of the browser to indicate the current map view), add the following script:

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
