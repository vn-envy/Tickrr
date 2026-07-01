/**
 * Growth engine client — talks to the same-origin Express endpoints.
 * Agent drafts posts from live signals; you approve; approved drafts auto-post to the free
 * channels (Discord webhook + Bluesky). Dry-runs server-side when creds are absent.
 */
export interface GrowthDraft {
  id: string;
  createdAt: string;
  source: string;
  text: string;
  channels: string[];
  status: string;
  results?: Record<string, string>;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

export interface GrowthState {
  discord: boolean;
  bluesky: boolean;
  buffer: boolean;
  drafts: GrowthDraft[];
}

export async function fetchGrowth(): Promise<GrowthState> {
  try {
    const r = await fetch("/api/growth/drafts");
    if (!r.ok) return { discord: false, bluesky: false, buffer: false, drafts: [] };
    return await r.json();
  } catch {
    return { discord: false, bluesky: false, buffer: false, drafts: [] };
  }
}

export async function generateDrafts(count = 3): Promise<GrowthDraft[]> {
  try {
    const r = await fetch("/api/growth/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const d = await r.json();
    return d.created || [];
  } catch {
    return [];
  }
}

export interface BufferChannel {
  id: string;
  name: string;
  service: string;
  organization?: string;
}

export async function fetchBufferChannels(): Promise<{ channels?: BufferChannel[]; error?: string }> {
  try {
    const r = await fetch("/api/growth/buffer/channels");
    return await r.json();
  } catch {
    return { error: "Network error." };
  }
}

export async function decideDraft(id: string, action: "approve" | "reject"): Promise<GrowthDraft | null> {
  try {
    const r = await fetch(`/api/growth/drafts/${id}/${action}`, { method: "POST" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
