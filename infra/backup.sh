#!/bin/sh
# Sauvegarde quotidienne de la base.
#
# À planifier sur l'hôte :
#   0 3 * * * /chemin/vers/infra/backup.sh >> /var/log/barabite-backup.log 2>&1
#
# Une sauvegarde jamais restaurée n'est pas une sauvegarde : testez la restauration une fois par
# trimestre, sur une base jetable.

set -eu

COMPOSE_FILE="$(dirname "$0")/docker-compose.prod.yml"
ENV_FILE="$(dirname "$0")/.env.prod"
STAMP="$(date +%Y-%m-%d_%H%M)"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# shellcheck disable=SC1090
. "$ENV_FILE"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$(dirname "$0")/backups/barabite_${STAMP}.dump"

# Purge des sauvegardes trop anciennes, pour ne pas saturer le disque du VPS.
find "$(dirname "$0")/backups" -name 'barabite_*.dump' -mtime "+${RETENTION_DAYS}" -delete

echo "Sauvegarde terminée : barabite_${STAMP}.dump"
