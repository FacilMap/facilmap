# Advanced configuration

## Reactivity

When the FacilMap server sends an event to the client that an object has been created, changed or deleted, the client emits the
event and also persists it in its properties. So you have two ways to access the map data: By listening to the map events and
persisting the data somewhere else, or by accessing the properties on the Client object.

If you are using a UI framework that relies on a change detection mechanism (such as Vue.js or Angular), you can override the methods
`_set` and `_delete`. facilmap-client consistently uses these to update any data on its properties.

In Vue.js, it could look like this:

```javascript
const client = new Client("https://facilmap.org/");
client._set = Vue.set;
client._delete = Vue.delete;
```

In Angular.js, it could look like this:

```javascript
const client = new Client("https://facilmap.org/");
client._set = (object, key, value) => { $rootScope.$apply(() => { object[key] = value; }); };
client._delete = (object, key) => { $rootScope.$apply(() => { delete object[key]; }); };
```

This way your UI framework will detect changes to any properties on the client, and you can reference values like `client.padData.name`,
`client.disconnected` and `client.loading` in your UI components.

Note that client always replaces whole objects rather than updating individual properties. For example, when a new version of the map settings arrives, `client.padData` is replaced with a new object, or when a new marker arrives, `client.markers[markerId]` is replaced with a new object. This makes deep watches unnecessary in most cases.


## Marker/line data

The data of a marker or a line maps the name of a field (for example `Description`) to a value. Since field names are user-defined, a user could potentially set field names that are at risk to cause errors or even prototype pollution in JavaScript, such as `__proto__`, `constructor` or `toString`. To avoid such problems, the `data` property is a null prototype object by default.

In some situations, using a null prototype object might not be enough. For example, Vue 2’s reactivity system adds an `__ob` property to all objects. To handle such cases, facilmap-client allows to use a custom type for the `data` property by specifying the `_encodeData` and `_decodeData` methods to translate the `data` objects from a null prototype object to a custom type and back.

The following example uses an [ES6 Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) for the data:
```javascript
const client = new Client("https://facilmap.org/");
client._decodeData = (data) => new Map(Object.entries(data));
client._encodeData = (data) => Object.fromEntries([...data]);
```

Doing this will change the type of the `data` property of the [`Marker`](./types.md#marker) and [`Line`](./types.md#line) types in all properties, methods and events that deal with such objects.

In TypeScript, you can specify the data type using a generic (`Client<Map<string, string>>`).