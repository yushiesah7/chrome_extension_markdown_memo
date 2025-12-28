import { applyTheme } from "./render.js";

export function initializeTheme() {
  const prefersDark =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  applyTheme(prefersDark ? prefersDark.matches : false);

  if (!prefersDark) {
    return;
  }

  const handleThemeChange = (event) => applyTheme(event.matches);

  if (typeof prefersDark.addEventListener === "function") {
    prefersDark.addEventListener("change", handleThemeChange);
  } else if (typeof prefersDark.addListener === "function") {
    prefersDark.addListener(handleThemeChange);
  }
}
