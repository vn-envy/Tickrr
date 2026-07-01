/**
 * Dark ⇄ light (monochrome) theme toggle. Sun = currently dark (click for light);
 * Moon = currently light (click for dark).
 */
import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getTheme, toggleTheme } from "../lib/theme";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setThemeState] = useState(getTheme());
  return (
    <button
      onClick={() => setThemeState(toggleTheme())}
      title={theme === "light" ? "Switch to dark" : "Switch to light"}
      aria-label="Toggle color theme"
      className={`cursor-pointer flex items-center justify-center w-7 h-7 rounded border border-[#2D333B] text-[#D1D4DC]/60 hover:text-[#00FF66] hover:border-[#00FF66]/50 transition ${className}`}
    >
      {theme === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
    </button>
  );
}
