/**
 * Ver.6 Phase 6（1対1リアルタイム対戦）: フレンド対戦のルームコード。
 *
 * 単純な連番は禁止（推測されやすい）というユーザー指示のため、暗号学的乱数
 * （crypto.getRandomValues、ブラウザ・Cloudflare Workersランタイムの両方で利用可能）から
 * 生成する。見間違えやすい文字（0/O・1/I/L）を除いた32文字のアルファベットから6文字
 * （32^6 ≈ 10億通り）——短く・入力しやすく・推測されにくい、の3条件を満たす。
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export function generateRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const byte of bytes) {
    code += ALPHABET[byte % ALPHABET.length]
  }
  return code
}

/** ユーザー入力の正規化（大文字化・前後空白除去・見間違えやすい文字の補正はしない=そのまま拒否）。 */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase()
}

export function isValidRoomCode(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(code)
}
