# Claude Container

Ambiente para rodar o Claude Code em containers Docker isolados, um por projeto. Inclui uma extensão para VS Code e forks compatíveis (Anti-gravity, etc.) que cria e conecta ao container com um clique.

---

## Estrutura

```
claude-container/
├── docker/
│   ├── Dockerfile           ← imagem claude-code:base (ubuntu:24.04 + Node 22 + Claude Code)
│   ├── entrypoint.sh        ← atualiza Claude Code a cada container start
│   ├── docker-compose.yml   ← Portainer CE para visualização (localhost:9000)
│   └── stack-template.yml   ← template manual para criar containers via Portainer
├── extension/
│   └── src/
│       ├── extension.ts     ← status bar, menu, orquestração
│       ├── container.ts     ← wrapper Docker CLI
│       └── remote.ts        ← bridge Dev Containers API
├── .github/workflows/
│   └── build-extension.yml  ← gera .vsix em cada release
└── LICENSE
```

---

## Setup inicial

### 1. Docker Desktop

Settings → General → marque **"Start Docker Desktop when you log in"**.

### 2. Build da imagem base

```powershell
docker build -t claude-code:base ./docker
```

### 3. Portainer (opcional — só para visualização)

```powershell
docker-compose -f docker/docker-compose.yml up -d
```

Acesse `localhost:9000` e crie o usuário admin imediatamente (timeout de segurança).
> Se travar: `docker restart portainer`

---

## Extensão

### Instalar

1. Baixe o `.vsix` mais recente em [Releases](../../releases)
2. No editor: `Extensions → ⋯ → Install from VSIX...`

### Usar

Clique em **⬡ Claude Container** na status bar (canto inferior esquerdo) e escolha:

- **▶ Abrir no Claude Container** — cria o container se necessário e conecta via Dev Containers
- **■ Parar container** — para o container do projeto atual
- **⟳ Recriar container** — remove e recria (útil após mudar a imagem base)

O container é nomeado `claude-<nome-da-pasta>` e monta automaticamente:
- A pasta aberta no editor → `/workspace`
- `~/.claude` do Windows → `/root/.clone` (credenciais e sessões)

### Pré-requisitos da extensão

- Docker Desktop rodando
- Imagem `claude-code:base` buildada
- Extensão **Dev Containers** (`ms-vscode-remote.remote-containers`) instalada

---

## Publicar uma nova versão da extensão

```powershell
git tag v0.2.0
git push origin v0.2.0
```

O GitHub Actions compila e publica o `.vsix` automaticamente na Release.

---

## Atualizar a imagem base

```powershell
# Rebuild com a versão mais recente do Claude Code
docker build --no-cache -t claude-code:base ./docker

# Recriar containers existentes via extensão: ⬡ → Recriar container
```
