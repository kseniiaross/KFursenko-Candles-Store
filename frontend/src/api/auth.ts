import api from "../api/axiosInstance";

export type RegisterPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
};

export type TokenPayload = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access: string;
  refresh: string;
};

export type ProfileResponse = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_staff?: boolean;
};

export async function register(payload: RegisterPayload): Promise<ProfileResponse> {
  const response = await api.post<ProfileResponse>("/accounts/register/", payload);
  return response.data;
}

export async function login(payload: TokenPayload): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/accounts/login/", payload);
  return response.data;
}

export async function getProfile(accessToken?: string): Promise<ProfileResponse> {
  const response = await api.get<ProfileResponse>("/accounts/profile/", {
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  return response.data;
}

export async function loginWithProfile(
  payload: TokenPayload
): Promise<{
  tokens: TokenResponse;
  user: ProfileResponse;
}> {
  const tokens = await login(payload);
  const user = await getProfile(tokens.access);

  return {
    tokens,
    user,
  };
}

export async function registerThenLoginWithProfile(
  payload: RegisterPayload
): Promise<{
  user: ProfileResponse;
  tokens: TokenResponse;
}> {
  await register(payload);

  const tokens = await login({
    email: payload.email,
    password: payload.password,
  });

  const user = await getProfile(tokens.access);

  return {
    user,
    tokens,
  };
}