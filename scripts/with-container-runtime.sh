#!/usr/bin/env bash
# Ensures `sam local` can reach a container runtime, then execs the given command.
# SAM only looks at the default socket (/var/run/docker.sock) and DOCKER_HOST —
# it ignores the `docker` CLI context. Colima (and some Docker Desktop setups)
# expose the daemon elsewhere, so auto-detect it when DOCKER_HOST is unset.
# Usage: bash scripts/with-container-runtime.sh sam local start-api ...
set -euo pipefail

if [[ -z "${DOCKER_HOST:-}" && ! -S /var/run/docker.sock ]]; then
  for sock in "$HOME/.colima/default/docker.sock" "$HOME/.docker/run/docker.sock"; do
    if [[ -S "$sock" ]]; then
      export DOCKER_HOST="unix://$sock"
      break
    fi
  done
fi

exec "$@"
