# Custom types

By default, a collaborative map has two object types, “Marker” and “Line”. Their styles are freely adjustable and they have one description field. FacilMap allows you to define custom types in addition or in place of the two default types. While geographically, custom types are the same as the default type, they allow you to do the following:
* You can give your types a custom name, you can customise what users see in the “Add” menu of the toolbox.
* You can define form fields in addition or in place of the description field, for example “Address”, “E-mail” or “Status”.
* You can preconfigure the initial style or make the style fixed. The style can also be configured to be dependent on a form field. For example, you can configure that the colour depends on the value of the “Status” field.
* You can easily show/hide objects of a particular type using [filters](../filter/).

## Add a custom type

In order to add a custom type, you need to have the collaborative map open using its [admin link](../collaborative/#urls).

In the [toolbox](../ui/#toolbox), click on “Add” and then “Manage types”. A dialog will open with the existing types listed. Click on “Create” below the list of types to create a new type.

Give the type a name and select whether it is a marker or a line type. The meaning of other fields is described in the different sections. Click on “Create” to add the type to the map.

## Default style

By default, markers are red, 25 pixels tall, have no icon and a drop shape. Lines by default are blue, 4 pixels wide and use the “straight line” route mode. These settings can be changed for each individual marker.

Using custom types, you can change these defaults. You can also make some or all of the values fixed, which means that they cannot be changed for an individual marker/line but are the same for all markers/lines of this type.

Change the default styles by editing the type and adjusting the “Default …” fields. Each field has a “Fixed” checkbox next to it. If that checkbox is checked, this value cannot be adjusted for an individual object of this type and the field will not be shown when editing its data. If the checkbox is unchecked, the value can still be adjustd and what you configure here will only be the initial value.

<Screencast :desktop="require('./styles.mp4')" :mobile="require('./styles-mobile.mp4')"></Screencast>

## Show in legend

Each type has a “show in legend” checkbox. More details can be found under [Add a legend](../legend/).

## Add a field

A field is a container for a value that the user can define when creating or editing a marker/line, and that is shown in the marker/line details.

To create a field, edit the type and click the + icon at the bottom of the field list. You need to specify the following values for a field:
* **Name:** The field name has to be unique on this type. For example, a type cannot have two fields called “Description”.
* **Type:** One of the following:
	* Text field: a single-line text field. [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) can be used for formatting the text.
	* Text area: a multi-line text field. [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) can be used for formatting the text.
	* Dropdown: a select box for which you can define multiple options
	* Checkbox: a checkbox that can be either on or off
* **Default value:** The value that this field should have when an object of this type is initially created. Note that FacilMap does not support marking fields as required, so even if you define a default value for fields, users can still make the field empty when editing the object.

You can rearrange the order of the fields by dragging the up/down arrow icon on the right.

<Screencast :desktop="require('./field.mp4')" :mobile="require('./field-mobile.mp4')"></Screencast>

### Dropdown fields

When you create a dropdown field, you need to specify its options by using the “Edit” button. Note that checkbox fields also have an edit button, but that is only relevant if you want to adjust [styles based on field values](#styles-based-on-field-values).

To add dropdown options, edit the dropdown and click the + icon under the option list. You can drag the up/down arrows on the right to rearrange the options. Two options of the same dropdown cannot have the same value.

<Screencast :desktop="require('./dropdown.mp4')" :mobile="require('./dropdown-mobile.mp4')"></Screencast>

## Change a field

You can change the details of an existing field. Changing its different properties will have the following effects:
* **Name:** If you rename a field, when saving the type, the field will be renamed in all objects of this type. This means that renaming a field is not the same as removing a field and creating an identical one with the same name.
* **Type:** If you change the type of a field, its values are preserved. For example, if an object has the dropdown value “Done” and you change the field type from dropdown to text field, the field will still have the value “Done”. There are some special cases:
	* If you change a checkbox field to another type, its values will be `1` (checked) or `0` (unchecked)
	* If you change a field into a dropdown, values that are not a valid option of the dropdown will be shown as the first option of the dropdown (but internally they will keep the old value until they are changed again).
	* If you change a field into a checkbox, values that are `1` will be shown as checked, all other values will be shown as unchecked.
* **Dropdown options:**
	* If you rename a dropdown option, the value is renamed for all objects that currently have this option selected. So renaming a dropdown option is different than removing one and adding another one.
	* If you remove a dropdown option, all objects that still use this value will keep their value internally, but it will be shown as the first dropdown option.
* **Default value:** Changing the default value will not affect the existing values of any objects. However, for those objects that internally don’t have a value set for this field at all (because the default value was empty when they were created and a value was never set), the new default value will be shown.

## Delete a field

When you delete a field, it and its values will not be shown anymore, but the underlying data is still there. For example, when you delete a field called “Status”, the marker/line details will not show the field “Status” anymore, but internally they might still have a value for it. This means that if you later add a field called “Status” again, the old values will still be there.

## Styles based on field values

You can configure dropdown and checkbox fields to define certain properties of the object style depending on which value is selected. For example, you can configure a “Status” field that adjusts the colour and icon of a marker depending on what status is selected, and an “Important” checkbox that makes the marker big or small depending on whether it is checked or not.

Click the “Edit” button next to the field type and check one or more of the “Control …” checkboxes. Additional table columns will appear that let you define the value that is connected to this option.

Note that when one field is controlling a style property, no other field can control that property and no default value can be defined for it anymore (those fields will be disabled). Also, the property cannot be adjusted for an individual object anymore. For example, when a dropdown field controls the colour, when editing the marker, no colour field is shown. The colour of the marker can only be changed by selecting an option from the dropdown field.

<Screencast :desktop="require('./field-style.mp4')" :mobile="require('./field-style-mobile.mp4')"></Screencast>

## Change the type of an object

If you have multiple marker types or multiple line types, you can change the type of an existing marker/line by editing it and using the “Change type” dropdown in the bottom left of the dialog. The fields will be adapted to the new type.

Note that objects keep their data internally when you change the type to one that doesn’t have the same fields. If you change the type back later, the values will still be there.

<Screencast :desktop="require('./switch-type.mp4')" :mobile="require('./switch-type-mobile.mp4')"></Screencast>

## Delete a type

Deleting a type is only possible if no objects of this type exist. If you want to delete a type that has existing objects, you might want to use a [filter](../filter) to identify them and then either delete them or change their type.