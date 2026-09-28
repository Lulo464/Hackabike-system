#!/bin/bash
# Entrypoint override for the bikestation Node-RED container.
#
# The upstream nodered/node-red entrypoint execs
#   node node_modules/node-red/red.js --userDir /data
# and ignores CMD, so a CMD-based wrapper is silently skipped. Replacing
# ENTRYPOINT is the only reliable hook.
#
# /data is a bind mount from the host, so the FlowFuse dashboard cannot be
# installed during `docker build` - it would be shadowed at runtime. Install
# it here on first boot, into the real /data, where it then persists.

set -e

if [ ! -d /data/node_modules/@flowfuse/node-red-dashboard ]; then
    echo "Bikestation: installing @flowfuse/node-red-dashboard into /data ..."
    cd /data
    npm install --omit=dev @flowfuse/node-red-dashboard@1.30.2
    echo "Bikestation: dashboard installed."
else
    echo "Bikestation: dashboard already present, skipping install."
fi

cd /usr/src/node-red
exec /usr/local/bin/node $NODE_OPTIONS node_modules/node-red/red.js --userDir /data "$@"
