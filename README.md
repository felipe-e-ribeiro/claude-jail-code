# claude-jail

Script Python cross-platform para rodar o Claude Code em containers Docker isolados. Um único comando transforma qualquer diretório numa sessão isolada do Claude, sem estado residual.

---

## Requisitos

- Python 3.8+
- Docker Desktop (Linux, Mac ou Windows)

---

## Uso

```bash
# Sessão interativa no diretório atual
python claude-jail.py

# Pular atualização do Claude Code ao subir o container
python claude-jail.py --no-update

# Rodar sem prompts de permissão
python claude-jail.py --dangerously-skip-permissions

# Passar argumentos direto ao Claude
python claude-jail.py -- --model claude-opus-4-7

# Usar uma versão específica da imagem
python claude-jail.py --image feliperibeiro95/claude-jail-code:v0.1.0
```

O container monta automaticamente:
- `~/.claude` → `/root/.claude` (credenciais OAuth e sessões)
- Diretório atual → `/workspace` (seu projeto)

O container é removido automaticamente ao sair (`--rm`).

---

## Imagem Docker

A imagem base é publicada no Docker Hub: `feliperibeiro95/claude-jail-code`

Para build local:

```bash
docker build -t claude-code:base ./docker
```

---

## Desenvolvimento

### Rodar os testes

```bash
pip install pytest
pytest tests/ -v
```

### Publicar nova versão

```bash
git tag v0.x.0
git push origin v0.x.0
```

O GitHub Actions executa: pytest → docker build/push → Trivy scan → GitHub Release com `claude-jail.py` em anexo.

---

## Compatibilidade

| Plataforma | Suportado |
|---|---|
| Linux | ✓ |
| macOS | ✓ |
| Windows (PowerShell/CMD) | ✓ |
| WSL | ✓ |
