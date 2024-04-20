# FacilMap component

The `FacilMap` component renders a complete FacilMap UI. It can be used like this in a Vue.js app:

```vue
<script setup>
	import { FacilMap } from "facilmap-frontend";
</script>

<template>
	<FacilMap
		baseUrl="https://facilmap.org/"
		serverUrl="https://facilmap.org/"
		mapId="my-map"
	></FacilMap>
</template>
```

In a non-Vue.js app, it can be embedded like this:

```javascript
import { FacilMap } from "facilmap-frontend";
import Vue, { createApp, defineComponent, h } from "vue";

createApp(defineComponent({
	setup() {
		return () => h(FacilMap, {
			baseUrl: "https://facilmap.org/",
			serverUrl: "https://facilmap.org/",
			mapId: "my-map"
		});
	}
})).mount(document.getElementById("facilmap")!); // A DOM element that be replaced with the FacilMap component
```

## Props

Note that all of these props are reactive and can be changed while the map is open.

* `baseUrl` (string, required): Collaborative maps should be reachable under `${baseUrl}${mapId}`, while the general map should be available under `${baseUrl}`. For the default FacilMap installation, `baseUrl` would be `https://facilmap.org/`. It needs to end with a slash. It is used to create the map URL for example in the map settings or when switching between different maps (only in interactive mode).
* `serverUrl` (string, required): The URL under which the FacilMap server is running, for example `https://facilmap.org/`. This is invisible to the user.
* `mapId` (string or undefined, required): The ID of the collaborative map that should be opened. If this is undefined, no map is opened. This is reactive, when a new value is passed, a new map is opened. Note that the map ID may change as the map is open, either because the ID of the map is changed in the map settings, or because the user navigates to a different map (only in interactive mode). Use `v-model:mapId` to get a [two-way binding](https://vuejs.org/guide/essentials/forms.html) (or listen to the `update:mapId` event).
* `settings` (object, optional): An object with the following properties:
	* `toolbox` (boolean, optional): Whether the toolbox should be shown. Default is `true`.
	* `search` (boolean, optional): Whether the search box should be shown. Default is `true`.
	* `autofocus` (boolean, optional): Whether the search field should be focused. Default is `false`.
	* `legend` (boolean, optional): Whether the legend should be shown (if it is available). Default is `true`.
	* `interactive` (boolean, optional): Whether [interactive mode](../embed.md#interactive-mode) should be enabled. Default is `true`.
	* `linkLogo` (boolean, optional): If `true`, the FacilMap logo will be a link that opens the map in a new window. Default is `false`.
	* `updateHash` (boolean, optional): Whether `location.hash` should be synchonised with the current map view. Default is `false`.

## Events

* `update:mapId`: When the ID of the currently open map is changed, either because the ID of the map was changed in the map settings or because the user navigated to another map. The parameter is a string or undefined (if no map is opened).
* `update:mapName`: When the name of the currently open map is changed, either because it was changed in the map settings or because the user navigated to another map. The parameter is a string or undefined (if no map is opened).

## Slots

* `default`: Components in this slot are rendered directly on top of the map. It makes sense to position them absolutely and choose an appropriate `z-index`.
* `before`, `after`: Components in these slots are rendered above and below the map. Note that on narrow screens (such as smartphones), the search box is also rendered in the `after` slot.

## Styling

By default, the `FacilMap` component renders a flex box with `flex-grow: 1`. To render it at a certain size, wrap it in a flex box of a certain size or override the styles of the `fm-facilmap` class.

The map itself will shrink to make space for the `before` and `after` slots.