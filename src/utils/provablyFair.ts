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

// Stake-style path derivation: an HMAC-SHA256 byte stream keyed by the server
// seed over "clientSeed:nonce" (extended with a cursor when more than 32 bytes
// are needed). One byte per row — byte < 128 → left (0), else right (1).
// Landing slot = number of rights.
export async function getPath(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number
): Promise<number[]> {
  const dirs: number[] = [];
  let cursor = 0;
  let block: Uint8Array = await hmacSha256(serverSeed, `${clientSeed}:${nonce}:${cursor}`);
  let offset = 0;
  for (let i = 0; i < rows; i++) {
    if (offset >= block.length) {
      cursor += 1;
      block = await hmacSha256(serverSeed, `${clientSeed}:${nonce}:${cursor}`);
      offset = 0;
    }
    dirs.push(block[offset] < 128 ? 0 : 1);
    offset += 1;
  }
  return dirs;
}
