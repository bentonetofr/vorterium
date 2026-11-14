#!/bin/sh
# Roda DENTRO do Docker (chamado pelo restaurar-no-novo.ps1). Nao execute direto.
# Variaveis: CONN (string do projeto novo), PARTIR (migration de onde continuar, opcional), ARQ (arquivo .sql em /bk)
# Uso: restaurar-no-novo.sh mig | extras | dados | auth

case "$1" in
  mig)
    comecou=0
    [ -z "$PARTIR" ] && comecou=1
    for f in /mig/*.sql; do
      nome=$(basename "$f")
      if [ "$comecou" = 0 ]; then
        if [ "$nome" = "$PARTIR" ]; then comecou=1; else continue; fi
      fi
      echo "  $nome"
      if ! psql "$CONN" -q -v ON_ERROR_STOP=1 -1 -f "$f"; then
        echo "PAROU EM: $nome"
        exit 1
      fi
    done
    ;;
  extras)
    # ajustes do esquema + Caatedrum (jogo guardado, mas o banco antigo tinha as tabelas)
    for f in /app/ajustes-esquema.sql /caat/20240177000000_caatedrum.sql /caat/20240178000000_caatedrum_conteudo.sql; do
      echo "  $(basename "$f")"
      psql "$CONN" -q -v ON_ERROR_STOP=1 -1 -f "$f" || { echo "PAROU EM: $f"; exit 1; }
    done
    ;;
  dados)
    # as migrations ja semeiam estas 3 tabelas; o dump traz a versao real delas, entao limpa antes (mesma transacao)
    psql "$CONN" -q -1 -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" \
      -c "TRUNCATE public.dnd_rule_catalog_entries, public.site_feature_access, public.site_features;" \
      -f "/bk/$ARQ" || exit 1
    ;;
  auth)
    psql "$CONN" -q -1 -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f "/bk/$ARQ" || exit 1
    ;;
  *)
    echo "modo desconhecido: $1"
    exit 2
    ;;
esac
