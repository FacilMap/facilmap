#!/bin/sh

chown facilmap:facilmap "$CACHE_DIR"

if [[ "$RUN_AS_ROOT" = 1 ]]; then
	exec "$@"
else
	exec su facilmap -c "$@"
fi