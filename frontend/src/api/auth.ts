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

export async function register(
  payload: RegisterPayload
): Promise<ProfileResponse> {
  const response = await api.post<ProfileResponse>("/accounts/register/", payload);
  return response.data;
}

export async function login(
  payload: TokenPayload
): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/accounts/login/", payload);
  return response.data;
}

export async function getProfile(): Promise<ProfileResponse> {
  const response = await api.get<ProfileResponse>("/accounts/profile/");
  return response.data;
}

export async function loginWithProfile(
  payload: TokenPayload
): Promise<{
  tokens: TokenResponse;
  user: ProfileResponse;
}> {
  const tokens = await login(payload);

  localStorage.setItem("accessToken", tokens.access);
  localStorage.setItem("refreshToken", tokens.refresh);

  try {
    const user = await getProfile();

    return {
      tokens,
      user,
    };
  } catch (error) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    throw error;
  }
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

  localStorage.setItem("accessToken", tokens.access);
  localStorage.setItem("refreshToken", tokens.refresh);

  try {
    const user = await getProfile();

    return {
      user,
      tokens,
    };
  } catch (error) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    throw error;
  }
}