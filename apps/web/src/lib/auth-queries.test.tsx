import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  authQueryKeys,
  useAuthSessionQuery,
  useSignInMutation,
  useSignOutMutation,
  useSignUpMutation,
} from "./auth-queries";

const { mockGetSession, mockSignInEmail, mockSignOut, mockSignUpEmail } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignInEmail: vi.fn(),
  mockSignOut: vi.fn(),
  mockSignUpEmail: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getSession: mockGetSession,
  },
  signIn: {
    email: mockSignInEmail,
  },
  signOut: mockSignOut,
  signUp: {
    email: mockSignUpEmail,
  },
  useSession: vi.fn(),
}));

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

describe("auth-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session data when session fetch succeeds", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: { id: "session-1" },
        user: { email: "test@example.com" },
      },
      error: null,
    });

    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAuthSessionQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.user.email).toBe("test@example.com");
  });

  it("returns null for unauthorized session response", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Unauthorized",
        status: 401,
        statusText: "Unauthorized",
      },
    });

    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAuthSessionQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it("throws fallback error message for non-auth session errors", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: null,
      error: {
        message: "",
        status: 500,
        statusText: "Internal Server Error",
      },
    });

    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAuthSessionQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Failed to fetch session");
  });

  it("invalidates auth session query after successful sign in", async () => {
    mockSignInEmail.mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    });

    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSignInMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        email: "test@example.com",
        password: "password123",
      });
    });

    expect(mockSignInEmail).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: authQueryKeys.session,
    });
  });

  it("throws sign-in error message from API response", async () => {
    mockSignInEmail.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid credentials" },
    });

    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useSignInMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({
        email: "test@example.com",
        password: "wrong-password",
      })
    ).rejects.toThrow("Invalid credentials");
  });

  it("invalidates auth session query after successful sign up", async () => {
    mockSignUpEmail.mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    });

    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSignUpMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        email: "test@example.com",
        name: "Test User",
        password: "password123",
      });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: authQueryKeys.session,
    });
  });

  it("clears cached session after successful sign out", async () => {
    mockSignOut.mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(authQueryKeys.session, {
      session: { id: "session-1" },
      user: { email: "test@example.com" },
    });

    const { result } = renderHook(() => useSignOutMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(queryClient.getQueryData(authQueryKeys.session)).toBeNull();
  });
});
