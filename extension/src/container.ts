import { execSync } from 'child_process';
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
  if (override && override.trim()) {
    return override.trim();
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
          if (json.image) { resolve(json.image); }
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
  const claudePath = path.join(os.homedir(), '.claude');
  const wsPath = workspacePath.replace(/\\/g, '/');
  const clPath = claudePath.replace(/\\/g, '/');

  run(
    `docker run -d --name ${name}` +
    ` --entrypoint /bin/bash` +
    ` -v "${wsPath}:/workspace"` +
    ` -v "${clPath}:/root/.claude"` +
    ` -w /workspace` +
    ` ${image}` +
    ` -c "npm install -g @anthropic-ai/claude-code@latest --silent 2>/dev/null; tail -f /dev/null"`
  );
}

export function start(name: string): void {
  run(`docker start ${name}`);
}

export function stop(name: string): void {
  run(`docker stop ${name}`);
}

export function remove(name: string): void {
  run(`docker rm -f ${name}`);
}

function run(cmd: string): void {
  try {
    execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (e: any) {
    throw new Error(e.stderr || e.stdout || e.message);
  }
}
