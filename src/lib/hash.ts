/**
 * SHA-256 hex digest for evidence hashing (M4).
 *
 * The browser computes the same digest the server registers at upload, so the
 * wizard can show the real chain-of-custody hash before (mock) or while
 * (network) the bytes are stored. Requires a secure context (localhost/https);
 * elsewhere the hash honestly reports that it could not be computed.
 */
export async function sha256Hex(file: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) return 'unavailable (insecure context)'
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Display form used in compact list rows: first 8 hex chars + ellipsis. */
export function shortHash(hash: string): string {
  return /^[0-9a-f]{64}$/.test(hash) ? `${hash.slice(0, 8)}…` : hash
}
