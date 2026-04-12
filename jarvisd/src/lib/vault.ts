import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import keytar from "keytar";
import { JARVIS_HOME } from "../db/db.js";
import { audit } from "./audit.js";

// BIP39-style wordlist (simplified — 256 common words for recovery phrases)
const WORDS = [
  "alpha","anchor","arrow","atlas","azure","beacon","blade","blaze","bloom","bolt",
  "bridge","bright","bronze","castle","cedar","cipher","claim","climb","cloud","coast",
  "coral","craft","crown","crystal","curve","dawn","delta","depth","desert","drift",
  "eagle","ember","epoch","falcon","fiber","flame","flash","flint","flora","forge",
  "frost","galaxy","garden","ghost","glacier","gleam","globe","grace","grain","granite",
  "grove","guard","guild","harbor","haven","hawk","heart","helix","hero","hive",
  "honor","horizon","hydra","icon","ignite","impact","index","iris","iron","ivory",
  "jade","jasper","jet","jewel","jungle","karma","kernel","key","knight","knot",
  "lace","lance","lark","laser","latch","lava","leaf","lens","level","light",
  "lily","lime","link","lion","logic","lotus","lunar","maple","marble","marsh",
  "mask","matrix","meadow","medal","mercy","mesa","metal","mind","mint","mirror",
  "model","moon","morph","moss","motor","mystic","nerve","nexus","night","noble",
  "north","nova","oak","oasis","ocean","olive","omega","onyx","opera","orbit",
  "orchid","origin","oxide","palm","panel","pearl","petal","phase","pilot","pine",
  "pixel","plain","plasma","plume","point","polar","portal","prism","probe","pulse",
  "quartz","quest","radar","raven","razor","realm","reef","relay","ridge","river",
  "robin","rocket","rose","royal","ruby","sage","sail","scale","scout","seal",
  "shade","shell","shield","shore","sigma","silk","silver","slate","solar","sonic",
  "spark","spear","sphere","spire","spring","squad","staff","star","steel","stem",
  "stone","storm","strand","stream","stride","summit","surge","swift","sword","talon",
  "tango","tempo","terra","theta","thorn","tiger","timber","titan","torch","tower",
  "trail","trend","triad","tribe","tulip","ultra","unity","upper","vapor","vault",
  "venom","verse","vigor","vine","viola","vivid","voice","vortex","wave","weave",
  "whale","wheat","white","wild","willow","wind","wing","winter","wire","wisdom",
  "wolf","wonder","world","wren","xenon","yacht","yarn","yield","zenith","zero",
  "zinc","zone","bliss","brave","calm","chase","chief","civic","clear","crest",
];

function generateRecoveryPhrase(masterKeyHex: string): string {
  // Derive 12 words from the master key hash
  const hash = createHash("sha256").update(masterKeyHex).digest();
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = hash.readUInt8(i) % WORDS.length;
    words.push(WORDS[idx]);
  }
  return words.join(" ");
}

function masterKeyFromPhrase(phrase: string): Buffer {
  // Re-derive: hash the phrase to get a deterministic key
  // Note: the phrase IS the key representation, not a seed.
  // We stored the phrase as a hash of the key, so we need the
  // original key. The phrase is for display — rescue uses keychain restore.
  // For true rescue, we store an encrypted backup of the key using the phrase.
  const hash = createHash("sha256").update(phrase.trim().toLowerCase()).digest();
  return hash;
}

const VAULT_PATH = join(JARVIS_HOME, "vault.enc");
const SERVICE = "jarvis-os";
const ACCOUNT = "master-key";

// ---------------------------------------------------------------------------
// Pluggable auth provider interface (Gate Protocol)
// ---------------------------------------------------------------------------
// Ships with KeychainAuthProvider. Future providers: YubiKey (WebAuthn),
// biometric, or passphrase-based. Swap via setAuthProvider().

export interface VaultAuthProvider {
  name: string;
  /** Retrieve or create the master key bytes. */
  getMasterKey(): Promise<Buffer>;
}

class KeychainAuthProvider implements VaultAuthProvider {
  name = "keychain";
  async getMasterKey(): Promise<Buffer> {
    let hex = await keytar.getPassword(SERVICE, ACCOUNT);
    if (!hex) {
      const newKey = randomBytes(32).toString("hex");
      await keytar.setPassword(SERVICE, ACCOUNT, newKey);
      hex = newKey;
      audit({ actor: "system", action: "vault.init", reason: "generated new master key in OS keychain" });
    }
    return Buffer.from(hex, "hex");
  }
}

let authProvider: VaultAuthProvider = new KeychainAuthProvider();

/** Swap the auth provider (e.g., for YubiKey). Call before vault.unlock(). */
export function setAuthProvider(provider: VaultAuthProvider): void {
  authProvider = provider;
  audit({ actor: "system", action: "vault.auth_provider.set", metadata: { provider: provider.name } });
}

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
  return authProvider.getMasterKey();
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

  /** Generate a recovery phrase from the current master key. Must be unlocked. */
  async getRecoveryPhrase(): Promise<string> {
    if (!unlockedKey) throw new Error("vault locked");
    const phrase = generateRecoveryPhrase(unlockedKey.toString("hex"));
    // Also store an encrypted backup of the master key using the phrase as the encryption key
    const backupPath = join(JARVIS_HOME, "vault.rescue");
    const phraseKey = masterKeyFromPhrase(phrase);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", phraseKey, iv);
    const ct = Buffer.concat([cipher.update(unlockedKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    writeFileSync(backupPath, JSON.stringify({
      v: 1,
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ct: ct.toString("base64"),
    }), { mode: 0o600 });
    audit({ actor: "user", action: "vault.recovery.generated" });
    return phrase;
  },

  /** Rescue vault using a recovery phrase. Re-derives master key and stores in keychain. */
  async rescue(phrase: string): Promise<boolean> {
    const backupPath = join(JARVIS_HOME, "vault.rescue");
    if (!existsSync(backupPath)) throw new Error("no rescue file found");
    if (!existsSync(VAULT_PATH)) throw new Error("no vault file found");

    try {
      const backup = JSON.parse(readFileSync(backupPath, "utf8"));
      const phraseKey = masterKeyFromPhrase(phrase);
      const iv = Buffer.from(backup.iv, "base64");
      const tag = Buffer.from(backup.tag, "base64");
      const ct = Buffer.from(backup.ct, "base64");
      const decipher = createDecipheriv("aes-256-gcm", phraseKey, iv);
      decipher.setAuthTag(tag);
      const masterKey = Buffer.concat([decipher.update(ct), decipher.final()]);

      // Verify this key can decrypt the vault
      const file = JSON.parse(readFileSync(VAULT_PATH, "utf8")) as VaultFile;
      const data = decrypt(file, masterKey);

      // Restore to keychain
      await keytar.setPassword(SERVICE, ACCOUNT, masterKey.toString("hex"));

      // Unlock with restored key
      unlockedKey = masterKey;
      unlockedData = data;
      audit({ actor: "user", action: "vault.rescue.success" });
      return true;
    } catch (err: any) {
      audit({ actor: "user", action: "vault.rescue.fail", reason: err?.message ?? String(err) });
      throw new Error("Recovery failed — phrase may be incorrect");
    }
  },
};
