import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useAppDispatch } from "../store/hooks";
import { setCredentials } from "../store/authSlice";
import { notifyAuthChanged } from "../utils/token";
import { loginWithProfile } from "../api/auth";

import "../styles/Login.css";

type LoginFormState = {
  email: string;
  password: string;
};

/*
Security helper:
Ensures redirect paths are internal and prevents open redirect attacks.
Example:
✔ /orders
✖ https://evil.com
*/
function isSafePath(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

const Login: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState<LoginFormState>({
    email: "",
    password: "",
  });

  const [fieldError, setFieldError] = useState<{
    email?: string;
    password?: string;
  }>({});

  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextParam = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawNext = params.get("next");
    return isSafePath(rawNext) ? rawNext : null;
  }, [location.search]);

  const safeNextQuery = nextParam
    ? `?next=${encodeURIComponent(nextParam)}`
    : "";

  const getLoginErrorMessage = (error: unknown): string => {
    if (!isAxiosError(error)) {
      return t("login.errors.network");
    }

    const status = error.response?.status;

    if (status === 401 || status === 400) {
      return t("login.errors.invalidCredentials");
    }

    const data = error.response?.data;

    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail?: unknown }).detail;

      if (typeof detail === "string" && detail.trim()) {
        return detail.trim();
      }
    }

    return t("login.errors.generic");
  };

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const email = form.email.trim();

    if (!email) {
      errors.email = t("login.errors.emailRequired");
    } else if (!email.includes("@")) {
      errors.email = t("login.errors.emailInvalid");
    }

    if (!form.password) {
      errors.password = t("login.errors.passwordRequired");
    }

    setFieldError(errors);

    return Object.keys(errors).length === 0;
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      const { tokens, user } = await loginWithProfile({
        email: form.email.trim(),
        password: form.password,
      });

      const access = String(tokens?.access || "").trim();
      const refresh = String(tokens?.refresh || "").trim();

      if (!access) {
        setServerError(t("login.errors.loginFailed"));
        return;
      }

      dispatch(
        setCredentials({
          access,
          refresh: refresh || undefined,
          user,
        })
      );

      notifyAuthChanged();

      navigate(nextParam ?? "/", { replace: true });
    } catch (error: unknown) {
      setServerError(getLoginErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login" aria-labelledby="login-title">
      <div className="login__container">

        <header className="login__header">
          <h1 id="login-title" className="login__title">
            {t("login.title")}
          </h1>

          <p className="login__subtitle">
            {t("login.subtitle")}
          </p>
        </header>

        <form
          className="login__form"
          onSubmit={onSubmit}
          noValidate
          aria-describedby={serverError ? "login-server-error" : undefined}
        >

          {/* EMAIL FIELD */}

          <div className="login__field">
            <label htmlFor="login_email" className="login__label">
              {t("login.email")}
            </label>

            <input
              id="login_email"
              type="email"
              className="login__input"
              autoComplete="email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
              aria-invalid={Boolean(fieldError.email)}
              aria-describedby={fieldError.email ? "login-email-error" : undefined}
              disabled={submitting}
            />

            {fieldError.email && (
              <p id="login-email-error" className="login__error">
                {fieldError.email}
              </p>
            )}
          </div>

          {/* PASSWORD FIELD */}

          <div className="login__field">
            <label htmlFor="login_password" className="login__label">
              {t("login.password")}
            </label>

            <input
              id="login_password"
              type="password"
              className="login__input"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              aria-invalid={Boolean(fieldError.password)}
              aria-describedby={fieldError.password ? "login-password-error" : undefined}
              disabled={submitting}
            />

            {fieldError.password && (
              <p id="login-password-error" className="login__error">
                {fieldError.password}
              </p>
            )}
          </div>

          {/* ACTIONS */}

          <div className="login__actions">

            <button
              type="submit"
              className="login__button login__button--primary"
              disabled={submitting}
            >
              {submitting ? t("login.loggingIn") : t("login.title")}
            </button>

            <Link
              to={`/register${safeNextQuery}`}
              className="login__button login__button--secondary"
            >
              {t("login.register")}
            </Link>

          </div>

          {serverError && (
            <div
              id="login-server-error"
              className="login__serverError"
              role="alert"
            >
              {serverError}
            </div>
          )}

        </form>
      </div>
    </main>
  );
};

export default Login;