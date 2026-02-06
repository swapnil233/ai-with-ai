import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  projectQueryKeys,
  useCreateProjectMutation,
  useProjectQuery,
  useProjectsQuery,
  type Project,
} from "./projects-queries";

const mockFetch = vi.fn();

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        gcTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });

const createWrapper = (queryClient: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

describe("projects-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch as typeof fetch;
  });

  it("returns project list when fetch succeeds", async () => {
    const mockProjects: Project[] = [
      {
        id: "project-1",
        name: "AI CRM",
        description: "CRM app",
        userId: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockProjects), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useProjectsQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockProjects);
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:4000/api/projects", {
      credentials: "include",
    });
  });

  it("does not fetch project detail when project ID is missing", () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useProjectQuery(null), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("updates list and detail caches when create project succeeds", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(projectQueryKeys.list(), [
      {
        id: "project-existing",
        name: "Existing Project",
        description: null,
        userId: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] satisfies Project[]);

    const createdProject: Project = {
      id: "project-new",
      name: "New Project",
      description: null,
      userId: "user-1",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(createdProject), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    const { result } = renderHook(() => useCreateProjectMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        name: "New Project",
      });
    });

    const cachedProjects = queryClient.getQueryData<Project[]>(projectQueryKeys.list());
    const cachedDetail = queryClient.getQueryData<Project>(
      projectQueryKeys.detail(createdProject.id)
    );

    expect(cachedProjects?.map((project) => project.id)).toEqual([
      "project-new",
      "project-existing",
    ]);
    expect(cachedDetail).toEqual(createdProject);
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:4000/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name: "New Project",
      }),
    });
  });
});
