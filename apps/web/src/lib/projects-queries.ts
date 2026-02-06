import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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

export { projectQueryKeys };
