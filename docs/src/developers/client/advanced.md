# Advanced configuration

## Reactivity

When the FacilMap server sends an event to the client that an object has been created, changed or deleted, the client emits the
event and also persists it in its properties. So you have two ways to access the map data: By listening to the map events and
persisting the data somewhere else, or by accessing the properties on the Client object.

If you are using a UI framework that relies on a change detection mechanism (such as Vue.js or Angular), facilmap-client provides
a way to make its properties reactive. Internally, the client maintains a `state` object (for any properties related to the client
itself) and a `data` object (for any received map objects). These two objects are stored as private properties on the client object.
All public properties of the client object are just getters that return the data from the two private objects. The client modifies
these two objects consistently in the following way:
* When the client object is constructed, it constructs the private `state` and `data` objects by calling
  `this.object = makeReactive(object)`.
* When the client sets a property inside the `state` and `data` objects, it does so by calling `this._set(this.object, key, value)`.
  This includes setting nested properties.
* When the client deletes a property inside the `state` and `data` objects, it does so by calling `this._delete(this.object, key)`.
  This includes deleting nested properties.

You can override the `_makeReactive`, `_set` and `_delete` methods to make the private properties (and as a consequence the public
getters) of facilmap-client reactive. This way your UI framework will detect changes to any properties on the client, and you can
reference values like `client.padData.name`, `client.disconnected` and `client.loading` in your UI components.

Note that client always replaces whole objects rather than updating individual properties. For example, when a new version of the map settings arrives, `client.padData` is replaced with a new object, or when a new marker arrives, `client.markers[markerId]` is replaced with a new object. This makes deep watches unnecessary in most cases.

### Vue.js 3

```javascript
class ReactiveClient extends Client {
	_makeReactive(object) {
		return Vue.reactive(object);
	}
}
```

### Vue.js 2

```javascript
class ReactiveClient extends Client {
	_set(object, key, value) {
		Vue.set(object, key, value);
	}

	_delete(object, key) {
		Vue.delete(object, key);
	}
}
```

### Angular.js

```javascript
class ReactiveClient extends Client {
	_set(object, key, value) {
		$rootScope.$apply(() => {
			object[key] = value;
		});
	}

	_delete(object, key) {
		$rootScope.$apply(() => {
			delete object[key];
		});
	}
}
```

### React

```javascript
class ObservableClient extends Client {
	_observers = new Set();

	subscribe(callback) {
		this._observers.add(callback);
		return () => {
			this._observers.delete(callback);
		};
	}

	_triggerObservers() {
		for (const observer of this._observers) {
			observer();
		}
	}

	_set(object, key, value) {
		object[key] = value;
		this._triggerObservers();
	}

	_delete(object, key) {
		delete object[key];
		this._triggerObservers();
	}
}

function useClientObserver(client, selector) {
	React.useSyncExternalStore(
		(callback) => client.subscribe(callback),
		() => selector(client)
	);
}

const MarkerInfo = ({ client, markerId }) => {
	const marker = useClientObserver(client, (client) => client.markers[markerId]);
	return (
		<div>
			Marker name: {marker?.name}
		</div>
	);
}
```

Keep in mind that React’s `useSyncExternalStore` will rerender the component if the resulting _object reference_ changes.
This means one the one hand that you cannot use this example implementation on a higher up object of the client (such as
`client` itself or `client.markers`), as their identity never changes, causing your component to never rerender. And on
the other hand that you should avoid using it on objects created in the selector (such as returning
`[client.padData.id, client.padData.name]` in order to get multiple values at once), as it will cause your component to
rerender every time the selector is called.