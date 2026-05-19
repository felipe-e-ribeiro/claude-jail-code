import { execFileSync, execSync } from 'child_process';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';

const FALLBACK_IMAGE = 'feliperibeiro95/claude-jail-code:v0.0.1';
const VERSIONS_URL = 'https://raw.githubusercontent.com/felipe-e-ribeiro/claude-jail-code/main/versions.json';

let cachedImage: string | undefined;

export interface ContainerStatus {
  exists: boolean;
  running: boolean;
}

export function getContainerName(workspacePath: string): string {
  return `claude-${path.basename(workspacePath).toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

export async function resolveImage(override?: string): Promise<string> {
  const configured = (override || '').trim();
  if (configured) {
    return configured;
  }
  if (cachedImage) {
    return cachedImage;
  }
  try {
    const image = await fetchImage();
    cachedImage = image;
    return image;
  } catch {
    return FALLBACK_IMAGE;
  }
}

function fetchImage(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(VERSIONS_URL, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.image && json.image.trim()) { resolve(json.image.trim()); }
          else { reject(new Error('No image field in versions.json')); }
        } catch {
          reject(new Error('Invalid JSON from versions.json'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout fetching versions.json')); });
  });
}

export function getStatus(name: string): ContainerStatus {
  try {
    const result = execSync(`docker inspect --format "{{.State.Running}}" ${name}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { exists: true, running: result === 'true' };
  } catch {
    return { exists: false, running: false };
  }
}

export function create(name: string, workspacePath: string, image: string): void {
  if (!image || !image.trim()) {
    throw new Error('Nome da imagem Docker não resolvido. Configure claudeContainer.image nas Settings.');
  }

  const claudePath = path.join(os.homedir(), '.claude');

  execFileSync('docker', [
    'run', '-d',
    '--name', name,
    '--entrypoint', '/bin/bash',
    '-v', `${workspacePath}:/workspace`,
    '-v', `${claudePath}:/root/.claude`,
    '-w', '/workspace',
    image,
    '-c', 'npm install -g @anthropic-ai/claude-code@latest --silent 2>/dev/null; tail -f /dev/null',
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
}

export function start(name: string): void {
  execFileSync('docker', ['start', name], { stdio: ['pipe', 'pipe', 'pipe'] });
}

export function stop(name: string): void {
  execFileSync('docker', ['stop', name], { stdio: ['pipe', 'pipe', 'pipe'] });
}

export function remove(name: string): void {
  execFileSync('docker', ['rm', '-f', name], { stdio: ['pipe', 'pipe', 'pipe'] });
}
