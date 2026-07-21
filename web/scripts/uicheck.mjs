// Ad-hoc UI verification: desktop + mobile screenshots of home and terminal.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const out = process.env.OUT || "/tmp/uishots";
import fs from "fs";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, viewport, url, actions) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  if (actions) await actions(page);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: name.includes("full") });
  console.log(`${name}: ${errors.length ? "ERRORS: " + errors.slice(0, 3).join(" | ") : "no console errors"}`);
  await page.close();
}

const desktop = { width: 1536, height: 900 };
const mobile = { width: 390, height: 844 };

await shoot("home-desktop", desktop, `${BASE}/`);
await shoot("terminal-desktop", desktop, `${BASE}/?enter=1`);
await shoot("terminal-desktop-full", desktop, `${BASE}/?enter=1`);
await shoot("terminal-mobile", mobile, `${BASE}/?enter=1`);
await shoot("terminal-mobile-full", mobile, `${BASE}/?enter=1`);
await shoot("terminal-mobile-rail", mobile, `${BASE}/?enter=1`, async (page) => {
  await page.locator('main button:has-text("COMMAND RAIL")').click();
  await page.waitForTimeout(500);
});
await shoot("terminal-desktop-filtered", desktop, `${BASE}/?enter=1`, async (page) => {
  // Exercise the rail: pick a quality chip + a sort and confirm the board re-scopes.
  await page.locator('aside button:has-text("GOOD")').click();
  await page.locator('aside button:has-text("1W MOVE")').click();
  await page.waitForTimeout(600);
});

await browser.close();
console.log("done ->", out);
