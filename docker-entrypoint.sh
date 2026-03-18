#!/bin/sh
set -e
mkdir -p /paperclip/instances/default/logs
chown -R node:node /paperclip
exec gosu node "$@"
