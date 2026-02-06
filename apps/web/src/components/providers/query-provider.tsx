"use client";

import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/react-query";
import { useState } from "react";

interface QueryProviderProps {
  children: ReactNode;
}

export const QueryProvider = ({ children }: QueryProviderProps) => {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
