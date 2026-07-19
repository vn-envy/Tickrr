/**
 * Pro waitlist store — Google stack only. Firestore on Cloud Run (durable, queryable),
 * file JSON fallback for zero-config local dev. Mirrors growthStore's selection logic.
 */
import fs from "fs";
import path from "path";

export interface WaitlistEntry {
  id: string;
  createdAt: string;
  email: string;
  name?: string | null;
  uid?: string | null;
  intent: string;             // "pro" | "founder" | "pass_..."
  reason?: string | null;     // which limit tripped the modal
  source?: string | null;
  usage?: Record<string, number> | null; // real actions taken before joining
}

interface WaitlistStore {
  kind: "firestore" | "file";
  add(entry: WaitlistEntry): Promise<void>;
  count(): Promise<number>;
}

const FILE = path.join(process.cwd(), "data", "waitlist.json");

/** Drop null/undefined fields so repeat joins never erase earlier data (name, usage, ...). */
function compact(entry: WaitlistEntry): Partial<WaitlistEntry> {
  return Object.fromEntries(Object.entries(entry).filter(([, v]) => v != null)) as Partial<WaitlistEntry>;
}

function fileStore(): WaitlistStore {
  const load = (): WaitlistEntry[] => {
    try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; }
  };
  return {
    kind: "file",
    async add(entry) {
      const all = load();
      // one row per email — repeat joins update intent/usage instead of duplicating
      const i = all.findIndex((e) => e.email === entry.email);
      if (i >= 0) all[i] = { ...all[i], ...compact(entry), id: all[i].id, createdAt: all[i].createdAt };
      else all.unshift(entry);
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
    },
    async count() { return load().length; },
  };
}

async function firestoreStore(collectionName: string): Promise<WaitlistStore> {
  const { Firestore } = await import("@google-cloud/firestore");
  const opts = process.env.FIRESTORE_PROJECT_ID ? { projectId: process.env.FIRESTORE_PROJECT_ID } : {};
  const db = new Firestore(opts);
  const col = db.collection(collectionName);
  await col.limit(1).get(); // connectivity probe — throws (→ file fallback) if misconfigured
  return {
    kind: "firestore",
    async add(entry) {
      // doc id = email → idempotent joins, no duplicates, trivially exportable
      await col.doc(entry.email).set(compact(entry), { merge: true });
    },
    async count() {
      const snap = await col.count().get();
      return snap.data().count;
    },
  };
}

let storePromise: Promise<WaitlistStore> | null = null;

export function getWaitlistStore(): Promise<WaitlistStore> {
  if (storePromise) return storePromise;
  const wantFirestore =
    process.env.WAITLIST_STORE === "firestore" ||
    (process.env.WAITLIST_STORE !== "file" &&
      !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIRESTORE_PROJECT_ID));
  storePromise = (async () => {
    if (wantFirestore) {
      try {
        const s = await firestoreStore(process.env.WAITLIST_COLLECTION || "waitlist");
        console.log("[TICKRR] Waitlist store: Firestore");
        return s;
      } catch (e) {
        console.error("[TICKRR] Waitlist Firestore unavailable — file fallback:", (e as any)?.message || e);
      }
    }
    console.log(`[TICKRR] Waitlist store: file (${FILE})`);
    return fileStore();
  })();
  return storePromise;
}
