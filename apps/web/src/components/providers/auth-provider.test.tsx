import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth-provider";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock auth query hook
const mockUseAuthSessionQuery = vi.fn();
vi.mock("@/lib/auth-queries", () => ({
  useAuthSessionQuery: () => mockUseAuthSessionQuery(),
}));

// Test component that uses useAuth
function TestConsumer() {
  const { session, isPending, error } = useAuth();

  if (isPending) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (session) return <div>Logged in as: {session.user?.email}</div>;
  return <div>Not logged in</div>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides loading state", () => {
    mockUseAuthSessionQuery.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it("provides session data when authenticated", () => {
    mockUseAuthSessionQuery.mockReturnValue({
      data: {
        user: { email: "test@example.com" },
        session: { id: "session-123" },
      },
      isPending: false,
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByText(/logged in as: test@example.com/i)).toBeDefined();
  });

  it("provides null session when not authenticated", () => {
    mockUseAuthSessionQuery.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByText(/not logged in/i)).toBeDefined();
  });

  it("provides error state", () => {
    mockUseAuthSessionQuery.mockReturnValue({
      data: null,
      isPending: false,
      error: { message: "Session expired" },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByText(/error: session expired/i)).toBeDefined();
  });

  it("refreshes router when session changes", () => {
    mockUseAuthSessionQuery.mockReturnValue({
      data: { user: { email: "test@example.com" } },
      isPending: false,
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(mockRefresh).toHaveBeenCalled();
  });
});

describe("useAuth", () => {
  it("throws error when used outside AuthProvider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within an AuthProvider");

    consoleSpy.mockRestore();
  });
});
