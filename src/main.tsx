import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { ToastProvider } from "@/components/Toaster";
import { startMockApi } from "@/mocks/browser";
import "./index.css";

/**
 * React Query is our server-state layer. Defaults:
 *  - retry: 1 — don't hammer the mock when an error is deliberate
 *  - refetchOnWindowFocus: false — surprising in-app refetches feel jumpy
 *    in a CRM and we already have explicit refresh affordances
 *  - staleTime: 5s — the list cache stays warm enough to feel instant
 *    when toggling filters back and forth
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
    mutations: {
      retry: 0,
    },
  },
});

async function bootstrap() {
  await startMockApi();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}

void bootstrap();
