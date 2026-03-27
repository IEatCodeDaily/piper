import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { PiperRuntimeBoundary } from "@/app/runtime/piper-runtime-boundary";
import { queryClient } from "@/lib/query/query-client";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PiperRuntimeBoundary>
        <App />
      </PiperRuntimeBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
);
