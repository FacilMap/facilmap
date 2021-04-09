# Edit history

When a [marker](../markers/), [line](../lines/), [type](../types/), [view](../views) or the [map settings](../map-settings/) are created, changed or deleted on a collaborative map, the change is recorded in the edit history and can be seen and reverted there. At the moment, only the latest 50 changes are saved, older changes are discarded from the history.

In order to view the edit history, you need to open a map through its [admin link](../collaborative/#urls). In the [toolbox](../ui/#toolbox), click on “Tools” and then “Show edit history”.

The history dialog lists the changes, with the most recent once first. Changes that happen while the dialog is open will be automatically shown at the top, the dialog does not have to be reloaded.

For events of type “Changed”, you can click on the info icon to see the details of which fields were changed from what to what.

## Revert a change

Reverting a change has a different meaning depending on the context:
* Reverting a “Created” event means deleting the object.
* Reverting a “Changed” event means restoring its state before it was changed. (If the object has been changed additional times since the event, technically these changes are reverted as well, since the historical state is restored.)
* Reverting a “Deleted” event means recreating the object in its state before the deletion. (If the object has already been recreated by reverting its deletion, the recreated object is updated to its historical state instead of being recreated another time.)

Reverting a change will itself create an event in the edit history.

Some events cannot be reverted. A “Created” event cannot be reverted if the object has been deleted in the meantime, because it cannot be deleted again. However, after reverting the “Deleted” event, the “Created” event can be reverted to delete it again.

When reverting a “Deleted” event, the object is recreated with a different ID. However, all history events related to the object are updated to represent the new ID. This way it is clear which events belong to the same object, and history versions can still be restored.