import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = "";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateProjectInput {
  name: string;
  description?: string;
}

interface UseProjectsQueryOptions {
  enabled?: boolean;
}

interface UseProjectQueryOptions {
  enabled?: boolean;
}

interface CsrfTokenResponse {
  csrfToken: string;
}

let csrfTokenCache: string | null = null;

const projectQueryKeys = {
  all: ["projects"] as const,
  detail: (projectId: string) => [...projectQueryKeys.all, projectId] as const,
  list: () => [...projectQueryKeys.all, "list"] as const,
};

const getErrorMessage = (message: unknown, fallback: string) => {
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  return fallback;
};

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as { error?: unknown };
    return getErrorMessage(body.error, fallback);
  } catch {
    return fallback;
  }
};

const fetchProjects = async (): Promise<Project[]> => {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response, "Failed to fetch projects");
    throw new Error(errorMessage);
  }

  return (await response.json()) as Project[];
};

const fetchProject = async (projectId: string): Promise<Project> => {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response, "Failed to fetch project");
    throw new Error(errorMessage);
  }

  return (await response.json()) as Project;
};

const createProject = async (payload: CreateProjectInput): Promise<Project> => {
  const csrfToken = await getCsrfToken();
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response, "Failed to create project");
    throw new Error(errorMessage);
  }

  return (await response.json()) as Project;
};

const getCsrfToken = async (): Promise<string> => {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  const response = await fetch(`${API_BASE_URL}/api/security/csrf-token`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response, "Failed to fetch CSRF token");
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as CsrfTokenResponse;
  if (!data.csrfToken || data.csrfToken.trim().length === 0) {
    throw new Error("Failed to fetch CSRF token");
  }

  csrfTokenCache = data.csrfToken;
  return csrfTokenCache;
};

export const useProjectsQuery = (options?: UseProjectsQueryOptions) =>
  useQuery<Project[], Error>({
    queryFn: fetchProjects,
    queryKey: projectQueryKeys.list(),
    enabled: options?.enabled ?? true,
  });

export const useProjectQuery = (projectId: string | null, options?: UseProjectQueryOptions) =>
  useQuery<Project, Error>({
    queryFn: async () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }

      return fetchProject(projectId);
    },
    queryKey: projectQueryKeys.detail(projectId ?? "empty"),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
  });

export const useCreateProjectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<Project, Error, CreateProjectInput>({
    mutationFn: createProject,
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(projectQueryKeys.list(), (currentProjects) => {
        if (!currentProjects) {
          return [project];
        }

        const exists = currentProjects.some((currentProject) => currentProject.id === project.id);
        if (exists) {
          return currentProjects;
        }

        return [project, ...currentProjects];
      });
      queryClient.setQueryData(projectQueryKeys.detail(project.id), project);
    },
  });
};

export const resetCsrfTokenCache = () => {
  csrfTokenCache = null;
};

export { projectQueryKeys };
