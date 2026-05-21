import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { initDb } from "./db";

/**
 * MSW worker bootstrap. Called once from `main.tsx` before React mounts.
 * We initialise the in-memory DB before starting the worker so the very
 * first GET /leads after mount has data.
 */
export async function startMockApi(): Promise<void> {
  initDb();
  const worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
  });
}
