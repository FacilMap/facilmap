#!/bin/sh

chown facilmap:facilmap "$CACHE_DIR"

exec su facilmap -c "$@"