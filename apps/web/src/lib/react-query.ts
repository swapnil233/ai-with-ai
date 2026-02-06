import { QueryClient } from "@tanstack/react-query";

const QUERY_STALE_TIME_MS = 30_000;
const QUERY_GC_TIME_MS = 5 * 60_000;

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: {
        retry: 0,
      },
      queries: {
        gcTime: QUERY_GC_TIME_MS,
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: QUERY_STALE_TIME_MS,
      },
    },
  });
