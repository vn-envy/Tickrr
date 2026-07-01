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
// Branding assets (relative to cwd so ffmpeg's filtergraph needs no path escaping).
const BRAND_FONT = process.env.GROWTH_BRAND_FONT || "assets/fonts/JetBrainsMono-Regular.ttf";
// Optional licensed music track; if absent we synthesize a soft royalty-free ambient bed.
const AUDIO_TRACK = process.env.GROWTH_MEDIA_AUDIO || "assets/track.m4a";

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

/** Record a short clip of the live app (Playwright outputs WebM). captureAndHost() transcodes
 *  this to MP4 via transcodeToMp4() before hosting, since X/LinkedIn require MP4. */
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

/** Polish + transcode the WebM into a branded, social-ready MP4 (H.264/yuv420p/faststart) with
 *  ffmpeg: fade in/out, a "TICKRR" wordmark + intel-only lower-third, and an audio bed (a licensed
 *  track at GROWTH_MEDIA_AUDIO if present, else a synthesized royalty-free ambient chord). */
export async function polishVideo(webm: Buffer): Promise<Buffer> {
  const fs = await import("fs");
  const os = await import("os");
  const path = await import("path");
  const { spawn } = await import("child_process");
  const ffmpegPath = ((await import("ffmpeg-static")).default as unknown as string) || "ffmpeg";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tickrr-mp4-"));
  const inPath = path.join(dir, "in.webm");
  const outPath = path.join(dir, "out.mp4");
  fs.writeFileSync(inPath, webm);

  // Probe the real clip length (Playwright's video includes navigation time, so it's not RECORD_SECONDS).
  const D = await new Promise<number>((resolve) => {
    const p = spawn(ffmpegPath, ["-hide_banner", "-i", inPath]);
    let err = "";
    p.stderr?.on("data", (d) => { err += d.toString(); });
    p.on("close", () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      resolve(m ? +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]) : RECORD_SECONDS);
    });
    p.on("error", () => resolve(RECORD_SECONDS));
  });
  const fout = Math.max(0.4, D - 0.6);
  const hasTrack = fs.existsSync(AUDIO_TRACK);

  const args: string[] = ["-y", "-i", inPath];
  if (hasTrack) args.push("-stream_loop", "-1", "-i", AUDIO_TRACK);
  else args.push("-f", "lavfi", "-i", `aevalsrc=exprs=0.08*sin(2*PI*261.63*t)+0.08*sin(2*PI*329.63*t)+0.08*sin(2*PI*392*t):s=44100:d=${Math.ceil(D) + 1}`);

  const vf =
    // Normalize fps + size + pixel format first (Playwright WebM can vary), else filters reinit.
    "[0:v]fps=30,scale=1280:720:force_original_aspect_ratio=decrease," +
    "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p," +
    `fade=t=in:st=0:d=0.5,fade=t=out:st=${fout}:d=0.6,` +
    "drawbox=x=0:y=ih-48:w=iw:h=48:color=black@0.45:t=fill," +
    `drawtext=fontfile=${BRAND_FONT}:text='TICKRR':fontcolor=0x00FF66:fontsize=30:x=w-tw-28:y=24:shadowcolor=black@0.6:shadowx=2:shadowy=2,` +
    `drawtext=fontfile=${BRAND_FONT}:text='INTEL ONLY - NOT ADVICE':fontcolor=white@0.9:fontsize=20:x=24:y=h-34[v]`;
  const af = `[1:a]afade=t=in:d=0.8,afade=t=out:st=${fout}:d=0.6,volume=${hasTrack ? 0.25 : 0.6}[a]`;

  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegPath, [
      ...args,
      "-filter_complex", `${vf};${af}`,
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30",
      "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-shortest",
      outPath,
    ]);
    let err = "";
    p.stderr?.on("data", (d) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
  });
  return fs.readFileSync(outPath);
}

/** Minimal WebM -> MP4 transcode (no branding/audio). Fallback if the branded polish fails. */
export async function basicMp4(webm: Buffer): Promise<Buffer> {
  const fs = await import("fs");
  const os = await import("os");
  const path = await import("path");
  const { spawn } = await import("child_process");
  const ffmpegPath = ((await import("ffmpeg-static")).default as unknown as string) || "ffmpeg";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tickrr-mp4b-"));
  const inPath = path.join(dir, "in.webm");
  const outPath = path.join(dir, "out.mp4");
  fs.writeFileSync(inPath, webm);
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegPath, [
      "-y", "-i", inPath,
      "-vf", "fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", "-an",
      outPath,
    ]);
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  return fs.readFileSync(outPath);
}

/** Capture the configured media of the live app and host it — returns a Buffer-ready asset URL. */
export async function captureAndHost(): Promise<Media> {
  if (MEDIA_MODE === "recording") {
    const webm = await captureRecording();
    let mp4: Buffer;
    try { mp4 = await polishVideo(webm); } // WebM -> branded MP4 with audio
    catch { mp4 = await basicMp4(webm); }  // fall back to a plain MP4 so it still posts
    return { url: await uploadPublic(mp4, "video/mp4", "mp4"), kind: "video" };
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
