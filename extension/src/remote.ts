import * as vscode from 'vscode';

export async function attachToContainer(name: string): Promise<void> {
  const devContainersExt = vscode.extensions.getExtension('ms-vscode-remote.remote-containers');
  if (!devContainersExt) {
    throw new Error('Dev Containers extension not installed');
  }

  await vscode.commands.executeCommand('remote-containers.attachToRunningContainer', name);
}
