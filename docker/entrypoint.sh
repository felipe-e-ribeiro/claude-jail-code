#!/bin/bash
echo "[entrypoint] Verificando atualizações do Claude Code..."
npm install -g @anthropic-ai/claude-code@latest --silent 2>/dev/null \
    || echo "[entrypoint] Sem atualização disponível, usando versão instalada."

exec claude "$@"
