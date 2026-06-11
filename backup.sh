#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
DEPLOY_FILE="opentimeline-deploy-${TIMESTAMP}.sql.gz"
KEEP=20

echo -e "${BLUE}${BOLD}Running database backup...${RESET}"

docker compose -f docker-compose.prod.yml exec -T postgres-backup bash -c "
  mkdir -p /backups/deployments &&
  PGPASSWORD=\$POSTGRES_PASSWORD pg_dump -h postgres -U \$POSTGRES_USER \$POSTGRES_DB | gzip > /backups/deployments/${DEPLOY_FILE} &&
  ls -t /backups/deployments/opentimeline-deploy-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
" && echo -e "  ${GREEN}✓${RESET} Backup complete at $(date '+%Y-%m-%d %H:%M:%S') → deployments/${DEPLOY_FILE}" \
  || { echo -e "  ${RED}✗ Backup failed${RESET}"; exit 1; }
