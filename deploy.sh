#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

STEPS=2
CURRENT=0

step() {
  CURRENT=$((CURRENT + 1))
  echo ""
  echo -e "${BLUE}${BOLD}[$CURRENT/$STEPS]${RESET} ${BOLD}$1${RESET}"
}

ok() {
  echo -e "  ${GREEN}✓${RESET} $1"
}

fail() {
  echo -e "  ${RED}✗ Error: $1${RESET}"
  exit 1
}

echo -e "${BOLD}=== Deploying opentimeline ===${RESET}"
echo "Started at $(date '+%Y-%m-%d %H:%M:%S')"

step "Backing up database"
./backup.sh && ok "Backup complete" || fail "Backup failed"

step "Building and deploying app"
docker compose -f docker-compose.prod.yml up -d --build && ok "App deployed" || fail "Docker deploy failed"

echo ""
echo -e "${GREEN}${BOLD}=== All done at $(date '+%Y-%m-%d %H:%M:%S') ===${RESET}"
