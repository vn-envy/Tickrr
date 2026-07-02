/**
 * Capture fresh Tickrr screenshots from the live local app (localhost:3000)
 * into ../video/public for the Remotion promo. Reflects the CURRENT UI
 * (reframed generic hero, catalyst bar, category chips, unlocked Pro views).
 *
 *   node scripts/shoot.mjs
 */
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../video/public");
const URL = "http://localhost:3000/";
const VP = { width: 1600, height: 1000 };

const settle = (p, ms = 3500) => p.waitForTimeout(ms);

async function newCtx(browser, { entered = false, premium = false } = {}) {
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 });
  await ctx.addInitScript(
    ([e, pr]) => {
      try {
        if (e) sessionStorage.setItem("tickrr_entered", "1");
        if (pr) localStorage.setItem("tickrr_premium", "1");
      } catch {}
    },
    [entered, premium],
  );
  return ctx;
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file });
  console.log("  ✓", name);
}

async function loadTerminal(page) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector("#tickrr-main-terminal", { timeout: 30000 });
  // give the 9 market queries + catalyst calendar time to resolve
  await settle(page, 6000);
}

(async () => {
  const browser = await chromium.launch();
  console.log("Capturing →", OUT);

  // 1) Landing / hero — the reframed generic homepage
  {
    const ctx = await newCtx(browser, { entered: false });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForSelector("text=/information/i", { timeout: 20000 });
    await settle(page, 2500);
    await shot(page, "hero.png");
    await ctx.close();
  }

  // Terminal-based shots (entered + Pro unlocked)
  const ctx = await newCtx(browser, { entered: true, premium: true });

  // 2) Terminal — full board (all scope)
  {
    const page = await ctx.newPage();
    await loadTerminal(page);
    await shot(page, "terminal.png");

    // 3) Divergence — scope to a non-default league if a chip exists
    for (const label of ["Politics", "NBA", "Crypto", "MLB", "F1"]) {
      const chip = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
      if (await chip.count().catch(() => 0)) {
        await chip.click().catch(() => {});
        await settle(page, 2500);
        break;
      }
    }
    await shot(page, "nba.png");
    await page.close();
  }

  // 4) Deliberation Room (unlocked)
  {
    const page = await ctx.newPage();
    await loadTerminal(page);
    await page.getByRole("button", { name: /DELIBERATION ROOM/i }).click();
    await settle(page, 3500);
    await shot(page, "room.png");
    await page.close();
  }

  // 5) Growth console
  {
    const page = await ctx.newPage();
    await loadTerminal(page);
    await page.getByRole("button", { name: /^GROWTH$/i }).click();
    await settle(page, 3000);
    await shot(page, "growth.png");
    await page.close();
  }

  // 6) My Space
  {
    const page = await ctx.newPage();
    await loadTerminal(page);
    await page.getByRole("button", { name: /MY SPACE/i }).click();
    await settle(page, 2500);
    await shot(page, "myspace.png");
    await page.close();
  }

  await ctx.close();
  await browser.close();
  console.log("Done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
