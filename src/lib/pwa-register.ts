/**
 * PWA Service Worker registration.
 *
 * Uses the virtual module from vite-plugin-pwa to register the generated
 * service worker with auto-update behavior. Call once on app mount (client-side only).
 */

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      // Auto-update: when a new SW is found, activate it immediately.
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
            // New version active — the next navigation will use updated cache.
            console.log("[Brick] Service worker updated.");
          }
        });
      });
    } catch (e) {
      // SW registration failure must never break the app.
      console.warn("[Brick] SW registration failed:", e);
    }
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    register();
  } else {
    window.addEventListener("load", register);
  }
}
