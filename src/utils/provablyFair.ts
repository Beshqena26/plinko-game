export async function hashSHA256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateClientSeed(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export function generateServerSeed(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export async function getDropResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number
): Promise<number[]> {
  const hash = await hashSHA256(`${serverSeed}:${clientSeed}:${nonce}`);
  const directions: number[] = [];
  for (let i = 0; i < rows; i++) {
    const hexChar = hash[i % hash.length];
    const value = parseInt(hexChar, 16);
    directions.push(value < 8 ? 0 : 1); // 0 = left, 1 = right
  }
  return directions;
}

export async function verifyResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number
): Promise<{ directions: number[]; hash: string; bucketIndex: number }> {
  const hash = await hashSHA256(`${serverSeed}:${clientSeed}:${nonce}`);
  const directions: number[] = [];
  for (let i = 0; i < rows; i++) {
    const hexChar = hash[i % hash.length];
    const value = parseInt(hexChar, 16);
    directions.push(value < 8 ? 0 : 1);
  }
  const bucketIndex = directions.reduce((sum, d) => sum + d, 0);
  return { directions, hash, bucketIndex };
}
