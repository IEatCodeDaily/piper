import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { queryClient } from "@/lib/query/query-client";
import { mockPiperRepository } from "@/lib/repository/mock-piper-repository";
import { setPiperRepository } from "@/lib/repository/piper-repository";

setPiperRepository(mockPiperRepository);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
