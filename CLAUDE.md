# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este repositório

Script Python cross-platform (`claude-jail.py`) que roda o Claude Code em containers Docker isolados. Um único comando transforma qualquer diretório numa sessão jailed do Claude, sem estado residual entre execuções.

## Comandos principais

### Rodar testes

```bash
python3 -m pytest tests/ -v          # todos os testes
python3 -m pytest tests/ -v -k "wsl" # filtrar por nome
```

Não há dependências externas além do `pytest`. A suite usa apenas stdlib + mocks.

### Build da imagem Docker

```bash
docker build -t claude-code:base ./docker
docker build --no-cache -t claude-code:base ./docker   # forçar atualização
```

### Usar o script

```bash
python3 claude-jail.py                              # sessão interativa
python3 claude-jail.py --no-update                  # pula npm install no entrypoint
python3 claude-jail.py --dangerously-skip-permissions
python3 claude-jail.py -- --model claude-opus-4-7   # args passados ao Claude
python3 claude-jail.py --image myrepo/img:v1.0      # imagem alternativa
```

## Arquitetura

### `claude-jail.py`

Três funções públicas, testáveis individualmente:

- `is_wsl()` — detecta WSL via `/proc/version`
- `to_docker_path(path)` — converte paths: no-op em Linux/Mac, `C:\...` → `/c/...` no Windows usando `PureWindowsPath` (funciona cross-platform nos testes)
- `build_docker_cmd(...)` — monta a lista de argumentos para `docker run`

`main(argv=None)` aceita `argv` explícito para facilitar testes sem mockar `sys.argv`.

O container sempre roda com `--rm` (descartado ao sair) e monta:
- `~/.claude` → `/root/.claude:rw` (OAuth, sessões)
- `$PWD` → `/workspace:rw` (projeto)

TTY: `-it` quando `stdin.isatty()` é True, `-i` caso contrário (CI/pipeline).

### `docker/entrypoint.sh`

Intercepta `--no-update` antes de repassar os demais args ao `claude`. Qualquer outro flag (incluindo `--dangerously-skip-permissions`) vai direto ao Claude sem tratamento especial no entrypoint.

### Testes (`tests/test_claude_jail.py`)

O arquivo usa `importlib.util` para importar `claude-jail.py` (hífen no nome impede import direto). Todos os testes de `to_docker_path` para Windows passam strings brutas — não `pathlib.Path` — pois `PureWindowsPath` parseia strings corretamente em qualquer plataforma.

### CI/CD

- **`ci.yml`** — só em `pull_request` para `main` (evita duplo disparo em push + PR aberto)
- **`release.yml`** — em tag `v*`: pytest → docker build/push → Trivy scan (bloqueia em HIGH/CRITICAL) → atualiza `versions.json` → GitHub Release com `claude-jail.py` em anexo

### `versions.json`

Atualizado automaticamente pelo pipeline de release. Registra a imagem publicada mais recente: `{"image": "feliperibeiro95/claude-jail-code:vX.Y.Z"}`.

## Publicar nova versão

Usar a skill `release` (cuida de commit, push e PR) ou:

```bash
git tag v0.x.0 && git push origin v0.x.0
```

O merge em `main` + criação da tag disparam o pipeline completo.
