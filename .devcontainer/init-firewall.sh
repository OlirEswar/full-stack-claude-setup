#!/usr/bin/env bash
# Default-deny egress firewall for the dev container.
#
# Only traffic to the domains below, the compose-internal network (so the app
# can reach the `db` service), and loopback is allowed outbound. Loopback also
# covers Docker's embedded DNS proxy at 127.0.0.11, so normal name resolution
# (including the `db` service name) keeps working without any extra rule —
# that resolution hops out via the Docker daemon, not through this container's
# own network namespace, so it's unaffected by the DROP policy below.
#
# CDN-backed domains (github.com, npm, pypi) rotate IPs. If something that
# used to work starts failing with a connection timeout, re-run this script
# (`sudo /usr/local/bin/init-firewall.sh`) to re-resolve and refresh the set.
set -euo pipefail

ALLOWED_DOMAINS=(
  github.com
  api.github.com
  codeload.github.com
  raw.githubusercontent.com
  objects.githubusercontent.com
  registry.npmjs.org
  pypi.org
  files.pythonhosted.org
  api.anthropic.com
  statsig.anthropic.com
)

ipset destroy allowed-egress 2>/dev/null || true
ipset create allowed-egress hash:net

for domain in "${ALLOWED_DOMAINS[@]}"; do
  for ip in $(getent ahostsv4 "$domain" 2>/dev/null | awk '{print $1}' | sort -u); do
    ipset add allowed-egress "$ip" 2>/dev/null || true
  done
done

# Allow the compose bridge subnet (the `db` service lives here).
default_if=$(ip route | awk '/default/ {print $5; exit}')
if [ -n "${default_if:-}" ]; then
  subnet=$(ip -o -f inet addr show "$default_if" | awk '{print $4}')
  [ -n "$subnet" ] && ipset add allowed-egress "$subnet" 2>/dev/null || true
fi

iptables -F OUTPUT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-egress dst -j ACCEPT
iptables -P OUTPUT DROP

echo "Egress firewall active. Allowed: ${ALLOWED_DOMAINS[*]} + compose network + loopback."
