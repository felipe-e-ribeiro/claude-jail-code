import * as vscode from 'vscode';
import * as container from './container';
import * as remote from './remote';

export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = '⬡ Claude Container';
  statusBar.tooltip = 'Gerenciar Claude Container';
  statusBar.command = 'claude-container.menu';
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-container.menu', showMenu),
    vscode.commands.registerCommand('claude-container.open', openContainer),
    vscode.commands.registerCommand('claude-container.stop', stopContainer),
    vscode.commands.registerCommand('claude-container.recreate', recreateContainer),
  );
}

async function getWorkspacePath(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('Nenhuma pasta aberta no editor.');
    return undefined;
  }
  return folders[0].uri.fsPath;
}

function getImageOverride(): string | undefined {
  return vscode.workspace.getConfiguration('claudeContainer').get<string>('image');
}

async function showMenu(): Promise<void> {
  const items = [
    { label: '▶  Abrir no Claude Container', command: 'claude-container.open' },
    { label: '■  Parar container',            command: 'claude-container.stop' },
    { label: '⟳  Recriar container',          command: 'claude-container.recreate' },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Claude Container — escolha uma ação',
  });

  if (selected) {
    vscode.commands.executeCommand(selected.command);
  }
}

async function openContainer(): Promise<void> {
  const workspacePath = await getWorkspacePath();
  if (!workspacePath) { return; }

  const name = container.getContainerName(workspacePath);

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Claude Container: ${name}`, cancellable: false },
    async (progress) => {
      try {
        const status = container.getStatus(name);

        if (!status.exists) {
          progress.report({ message: 'Resolvendo imagem...' });
          const image = await container.resolveImage(getImageOverride());
          progress.report({ message: 'Criando container...' });
          container.create(name, workspacePath, image);
        } else if (!status.running) {
          progress.report({ message: 'Iniciando container...' });
          container.start(name);
        }

        progress.report({ message: 'Conectando...' });
        await remote.attachToContainer(name);
      } catch (err: any) {
        handleError(err);
      }
    }
  );
}

async function stopContainer(): Promise<void> {
  const workspacePath = await getWorkspacePath();
  if (!workspacePath) { return; }

  const name = container.getContainerName(workspacePath);
  try {
    container.stop(name);
    vscode.window.showInformationMessage(`Container ${name} parado.`);
  } catch (err: any) {
    handleError(err);
  }
}

async function recreateContainer(): Promise<void> {
  const workspacePath = await getWorkspacePath();
  if (!workspacePath) { return; }

  const name = container.getContainerName(workspacePath);
  const confirm = await vscode.window.showWarningMessage(
    `Recriar o container ${name}? O container atual será removido.`,
    'Recriar', 'Cancelar'
  );
  if (confirm !== 'Recriar') { return; }

  try {
    container.remove(name);
    const image = await container.resolveImage(getImageOverride());
    container.create(name, workspacePath, image);
    vscode.window.showInformationMessage(`Container ${name} recriado com sucesso.`);
  } catch (err: any) {
    handleError(err);
  }
}

function handleError(err: any): void {
  const msg: string = (err?.message ?? String(err));

  if (msg.includes('error during connect') || msg.includes('Cannot connect') || msg.includes('daemon')) {
    vscode.window.showErrorMessage('Docker Desktop não está rodando. Inicie-o e tente novamente.');
  } else if (msg.includes('Unable to find image') || msg.includes('No such image') || msg.includes('pull access denied')) {
    vscode.window.showErrorMessage(
      'Imagem Docker não encontrada. Verifique a configuração claudeContainer.image ou aguarde o próximo release.',
      'Abrir configurações'
    ).then(action => {
      if (action === 'Abrir configurações') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'claudeContainer.image');
      }
    });
  } else if (msg.includes('Dev Containers extension not installed')) {
    vscode.window.showErrorMessage(
      'Extensão Dev Containers não instalada.',
      'Instalar'
    ).then(action => {
      if (action === 'Instalar') {
        vscode.commands.executeCommand('workbench.extensions.search', 'ms-vscode-remote.remote-containers');
      }
    });
  } else {
    vscode.window.showErrorMessage(`Claude Container: ${msg}`);
  }
}

export function deactivate() {}
