export async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export async function getPath(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number
): Promise<number[]> {
  const hash = await sha256(`${serverSeed}:${clientSeed}:${nonce}`);
  const dirs: number[] = [];
  for (let i = 0; i < rows; i++) {
    dirs.push(parseInt(hash[i % hash.length], 16) < 8 ? 0 : 1);
  }
  return dirs;
}
