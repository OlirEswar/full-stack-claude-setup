FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Network tools for the egress firewall, Postgres client, Python for
# scripting/tooling, gosu to drop root -> node after firewall setup.
RUN apt-get update && apt-get install -y --no-install-recommends \
      iptables ipset dnsutils curl ca-certificates gnupg dnsmasq \
      postgresql-client python3 python3-pip python3-venv gosu \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# The base image grants the `node` user passwordless sudo by default. That
# would let the agent process re-run iptables/ipset itself and disable the
# firewall the entrypoint just set up, so remove it.
RUN rm -f /etc/sudoers.d/node

RUN npm install -g @anthropic-ai/claude-code pnpm

# Optional, for browser-driven e2e tests (Playwright). Commented out by
# default to keep the image lean — uncomment if the app needs it.
# RUN npx -y playwright install --with-deps chromium

COPY init-firewall.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-firewall.sh /usr/local/bin/entrypoint.sh

COPY dnsmasq.conf /etc/dnsmasq.conf
# World-readable so the unprivileged `node` user can tail it without sudo.
RUN mkdir -p /var/log && touch /var/log/dns-queries.log && chmod 644 /var/log/dns-queries.log

# Container must start as root so the entrypoint can apply the firewall;
# it execs into the unprivileged `node` user immediately after.
USER root
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["sleep", "infinity"]
