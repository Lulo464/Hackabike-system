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
# it (and the other extra nodes) here on first boot, into the real /data,
# where they then persist.

set -e

# Checked per package, so adding one here also installs it on a Pi whose
# /data already has the others.
install_if_missing() {
    if [ ! -d "/data/node_modules/$1" ]; then
        echo "Bikestation: installing $1@$2 into /data ..."
        (cd /data && npm install --omit=dev "$1@$2")
    else
        echo "Bikestation: $1 already present, skipping install."
    fi
}

install_if_missing @flowfuse/node-red-dashboard 1.30.2
install_if_missing node-red-contrib-postgresql 0.16.2

cd /usr/src/node-red
exec /usr/local/bin/node $NODE_OPTIONS node_modules/node-red/red.js --userDir /data "$@"
