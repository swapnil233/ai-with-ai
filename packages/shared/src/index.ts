// Shared types for API contracts

// User types
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Session types (better-auth)
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Account types (better-auth)
export interface Account {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  idToken: string | null;
  password: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

// Chat types
export interface Chat {
  id: string;
  projectId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export interface SendMessageInput {
  chatId: string;
  content: string;
}

// Sandbox types
export type SandboxStatus = "pending" | "creating" | "running" | "stopped" | "error";

export interface Sandbox {
  id: string;
  projectId: string;
  modalId: string | null;
  tunnelUrl: string | null;
  status: SandboxStatus;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// WebSocket event types
export type WebSocketEvent =
  | { type: "message"; payload: Message }
  | { type: "file_change"; payload: FileChange }
  | { type: "terminal_output"; payload: TerminalOutput }
  | { type: "preview_update"; payload: PreviewUpdate };

export interface FileChange {
  path: string;
  content: string;
  action: "create" | "update" | "delete";
}

export interface TerminalOutput {
  sessionId: string;
  output: string;
  isError: boolean;
}

export interface PreviewUpdate {
  url: string;
  status: "loading" | "ready" | "error";
}

// Constants
export const API_VERSION = "v1";
export const MAX_MESSAGE_LENGTH = 10000;
export const MAX_PROJECT_NAME_LENGTH = 100;
