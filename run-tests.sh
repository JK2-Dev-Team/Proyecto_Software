#!/usr/bin/env bash
# Atajo para correr las pruebas del backend por nivel.
# Uso: ./run-tests.sh [unit|integration|cov|all]
set -e
cd "$(dirname "$0")/backend"
[ -d node_modules ] || npm install
case "${1:-all}" in
  unit) npm run test:unit ;;
  integration) npm run test:integration ;;
  cov) npm run test:cov ;;
  all) npm test ;;
  *) echo "Nivel desconocido: $1. Usa unit, integration, cov o all."; exit 1 ;;
esac
