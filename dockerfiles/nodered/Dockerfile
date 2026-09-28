FROM nodered/node-red:latest

# NOTE: do NOT set WORKDIR. The base image's ENTRYPOINT is "./entrypoint.sh",
# resolved relative to WORKDIR (/usr/src/node-red), so changing it breaks start.
#
# We replace ENTRYPOINT (not CMD): the upstream entrypoint execs red.js itself
# and ignores CMD, so a CMD-based wrapper is silently skipped. Our entrypoint
# additionally installs the FlowFuse dashboard into the bind-mounted /data on
# first boot, since a build-time install would be shadowed at runtime.
#
# COPY --chmod=755 needs no RUN, so we stay in the image's default root context;
# the base image drops to node-red later, where chmod fails.
COPY --chmod=755 dockerfiles/nodered/start.sh /usr/src/node-red/entrypoint.sh

EXPOSE 1880
