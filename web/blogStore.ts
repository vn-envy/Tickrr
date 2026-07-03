/**
 * Blog post store for the AI-generated SEO posts. Same two-backend pattern as growthStore:
 *   - Firestore  — durable across restarts / scale-to-zero (Cloud Run).
 *   - File JSON  — zero-config local dev fallback.
 * Seed posts (content.ts) are static; generated posts live here and are merged at render time.
 */
import fs from "fs";
import path from "path";
import type { BlogPost } from "./content";

export interface BlogStore {
  kind: "firestore" | "file";
  getPosts(): Promise<BlogPost[]>;
  addPost(post: BlogPost): Promise<void>;
  hasSlug(slug: string): Promise<boolean>;
}

const CAP = 500;

function fileStore(file: string): BlogStore {
  const load = (): BlogPost[] => {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
  };
  const save = (p: BlogPost[]) => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(p, null, 2));
    } catch (e) { console.error("[TICKRR] blog save failed:", e); }
  };
  return {
    kind: "file",
    async getPosts() { return load(); },
    async addPost(post) { save([post, ...load().filter((x) => x.slug !== post.slug)].slice(0, CAP)); },
    async hasSlug(slug) { return load().some((x) => x.slug === slug); },
  };
}

async function firestoreStore(collectionName: string): Promise<BlogStore> {
  const { Firestore } = await import("@google-cloud/firestore");
  const opts = process.env.FIRESTORE_PROJECT_ID ? { projectId: process.env.FIRESTORE_PROJECT_ID } : {};
  const db = new Firestore(opts);
  const col = db.collection(collectionName);
  await col.limit(1).get(); // connectivity probe (→ file fallback on failure)
  return {
    kind: "firestore",
    async getPosts() {
      const snap = await col.orderBy("date", "desc").limit(CAP).get();
      return snap.docs.map((d) => d.data() as BlogPost);
    },
    async addPost(post) { await col.doc(post.slug).set(post, { merge: true }); },
    async hasSlug(slug) { return (await col.doc(slug).get()).exists; },
  };
}

let storePromise: Promise<BlogStore> | null = null;

export function getBlogStore(): Promise<BlogStore> {
  if (storePromise) return storePromise;
  const file = path.join(process.cwd(), "data", "blog.json");
  const wantFirestore =
    process.env.GROWTH_STORE === "firestore" ||
    (process.env.GROWTH_STORE !== "file" &&
      !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIRESTORE_PROJECT_ID));
  storePromise = (async () => {
    if (wantFirestore) {
      try {
        const s = await firestoreStore(process.env.BLOG_COLLECTION || "blog_posts");
        console.log("[TICKRR] Blog store: Firestore");
        return s;
      } catch (e) {
        console.error("[TICKRR] Firestore unavailable for blog — file store:", (e as any)?.message || e);
      }
    }
    console.log(`[TICKRR] Blog store: file (${file})`);
    return fileStore(file);
  })();
  return storePromise;
}
