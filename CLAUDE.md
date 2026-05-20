# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este repositório

Script Python cross-platform para rodar o Claude Code em containers Docker isolados. Qualquer diretório pode ser "jailed" com um único comando, montando `~/.claude` e o diretório atual no container.

## Estrutura

```
claude-jail.py           → script principal (Linux, Mac, Windows, WSL)
tests/
  test_claude_jail.py    → testes pytest
docker/
  Dockerfile             → imagem claude-code:base (ubuntu:24.04 + Node 22 + Claude Code)
  entrypoint.sh          → atualiza Claude Code a cada start; aceita --no-update
  .trivyignore           → CVEs aceitas no scan Trivy
.github/workflows/
  ci.yml                 → pytest em push para main/dev e PRs
  release.yml            → on tag v*: pytest → docker build/push → Trivy scan → GitHub Release
versions.json            → versão atual da imagem publicada
```

## Uso

```bash
# Sessão interativa no diretório atual
python claude-jail.py

# Pular atualização do Claude Code (mais rápido)
python claude-jail.py --no-update

# Sem prompts de permissão
python claude-jail.py --dangerously-skip-permissions

# Passar argumentos direto ao Claude
python claude-jail.py -- --model claude-opus-4-7

# Usar imagem específica
python claude-jail.py --image feliperibeiro95/claude-jail-code:v0.1.0
```

## Docker

### Build local

```bash
docker build -t claude-code:base ./docker
docker build --no-cache -t claude-code:base ./docker   # forçar atualização
```

### O que o container monta

- `~/.claude` → `/root/.claude:rw` — autenticação OAuth, sessões, configuração
- `$PWD` → `/workspace:rw` — diretório atual do projeto

## Publicar nova versão

Usar a skill `release` ou criar a tag manualmente:

```bash
git tag v0.x.0 && git push origin v0.x.0
```

O GitHub Actions executa automaticamente: pytest → docker build/push → Trivy scan → GitHub Release com `claude-jail.py` em anexo.

## Decisões de design

- **`--rm` sempre**: container descartado ao sair — sem estado residual, verdadeiro jailing
- **`~/.claude` como `:rw`**: Claude Code escreve em `~/.claude/projects/` para dados de sessão — `:ro` quebra
- **Cross-platform**: `Path.home()` e `Path.cwd()` nativos; Windows paths convertidos para formato Docker via `PureWindowsPath` (`/c/Users/...`)
- **TTY automático**: `-it` quando `stdin.isatty()` é True, `-i` em pipelines/CI
- **`--no-update` interceptado pelo entrypoint**: não é repassado ao Claude; todos os outros args são passados diretamente
