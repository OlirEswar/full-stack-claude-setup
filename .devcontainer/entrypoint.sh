#!/usr/bin/env bash
# Runs as root at container start (required for iptables/ipset), applies the
# egress firewall, then permanently drops to the unprivileged `node` user for
# everything else — including whatever command the container was started with.
set -euo pipefail

if [ "$(id -u)" = "0" ]; then
  dnsmasq --conf-file=/etc/dnsmasq.conf
  echo "nameserver 127.0.0.1" > /etc/resolv.conf
  /usr/local/bin/init-firewall.sh || echo "WARNING: egress firewall failed to apply — container is NOT network-locked-down" >&2
  # gosu deliberately doesn't reset env vars (HOME included) when dropping
  # privileges, and the claude-config volume's mount point was created
  # root-owned on first attach — fix both before handing off to `node`.
  mkdir -p /home/node/.claude
  chown -R node:node /home/node/.claude
  export HOME=/home/node
  exec gosu node "$@"
fi

exec "$@"
