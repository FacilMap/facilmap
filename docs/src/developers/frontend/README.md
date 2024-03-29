# Overview

The FacilMap frontend is a [Vue.js](https://vuejs.org/) app that provides the main FacilMap UI. You can use it to integrate a modified or extended version of the FacilMap UI or its individual components into your app. If you just want to embed the whole FacilMap UI without any modifications, it is easier to [embed it as an iframe](../embed.md).

The FacilMap frontend is available as the [facilmap-frontend](https://www.npmjs.com/package/facilmap-frontend) package on NPM.

Right now there is no documentation of the individual UI components, nor are they designed to be reusable or have a stable interface. Use them at your own risk and have a look at the [source code](https://github.com/FacilMap/facilmap/tree/main/frontend/src/lib) to get an idea how to use them.

## Setup

The FacilMap frontend is published as an ES module. It is meant to be used as part of an app that is built using a bundler, rather than importing it directly into a HTML file.

The frontend heavily relies on Vue, Bootstrap and other large libraries. These are not part of the bundle, but are imported using `import` JavaScript statements. This avoids duplicating these dependencies if you also use them elsewhere in your app.

To get FacilMap into your app, install the NPM package using `npm install -S facilmap-frontend` or `yarn add facilmap-frontend` and then import the components that you need.

```javascript
import { FacilMap } from "facilmap-frontend";
```

The FacilMap UI uses a slightly adjusted version of [Bootstrap 5](https://getbootstrap.com/) for styling. To avoid duplication if you want to integrate FacilMap into an app that is already using Bootstrap, the Bootstrap CSS is not part of the main export. If you want to use FacilMap’s default Bootstrap styles, import them separately from `facilmap-frontend/bootstrap.css`:

```javascript
import "facilmap-frontend/bootstrap.css";
```

## Structure

The [`<FacilMap>`](./facilmap.md) component renders the whole frontend, including a component that provides a connection to the FacilMap server. If you want to render the whole FacilMap UI, simply render that component rather than rendering all the components of the UI individually.

```vue
<FacilMap
	baseUrl="https://facilmap.org/"
	serverUrl="https://facilmap.org/"
	:padId="undefined"
></FacilMap>
```

The `<FacilMapContextProvider>` component provides a reactive object that acts as the central hub for all components to provide their public state (for example the facilmap-client object, the current map ID, the current selection, the current map view) and their public API (for example to open a search box tab, to open a map, to set route destinations). All components that need to communicate with each other use this context for that. This means that if you want to render individual UI components, you need to make sure that they are rendered within a `<FacilMapContextProvider>` (or within a `<FacilMap>`, which renders the context provider for you). It also means that if you want to add your own custom UI components, they will benefit greatly from accessing the context.

The context is both injected and exposed by both the `<FacilMap>` and the `<FacilMapContextProvider>` component. To access the injected context, import the `injectContextRequired` function from `facilmap-frontend` and call it in the setup function of your component. For this, the component must be a child of `<FacilMap>` or `<FacilMapContextProvider>`. To access the exposed context, use a ref:
```vue
<script setup lang="ts">
	import { FacilMap } from "facilmap-frontend";

	const facilMapRef = ref<InstanceType<typeof FacilMap>>();

	// Access the context as facilMapRef.value.context
</script>
<template>
	<FacilMap ref="facilMapRef"></FacilMap>
</template>
```

For now there is no documentation of the context object. To get an idea of its API, have a look at its [source code](https://github.com/FacilMap/facilmap/blob/main/frontend/src/lib/components/facil-map-context-provider/facil-map-context.ts).

## Styling

All FacilMap components use static class names to make it possible to adjust the styling. FacilMap class names are prefixed with `fm-`.