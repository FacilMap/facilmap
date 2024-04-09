# Filters

Filters provide a way to temporarily show/hide certain markers/lines based on user-defined criteria. Filters only affect what you currently see on the map, they are not persisted and do not affect what other people see on the map. Filters can be persisted as part of [saved views](../views/).

If you simply want to show/hide objects of a certain type, clicking items in the [legend](../legend/) will toggle the visibility of those types by automatically applying a filter expression.

To set a custom filter expression, in the [toolbox](../ui/#toolbox) click “Tools” and then “Filter”. FacilMap uses [filtrex](https://github.com/m93a/filtrex) for the filter expressions. An overview over the syntax elements can be found inside the filter dialog.

If the filter expression is empty, all map objects are shown. If a filter expression is defined, only map objects that match the expression are shown.

## Examples

### Filter by field value

Field values are available as `data`. By default, markers and objects have only a description field (`data.Description`), but [custom types](../types/) may have additional fields. If you have a field “Status” and want to show only map objects whose status is “Done”, the filter expression would be `data.Status == "Done"`.

Be aware that in filter expression, comparison is case sensitive. So the above expression would not match an object whose status is “done”. For case-insensitive comparison, compare the lower-case values: `lower(data.Status) == "done"`.

Checkbox field values are internally represented by the values `0` (unchecked) and `1` (checked). For example, to show only values where the checkbox field “Confirmed” is checked, use `data.Confirmed == 1`.

The regular expression operator `~=` allows for more advanced text matching. For example, to show all objects whose name contains “Untitled”, use `lower(name) ~= "untitled"`. Regular expressions allow to define very complex criteria what the text should look like. There are plenty of tutorials online how to use regular expressions, for example [RegexOne](https://regexone.com/).

### Filter by type

To show only objects of a particular [type](../types/), use `typeId`. You can find a list of the type IDs of your particular map in the description of `typeId` in the syntax overview of the filter dialog. If you have a type with the ID `123`, you can show objects of this type by using `typeId == 123`. To hide objects of this type but show all others use `typeId != 123`.

## Share a link

FacilMap continuously updates the [location hash](../share/) with your current view on the map. Your current filter expression is also saved in the location hash.

If you want to share a link to a particular section of the map with a filter expression applied, simply apply the filter and then copy the URL from the address bar of your browser. An example of such a link would be `https://facilmap.org/my-map#6/51.910/8.789/Mpnk//typeId%3D%3D123`.