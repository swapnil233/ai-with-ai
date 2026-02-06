import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";

// Hoisted mocks
const { mockPush, mockRefresh, mockMutateAsync, mockUseSignInMutation } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockUseSignInMutation: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock auth queries
vi.mock("@/lib/auth-queries", () => ({
  useSignInMutation: () => mockUseSignInMutation(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSignInMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it("renders login form", () => {
    render(<LoginPage />);

    expect(
      screen.getByText(/welcome back/i, { selector: "[data-slot='card-title']" })
    ).toBeDefined();
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDefined();
  });

  it("shows link to signup page", () => {
    render(<LoginPage />);

    const signupLink = screen.getByRole("link", { name: /sign up/i });
    expect(signupLink).toBeDefined();
    expect(signupLink.getAttribute("href")).toBe("/signup");
  });

  it("submits form with email and password", async () => {
    mockMutateAsync.mockResolvedValueOnce({ user: { id: "1" } });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("redirects to home on successful login", async () => {
    mockMutateAsync.mockResolvedValueOnce({ user: { id: "1" } });

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows error message on failed login", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Invalid credentials"));

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeDefined();
    });
  });

  it("disables form while loading", () => {
    mockUseSignInMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });

    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDefined();
  });
});
