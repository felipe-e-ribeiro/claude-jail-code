# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é este repositório

Infraestrutura completa para rodar o Claude Code em containers Docker isolados do Windows. Composto por três partes integradas:

1. **Imagem Docker** — `claude-code:base` (ubuntu:24.04 + Node 22 + Claude Code), com entrypoint que atualiza o Claude automaticamente a cada start
2. **Extensão VS Code** — botão `⬡ Claude Container` na status bar que cria e conecta ao container do projeto com um clique, compatível com VS Code e forks (Anti-gravity/Google)
3. **Skill local** — `claude-container` em `.claude/skills/` para gerenciar o ambiente via Claude Code

## Estrutura

```
docker/
  Dockerfile          → imagem claude-code:base (ubuntu:24.04 + Node 22 + Claude Code)
  entrypoint.sh       → atualiza Claude Code via npm a cada container start; exec claude "$@"
  docker-compose.yml  → Portainer CE (visualização, restart:always, porta 9000)
  stack-template.yml  → template manual para criar containers via Portainer

extension/
  src/
    extension.ts  → status bar "⬡ Claude Container", menu, orquestração
    container.ts  → Docker CLI wrapper: getContainerName, getStatus, create, start, stop, remove
    remote.ts     → bridge Dev Containers: attachToRunningContainer
  package.json    → extensão v0.1.0, engines vscode ^1.85.0
  tsconfig.json

.github/workflows/
  build-extension.yml → trigger: push tag v* → npm install + compile + vsce package → GitHub Release

.claude/skills/
  claude-container/SKILL.md → skill local para gerenciamento do ambiente

docs/superpowers/specs/
  2026-05-18-claude-container-design.md  → spec da infra Docker + Portainer
  2026-05-18-vscode-extension-design.md  → spec da extensão VS Code
```

## Comandos principais

### Imagem base

```powershell
docker build -t claude-code:base ./docker
docker build --no-cache -t claude-code:base ./docker   # forçar atualização
```

### Portainer

```powershell
docker-compose -f docker/docker-compose.yml up -d
docker restart portainer   # se travar no setup inicial (criar admin imediatamente em localhost:9000)
```

### Extensão VS Code

```powershell
cd extension
npm install        # uma vez
npm run compile    # TypeScript → out/
npm run package    # gera claude-container-x.x.x.vsix
```

Instalar: `Extensions → ⋯ → Install from VSIX...`

### Publicar nova versão

```powershell
git tag v0.x.0 && git push origin v0.x.0   # GitHub Actions gera e publica o .vsix
```

## Decisões de design críticas

- **Ubuntu 24.04 como base** (não node:slim): liberdade total de `apt-get install` para qualquer linguagem/ferramenta de projeto.
- **`~/.claude` como `:rw`**: Claude Code escreve em `~/.claude/projects/` para dados de sessão — `:ro` quebra. O container herda autenticação OAuth do host sem reautenticar.
- **Entrypoint sobrescrito pela extensão**: ao criar containers, usa `--entrypoint /bin/bash -c "npm install ...; tail -f /dev/null"`. O entrypoint padrão (`exec claude "$@"`) é para uso direto via terminal sem a extensão.
- **Portainer é visualização apenas**: containers criados diretamente via Docker CLI pela extensão. O Portainer enxerga os containers automaticamente mas não participa do fluxo de criação.
- **Dev Containers como bridge**: a extensão não implementa o protocolo remoto — delega ao `ms-vscode-remote.remote-containers` via `remote-containers.attachToRunningContainer`.
- **Distribuição via GitHub Releases**: `.vsix` gerado pelo Actions em cada tag `v*`. Não publicado em marketplace.
- **Naming convention**: containers nomeados `claude-<basename-da-pasta>` (lowercase, só hífens). Derivado automaticamente pelo `getContainerName()` em `container.ts`.

## Fluxo da extensão (para entender o código)

```
Clique em ⬡ Claude Container → showMenu() → openContainer()
  → getContainerName(workspacePath)          // "claude-meu-projeto"
  → container.getStatus(name)                // docker inspect
  → se não existe: container.create()        // docker run --entrypoint /bin/bash ... tail -f /dev/null
  → se parado: container.start()             // docker start
  → remote.attachToContainer(name)           // remote-containers.attachToRunningContainer
```

## Instalações dentro do container são temporárias

`apt-get install` dentro de um container em execução some ao recriar. Para dependências permanentes, adicionar no `docker/Dockerfile` e fazer rebuild.

## Próximo passo planejado

Criação de um MCP (Model Context Protocol server) — continuação desta sessão de desenvolvimento.
