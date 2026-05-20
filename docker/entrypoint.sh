#!/bin/bash
set -e

NO_UPDATE=false
PASSTHROUGH=()

for arg in "$@"; do
    if [ "$arg" = "--no-update" ]; then
        NO_UPDATE=true
    else
        PASSTHROUGH+=("$arg")
    fi
done

if [ "$NO_UPDATE" = false ]; then
    echo "[entrypoint] Verificando atualizações do Claude Code..."
    npm install -g @anthropic-ai/claude-code@latest --silent 2>/dev/null \
        || echo "[entrypoint] Sem atualização disponível, usando versão instalada."
fi

exec claude "${PASSTHROUGH[@]}"
