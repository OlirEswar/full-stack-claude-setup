#!/usr/bin/env bash
# Runs as root at container start (required for iptables/ipset), applies the
# egress firewall, then permanently drops to the unprivileged `node` user for
# everything else — including whatever command the container was started with.
set -euo pipefail

if [ "$(id -u)" = "0" ]; then
  dnsmasq --conf-file=/etc/dnsmasq.conf
  echo "nameserver 127.0.0.1" > /etc/resolv.conf
  /usr/local/bin/init-firewall.sh || echo "WARNING: egress firewall failed to apply — container is NOT network-locked-down" >&2
  exec gosu node "$@"
fi

exec "$@"
