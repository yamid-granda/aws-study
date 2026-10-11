#!/usr/bin/env bash
# Run the k6 performance suite against LocalStack (full AWS emulator).
# Self-booting: ensures the emulator is up (reuse-or-start, same contract
# as localstack-dev.sh) and deploys the stack when no REST API is found
# (a container restart wipes the deployment), then delegates to
# scripts/perf-suite.sh (which skips SAM boot for non-local BASE_URL and
# runs straight at it). LocalStack is left running afterwards.
#
# Usage:
#   npm run tests:perf:stack
#   PERF_TESTS="tests/performance/products/create-products-load-test.ts" npm run tests:perf:stack
#
# Env:
#   PERF_TESTS (forwarded to scripts/perf-suite.sh; default all *-load-test.ts)
#   K6_IMAGE   (forwarded to scripts/k6-docker.sh)
#   LOCALSTACK_URL (default http://localhost:4566; forwarded to localstack-*.sh)
set -euo pipefail

LOCALSTACK_URL="${LOCALSTACK_URL:-http://localhost:4566}"
export LOCALSTACK_URL

# 0. Docker must answer. If the daemon is down, boot the runtime automatically:
# colima first (this repo's default), Docker Desktop on macOS as fallback.
ensure_docker() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  # Colima runtime with an unset DOCKER_HOST: point at its default socket.
  if [[ -z "${DOCKER_HOST:-}" && -S "$HOME/.colima/default/docker.sock" ]]; then
    export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
    if docker info >/dev/null 2>&1; then
      return 0
    fi
  fi
  echo "Docker daemon is not reachable — starting it ..."
  if command -v colima >/dev/null 2>&1; then
    if colima status >/dev/null 2>&1; then
      echo "Colima is up but dockerd is not answering — restarting colima ..."
      colima restart
    else
      colima start
    fi
  elif [[ "$(uname -s)" == "Darwin" && -d "/Applications/Docker.app" ]]; then
    open -a Docker
  else
    echo "ERROR: Docker daemon is not reachable and no supported runtime found." >&2
    echo "Install colima (brew install colima docker) or start Docker Desktop, then re-run." >&2
    exit 1
  fi
  echo "Waiting for the Docker daemon (up to 180s) ..."
  for i in $(seq 1 90); do
    if docker info >/dev/null 2>&1; then
      echo "Docker daemon is up."
      return 0
    fi
    if [[ "$i" -eq 90 ]]; then
      echo "ERROR: Docker daemon did not come up in 180s." >&2
      exit 1
    fi
    sleep 2
  done
}

ensure_docker

# 1. Emulator up? Reuse it running, start it stopped, create it when missing.
CONTAINER_NAME="aws-study-localstack"
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo "missing")" = "true" ]; then
  echo "LocalStack already running ($CONTAINER_NAME) — reusing it."
elif docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "LocalStack container exists but is stopped — starting it ..."
  docker start "$CONTAINER_NAME" >/dev/null
else
  echo "Starting LocalStack emulator ..."
  # `docker-compose up` fails with a name conflict when the shared
  # container was created by another checkout — reuse it instead (fast path).
  if ! docker-compose up -d localstack; then
    echo "Compose up failed, reusing existing aws-study-localstack container ..."
    docker start aws-study-localstack >/dev/null 2>&1 || true
  fi
fi

bash scripts/localstack-wait.sh

# 2. Stack deployed? Redeploy when no REST API answers.
if ! BASE_URL="$(bash scripts/localstack-url.sh 2>/dev/null)"; then
  echo "No REST API in LocalStack — deploying stack ..."
  bash scripts/localstack-deploy.sh
  BASE_URL="$(bash scripts/localstack-url.sh)"
fi
export BASE_URL

echo "Targeting LocalStack API at $BASE_URL"
exec bash scripts/perf-suite.sh
