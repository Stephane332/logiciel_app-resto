#!/bin/sh
# Sauvegarde quotidienne : la base **et** les photos.
#
# Sauvegarder la base seule serait un piège. Elle ne contient que les adresses des images, pas les
# images : une restauration rendrait un catalogue entier de plats sans photo, et le travail de
# photographie du restaurant serait perdu sans que la sauvegarde ait jamais signalé un problème.
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

# Photos du catalogue, prises depuis le volume monté dans le conteneur d'API.
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T api \
  tar -cf - -C /data uploads \
  | gzip > "$(dirname "$0")/backups/photos_${STAMP}.tar.gz"

# Purge des sauvegardes trop anciennes, pour ne pas saturer le disque du VPS.
find "$(dirname "$0")/backups" -name 'barabite_*.dump' -mtime "+${RETENTION_DAYS}" -delete
find "$(dirname "$0")/backups" -name 'photos_*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "Sauvegarde terminée : barabite_${STAMP}.dump + photos_${STAMP}.tar.gz"
