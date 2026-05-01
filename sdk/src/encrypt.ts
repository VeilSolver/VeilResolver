import { EncryptionError } from "./errors"

export async function encryptIntent(
  intent: object,
  solverPublicKey: string  // hex compressed secp256k1
): Promise<string> {
  try {
    const { encrypt } = await import("eciesjs")
    const bytes = Buffer.from(JSON.stringify(intent), "utf-8")
    const pubKey = Buffer.from(solverPublicKey.replace("0x", ""), "hex")
    const encrypted = encrypt(pubKey, bytes)
    return Buffer.from(encrypted).toString("hex")
  } catch (e: any) {
    throw new EncryptionError(`Failed to encrypt: ${e.message}`)
  }
}
