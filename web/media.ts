/**
 * Media pipeline for growth posts. All heavy deps are dynamically imported so they load only
 * when a media feature is actually enabled — the default text loop pulls in none of this.
 *
 *  - captureScreenshot / captureRecording: real captures of the LIVE Tickrr app via a headless
 *    browser (Playwright). Free — just compute, no AI cost.
 *  - uploadPublic: hosts bytes on a public GCS bucket and returns the URL (Buffer requires a
 *    hosted URL; it has no file upload).
 *  - generateAiVideo: GATED, unwired hook for AI video (Veo / "omni" / etc.), model-configurable.
 *
 * Enable via env:
 *   GROWTH_MEDIA        = "" | "screenshot" | "recording"   (what to attach to Buffer posts)
 *   GROWTH_MEDIA_BUCKET = <public GCS bucket name>          (required when GROWTH_MEDIA is set)
 *   GROWTH_MEDIA_URL    = <url to capture>                  (defaults to APP_URL, i.e. our app)
 *   GROWTH_MEDIA_SECONDS= <recording length>                (default 6)
 *   GROWTH_VIDEO_MODEL  = <AI video model id>               (for generateAiVideo only)
 */
import { randomUUID } from "crypto";

export type MediaKind = "image" | "video";
export interface Media { url: string; kind: MediaKind; }

const BUCKET = process.env.GROWTH_MEDIA_BUCKET || "";
const CAPTURE_URL = process.env.GROWTH_MEDIA_URL || process.env.APP_URL || "http://localhost:3000";
const RECORD_SECONDS = Number(process.env.GROWTH_MEDIA_SECONDS) || 6;
const VIEWPORT = { width: 1280, height: 720 }; // 16:9, good for X / LinkedIn

/** The configured media mode ("" | "screenshot" | "recording"). */
export const MEDIA_MODE = (process.env.GROWTH_MEDIA || "").toLowerCase();

/** Upload bytes to a public GCS object and return its public URL. Requires GROWTH_MEDIA_BUCKET. */
async function uploadPublic(bytes: Buffer, contentType: string, ext: string): Promise<string> {
  if (!BUCKET) throw new Error("GROWTH_MEDIA_BUCKET not set");
  const { Storage } = await import("@google-cloud/storage");
  const storage = new Storage();
  const name = `growth/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  await storage.bucket(BUCKET).file(name).save(bytes, {
    contentType,
    resumable: false,
    metadata: { cacheControl: "public, max-age=86400" },
  });
  // Bucket is expected to be public (allUsers:objectViewer, set by deploy.sh).
  return `https://storage.googleapis.com/${BUCKET}/${name}`;
}

/** Screenshot the live app (PNG). */
export async function captureScreenshot(url = CAPTURE_URL): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2500); // let charts / globe settle
    return (await page.screenshot({ type: "png" })) as Buffer;
  } finally {
    await browser.close();
  }
}

/** Record a short clip of the live app (WebM). Note: X/LinkedIn prefer MP4 — WebM may need
 *  transcoding (ffmpeg) before it's accepted on all networks. */
export async function captureRecording(url = CAPTURE_URL, seconds = RECORD_SECONDS): Promise<Buffer> {
  const fs = await import("fs");
  const os = await import("os");
  const path = await import("path");
  const { chromium } = await import("playwright");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tickrr-rec-"));
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const ctx = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir, size: VIEWPORT } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(seconds * 1000);
    const video = page.video();
    await ctx.close(); // finalizes the recording
    const p = video ? await video.path() : "";
    return p ? fs.readFileSync(p) : Buffer.alloc(0);
  } finally {
    await browser.close();
  }
}

/** Capture the configured media of the live app and host it — returns a Buffer-ready asset URL. */
export async function captureAndHost(): Promise<Media> {
  if (MEDIA_MODE === "recording") {
    const bytes = await captureRecording();
    return { url: await uploadPublic(bytes, "video/webm", "webm"), kind: "video" };
  }
  const bytes = await captureScreenshot();
  return { url: await uploadPublic(bytes, "image/png", "png"), kind: "image" };
}

/**
 * GATED, unwired: generate an AI video (Veo / "omni" / etc.) via the Gemini API and host it.
 * Not called from the normal loop — wire it in only when you're ready to spend. The model id is
 * configurable (GROWTH_VIDEO_MODEL) because the exact endpoint name is provider-specific.
 * This path is PAID and unverified until enabled with a billing-backed key.
 */
export async function generateAiVideo(prompt: string): Promise<Media> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GROWTH_VIDEO_MODEL;
  if (!apiKey) throw new Error("GEMINI_API_KEY required for AI video");
  if (!model) throw new Error("GROWTH_VIDEO_MODEL required (e.g. a Veo model id)");
  const { GoogleGenAI } = await import("@google/genai");
  const ai: any = new GoogleGenAI({ apiKey });
  let op: any = await ai.models.generateVideos({ model, prompt });
  const started = Date.now();
  while (!op?.done) {
    if (Date.now() - started > 5 * 60 * 1000) throw new Error("AI video timed out");
    await new Promise((r) => setTimeout(r, 10000));
    op = await ai.operations.getVideosOperation({ operation: op });
  }
  const file = op?.response?.generatedVideos?.[0]?.video;
  if (!file) throw new Error("AI video: no output returned");
  const buf: Buffer = Buffer.from(await (await ai.files.download({ file })).arrayBuffer?.() ?? file);
  return { url: await uploadPublic(buf, "video/mp4", "mp4"), kind: "video" };
}
