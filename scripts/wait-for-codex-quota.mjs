#!/usr/bin/env node

// Wait for the next five-hour Codex quota renewal, then run one saved prompt.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import readline from 'node:readline';

const POLL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30 * 1000;
const promptArg = process.argv[2];

if (!promptArg || process.argv.length !== 3) {
  console.error('Usage: node scripts/wait-for-codex-quota.mjs <prompt-file>');
  process.exit(2);
}

const promptPath = resolve(promptArg);
const prompt = await readFile(promptPath, 'utf8');
if (!prompt.trim()) {
  throw new Error(`Prompt file is empty: ${promptPath}`);
}

const codex = process.platform === 'win32' ? 'codex.exe' : 'codex';
const home = process.env.HOME || process.env.USERPROFILE || homedir();
const codexEnv = {
  ...process.env,
  HOME: home,
  CODEX_HOME: process.env.CODEX_HOME || join(home, '.codex'),
};
let server;
let pending = new Map();
let nextId = 1;

function closeServer() {
  if (!server) return;
  server.kill();
  server = undefined;
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(new Error('Codex app-server stopped'));
  }
  pending.clear();
}

function rpc(method, params) {
  return new Promise((resolveResponse, reject) => {
    if (!server || !server.stdin.writable) {
      reject(new Error('Codex app-server is unavailable'));
      return;
    }
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve: resolveResponse, reject, timer });
    server.stdin.write(`${JSON.stringify({ id, method, params })}\n`, error => {
      if (!error) return;
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    });
  });
}

async function startServer() {
  server = spawn(codex, ['app-server', '--stdio'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    windowsHide: true,
    env: codexEnv,
  });
  const processRef = server;
  readline.createInterface({ input: processRef.stdout }).on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  processRef.on('error', error => {
    if (server === processRef) closeServer();
    console.error(`Codex app-server: ${error.message}`);
  });
  processRef.on('exit', () => {
    if (server === processRef) closeServer();
  });
  await rpc('initialize', {
    clientInfo: { name: 'quota_prompt_waiter', title: 'Quota prompt waiter', version: '1.0.0' },
  });
  processRef.stdin.write(`${JSON.stringify({ method: 'initialized' })}\n`);
}

async function readQuota() {
  if (!server) await startServer();
  const response = await rpc('account/rateLimits/read', { excludeResetCreditDetails: true });
  const limits = response.rateLimitsByLimitId?.codex ?? response.rateLimits;
  const fiveHour = limits?.primary;
  if (!fiveHour || fiveHour.windowDurationMins !== 300 || !Number.isFinite(fiveHour.resetsAt)) {
    throw new Error('Codex did not return a five-hour quota window');
  }
  return {
    usedPercent: fiveHour.usedPercent,
    resetsAt: fiveHour.resetsAt,
    allowed: response.ordinaryUsageAllowed,
  };
}

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const stamp = seconds => new Date(seconds * 1000).toLocaleString();
let baseline;
let wasBlocked = false;

process.on('SIGINT', () => { closeServer(); process.exit(130); });
process.on('SIGTERM', () => { closeServer(); process.exit(143); });

for (;;) {
  try {
    const quota = await readQuota();
    console.log(`[${new Date().toLocaleString()}] Five-hour quota: ${100 - quota.usedPercent}% remaining; resets ${stamp(quota.resetsAt)}; ordinary usage allowed: ${quota.allowed}`);

    if (baseline === undefined) baseline = quota.resetsAt;
    if (quota.usedPercent >= 100) wasBlocked = true;

    // The backend's permission is authoritative. A changed reset timestamp alone
    // is insufficient when that permission is unavailable.
    if (quota.allowed === true && quota.usedPercent < 100 &&
        (wasBlocked || (quota.resetsAt > baseline && Date.now() / 1000 >= baseline))) {
      closeServer();
      console.log(`Quota renewed. Running prompt from ${promptPath}`);
      const run = spawn(codex, [
        '--sandbox', 'workspace-write', '--ask-for-approval', 'never', '-C', process.cwd(),
        'exec', '-'
      ], { stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true, env: codexEnv });
      run.stdin.on('error', error => console.error(`Could not send prompt: ${error.message}`));
      run.stdin.end(prompt);
      const code = await new Promise((resolveExit, reject) => {
        run.once('error', reject);
        run.once('exit', code => resolveExit(code ?? 1));
      });
      process.exit(code);
    }
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] Quota check failed: ${error.message}`);
    closeServer();
  }
  await sleep(POLL_MS);
}
