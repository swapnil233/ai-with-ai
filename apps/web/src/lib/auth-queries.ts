import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient, signIn, signOut, signUp, useSession } from "@/lib/auth-client";

const UNAUTHORIZED_STATUS_CODE = 401;
const FORBIDDEN_STATUS_CODE = 403;

const authQueryKeys = {
  session: ["auth", "session"] as const,
};

export type AuthSession = NonNullable<ReturnType<typeof useSession>["data"]>;

interface SignInInput {
  email: string;
  password: string;
}

interface SignUpInput {
  email: string;
  name: string;
  password: string;
}

const getErrorMessage = (message: string | undefined, fallback: string) => {
  if (message && message.trim().length > 0) {
    return message;
  }
  return fallback;
};

const fetchSession = async (): Promise<AuthSession | null> => {
  const result = await authClient.getSession();

  if (result.error) {
    const isUnauthorized =
      result.error.status === UNAUTHORIZED_STATUS_CODE ||
      result.error.status === FORBIDDEN_STATUS_CODE;

    if (isUnauthorized) {
      return null;
    }

    throw new Error(getErrorMessage(result.error.message, "Failed to fetch session"));
  }

  return result.data;
};

export const useAuthSessionQuery = () =>
  useQuery<AuthSession | null, Error>({
    queryFn: fetchSession,
    queryKey: authQueryKeys.session,
  });

export const useSignInMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, SignInInput>({
    mutationFn: async (credentials) => {
      const result = await signIn.email(credentials);

      if (result.error) {
        throw new Error(getErrorMessage(result.error.message, "Failed to sign in"));
      }

      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.session });
    },
  });
};

export const useSignUpMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, SignUpInput>({
    mutationFn: async (payload) => {
      const result = await signUp.email(payload);

      if (result.error) {
        throw new Error(getErrorMessage(result.error.message, "Failed to create account"));
      }

      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.session });
    },
  });
};

export const useSignOutMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const result = await signOut();

      if (result.error) {
        throw new Error(getErrorMessage(result.error.message, "Failed to sign out"));
      }

      return result.data;
    },
    onSuccess: async () => {
      queryClient.setQueryData(authQueryKeys.session, null);
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.session });
    },
  });
};

export { authQueryKeys };
