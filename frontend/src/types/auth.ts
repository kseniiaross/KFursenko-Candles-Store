export type User = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
};

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isLoggedIn: boolean;
};