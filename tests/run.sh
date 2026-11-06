#!/usr/bin/env bash
# =====================================================================
#  Lance les tests de sécurité de la base sur un Postgres de test.
#  Utilisé par GitHub Actions à chaque envoi, et possible en local.
#
#  Variables (facultatives) : PGHOST, PGPORT, PGUSER, PGPASSWORD
#  Le script crée une base jetable « yachad_test » et la supprime à la fin.
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

DB=yachad_test
psql -q -d postgres -c "drop database if exists $DB" >/dev/null
psql -q -d postgres -c "create database $DB" >/dev/null

OUT=$(mktemp)
{
  psql -q -v ON_ERROR_STOP=1 -d $DB -f tests/supabase_stubs.sql
  psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/schema.sql
  psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/migrations/002_ameliorations.sql
  psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/migrations/002_ameliorations.sql   # relancée : doit rester sans erreur
  psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase/migrations/003_service_role.sql
  psql -v ON_ERROR_STOP=1 -d $DB -f tests/securite.sql
} >"$OUT" 2>&1 || { cat "$OUT"; echo "Le chargement du schéma ou des tests a échoué."; exit 1; }

grep -E "(NOTICE|WARNING):  (PASS|FAIL)|^== " "$OUT" | sed -E 's/^.*(NOTICE|WARNING):  //' || true

PASS=$(grep -c "PASS |" "$OUT" || true)
FAIL=$(grep -c "FAIL |" "$OUT" || true)
psql -q -d postgres -c "drop database if exists $DB" >/dev/null
echo
echo "Résultat : $PASS réussis, $FAIL échoués"
[ "$FAIL" -eq 0 ] && [ "$PASS" -gt 0 ]
