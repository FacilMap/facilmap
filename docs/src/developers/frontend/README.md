# Overview

The FacilMap frontend is a [Vue.js](https://vuejs.org/) app that provides the main FacilMap UI.

The FacilMap frontend is available as the [facilmap-frontend](https://www.npmjs.com/package/facilmap-frontend) package on NPM.

## Setup

The FacilMap frontend uses [Bootstrap-Vue](https://bootstrap-vue.org/), but does not install it by default to provide bigger flexibility. When using the FacilMap frontend, make sure to have it [set up](https://bootstrap-vue.org/docs#using-module-bundlers):

```javascript
import Vue from "vue";
import { BootstrapVue } from "bootstrap-vue";
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";

Vue.use(BootstrapVue);
```

## Structure

The FacilMap server renders a static HTML file, which already contains some metadata about the map (such as the map title and the search engines policy configured for the particular map). It then renders a Vue.js app that renders the FacilMap UI using the [`FacilMap`](./facilmap.md) component. It sets the props and listens to the events of the FacilMap app in a way that the URL and document title are updated as the user opens or closes collaborative maps or their metadata changes.

The FacilMap frontend makes heavy use of [provide/inject](https://vuejs.org/v2/api/#provide-inject) feature of Vue.js. Most FacilMap components require the presence of certain injected objects to work. When rendering the `FacilMap` component, the following component hierarchy is created: `FacilMap` (provides `Context`) → `ClientProvider` (provides `Client`) → `LeafletMap` (provides `MapComponents` and `MapContext`) → any UI components. The injected objects have the following purpose:
* `Context`: A reactive object that contains general details about the context in which this FacilMap runs, such as the props that were passed to the `FacilMap` component and the currently opened map ID.
* `Client`: A reactive instance of the FacilMap client.
* `MapComponents`: A non-reactive object that contains all the Leaflet components of the map.
* `MapContext`: A reactive object that contains information about the current state of some Leaflet components, for example the current position of the map. It also acts as an event emitter that is used for communication between different components of the UI.

By passing child components to the `FacilMap` component, you can yourself make use of these injected objects when building extensions for FacilMap. When using class components with [vue-property-decorator](https://github.com/kaorun343/vue-property-decorator), you can inject these objects by using the `InjectContext()`, `InjectMapComponents()`, … decorators. Otherwise, you can inject them by using `inject: [CONTEXT_INJECT_KEY, MAP_COMPONENTS_INJECT_KEY, …]`.

## Styling

All FacilMap components use static class names to make it possible to adjust the styling. FacilMap class names are prefixed with `fm-`.