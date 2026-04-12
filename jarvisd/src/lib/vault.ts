import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import keytar from "keytar";
import { JARVIS_HOME } from "../db/db.js";
import { audit } from "./audit.js";

const VAULT_PATH = join(JARVIS_HOME, "vault.enc");
const SERVICE = "jarvis-os";
const ACCOUNT = "master-key";

// Vault file format (on disk):
// { v: 1, salt: base64, iv: base64, tag: base64, ct: base64 }
interface VaultFile {
  v: 1;
  salt: string;
  iv: string;
  tag: string;
  ct: string;
}

type VaultData = Record<string, string>;

let unlockedKey: Buffer | null = null;
let unlockedData: VaultData | null = null;

function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, 32);
}

function encrypt(data: VaultData, key: Buffer): VaultFile {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derivedKey = deriveKey(key.toString("hex"), salt);
  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
  };
}

function decrypt(file: VaultFile, key: Buffer): VaultData {
  const salt = Buffer.from(file.salt, "base64");
  const iv = Buffer.from(file.iv, "base64");
  const tag = Buffer.from(file.tag, "base64");
  const ct = Buffer.from(file.ct, "base64");
  const derivedKey = deriveKey(key.toString("hex"), salt);
  const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

async function getOrCreateMasterKey(): Promise<Buffer> {
  let hex = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!hex) {
    const newKey = randomBytes(32).toString("hex");
    await keytar.setPassword(SERVICE, ACCOUNT, newKey);
    hex = newKey;
    audit({ actor: "system", action: "vault.init", reason: "generated new master key in OS keychain" });
  }
  return Buffer.from(hex, "hex");
}

function persist(): void {
  if (!unlockedKey || !unlockedData) throw new Error("vault locked");
  const file = encrypt(unlockedData, unlockedKey);
  writeFileSync(VAULT_PATH, JSON.stringify(file), { mode: 0o600 });
}

export const vault = {
  exists(): boolean {
    return existsSync(VAULT_PATH);
  },

  isLocked(): boolean {
    return unlockedKey === null;
  },

  async unlock(): Promise<void> {
    if (unlockedKey) return;
    const key = await getOrCreateMasterKey();
    if (!existsSync(VAULT_PATH)) {
      unlockedKey = key;
      unlockedData = {};
      persist();
      audit({ actor: "user", action: "vault.unlock", reason: "created new vault" });
      return;
    }
    const file = JSON.parse(readFileSync(VAULT_PATH, "utf8")) as VaultFile;
    try {
      unlockedData = decrypt(file, key);
      unlockedKey = key;
      audit({ actor: "user", action: "vault.unlock" });
    } catch (err) {
      audit({ actor: "user", action: "vault.unlock.fail", reason: "decryption failed" });
      throw new Error("vault decryption failed");
    }
  },

  lock(): void {
    if (unlockedKey) {
      unlockedKey = null;
      unlockedData = null;
      audit({ actor: "user", action: "vault.lock" });
    }
  },

  get(key: string): string | null {
    if (!unlockedData) throw new Error("vault locked");
    audit({ actor: "system", action: "vault.get", subject: key });
    return unlockedData[key] ?? null;
  },

  set(key: string, value: string): void {
    if (!unlockedData) throw new Error("vault locked");
    unlockedData[key] = value;
    persist();
    audit({ actor: "user", action: "vault.set", subject: key });
  },

  delete(key: string): boolean {
    if (!unlockedData) throw new Error("vault locked");
    if (!(key in unlockedData)) return false;
    delete unlockedData[key];
    persist();
    audit({ actor: "user", action: "vault.delete", subject: key });
    return true;
  },

  list(): string[] {
    if (!unlockedData) throw new Error("vault locked");
    return Object.keys(unlockedData);
  },
};
