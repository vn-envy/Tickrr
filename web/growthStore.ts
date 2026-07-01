/**
 * Growth draft store. Two backends, chosen at startup:
 *  - Firestore  — durable across restarts / scale-to-zero (used on Cloud Run automatically).
 *  - File JSON  — zero-config local dev fallback.
 *
 * Selection: Firestore when GROWTH_STORE=firestore, or when a GCP project is detected
 * (GOOGLE_CLOUD_PROJECT — set automatically on Cloud Run) unless GROWTH_STORE=file. If Firestore
 * can't be reached, it degrades gracefully to the file store so the app never hard-fails.
 */
import fs from "fs";
import path from "path";

export interface Draft {
  id: string;
  createdAt: string;
  source: string;
  text: string;
  channels: string[];
  status: "pending" | "rejected" | "published";
  results?: Record<string, string>;
}

export interface GrowthStore {
  kind: "firestore" | "file";
  getDrafts(): Promise<Draft[]>;
  addDrafts(drafts: Draft[]): Promise<void>;
  updateDraft(draft: Draft): Promise<void>;
}

const CAP = 200;

// --- File store (local dev / no GCP) — newest-first, capped. ---
function fileStore(file: string): GrowthStore {
  const load = (): Draft[] => {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
  };
  const save = (d: Draft[]) => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(d, null, 2));
    } catch (e) { console.error("[TICKRR] growth save failed:", e); }
  };
  return {
    kind: "file",
    async getDrafts() { return load(); },
    async addDrafts(drafts) { save([...drafts, ...load()].slice(0, CAP)); },
    async updateDraft(draft) {
      const all = load();
      const i = all.findIndex((x) => x.id === draft.id);
      if (i >= 0) { all[i] = draft; save(all); }
    },
  };
}

// --- Firestore store (Cloud Run / durable). One doc per draft, keyed by id. ---
async function firestoreStore(collectionName: string): Promise<GrowthStore> {
  const { Firestore } = await import("@google-cloud/firestore");
  const opts = process.env.FIRESTORE_PROJECT_ID ? { projectId: process.env.FIRESTORE_PROJECT_ID } : {};
  const db = new Firestore(opts);
  const col = db.collection(collectionName);
  await col.limit(1).get(); // connectivity/auth probe — throws (→ file fallback) if misconfigured
  return {
    kind: "firestore",
    async getDrafts() {
      const snap = await col.orderBy("createdAt", "desc").limit(CAP).get();
      return snap.docs.map((d) => d.data() as Draft);
    },
    async addDrafts(drafts) {
      const batch = db.batch();
      for (const d of drafts) batch.set(col.doc(d.id), d);
      await batch.commit();
    },
    async updateDraft(draft) {
      await col.doc(draft.id).set(draft, { merge: true });
    },
  };
}

let storePromise: Promise<GrowthStore> | null = null;

export function getGrowthStore(): Promise<GrowthStore> {
  if (storePromise) return storePromise;
  const file = path.join(process.cwd(), "data", "growth.json");
  const wantFirestore =
    process.env.GROWTH_STORE === "firestore" ||
    (process.env.GROWTH_STORE !== "file" && !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIRESTORE_PROJECT_ID));
  storePromise = (async () => {
    if (wantFirestore) {
      try {
        const s = await firestoreStore(process.env.GROWTH_COLLECTION || "growth_drafts");
        console.log("[TICKRR] Growth store: Firestore");
        return s;
      } catch (e) {
        console.error("[TICKRR] Firestore unavailable — falling back to file store:", (e as any)?.message || e);
      }
    }
    console.log(`[TICKRR] Growth store: file (${file})`);
    return fileStore(file);
  })();
  return storePromise;
}
