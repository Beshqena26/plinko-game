export async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

// Stake's exact byte stream: HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}:${round}`),
// 32 bytes per round, round increments as bytes are consumed.
async function bytes(serverSeed: string, clientSeed: string, nonce: number, count: number): Promise<number[]> {
  const out: number[] = [];
  let round = 0;
  while (out.length < count) {
    const block = await hmacSha256(serverSeed, `${clientSeed}:${nonce}:${round}`);
    for (let i = 0; i < block.length && out.length < count; i++) out.push(block[i]);
    round += 1;
  }
  return out;
}

// Stake's bytes→float: 4 bytes per float, f = b0/256 + b1/256² + b2/256³ + b3/256⁴ ∈ [0,1).
function toFloats(b: number[]): number[] {
  const floats: number[] = [];
  for (let i = 0; i + 3 < b.length; i += 4) {
    floats.push(b[i] / 256 + b[i + 1] / 256 ** 2 + b[i + 2] / 256 ** 3 + b[i + 3] / 256 ** 4);
  }
  return floats;
}

// Plinko path — one float per row; direction = floor(float × 2): 0 = LEFT, 1 = RIGHT.
// Landing slot = number of RIGHTs. Identical to Stake's public verifier, so any
// third-party Stake verifier reproduces our outcomes from the same seeds.
export async function getPath(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number
): Promise<number[]> {
  const b = await bytes(serverSeed, clientSeed, nonce, rows * 4);
  return toFloats(b).map(f => Math.floor(f * 2));
}
