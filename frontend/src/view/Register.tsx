import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useAppDispatch } from "../store/hooks";
import { setCredentials } from "../store/authSlice";
import { notifyAuthChanged } from "../utils/token";

import { registerThenLoginWithProfile } from "../api/auth";

import "../styles/Register.css";

type RegisterFormState = {
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  password: string;
};

function isSafePath(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const Register: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState<RegisterFormState>({
    first_name: "",
    last_name: "",
    phone_number: "",
    email: "",
    password: "",
  });

  const [fieldError, setFieldError] = useState<
    Partial<Record<keyof RegisterFormState, string>>
  >({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextParam = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawNext = params.get("next");
    return isSafePath(rawNext) ? rawNext : null;
  }, [location.search]);

  const safeNextQuery = nextParam ? `?next=${encodeURIComponent(nextParam)}` : "";

  const firstNameErrorId = "register-first-name-error";
  const lastNameErrorId = "register-last-name-error";
  const phoneErrorId = "register-phone-error";
  const emailErrorId = "register-email-error";
  const passwordErrorId = "register-password-error";
  const serverErrorId = "register-server-error";

  const getRegisterErrorMessage = (error: unknown): string => {
    if (!isAxiosError(error)) {
      return t("register.errors.network");
    }

    const status = error.response?.status;
    const data = error.response?.data;

    if (isRecord(data)) {
      const detail = data.detail;
      if (typeof detail === "string" && detail.trim()) {
        return detail.trim();
      }

      const keys = [
        "email",
        "password",
        "phone_number",
        "first_name",
        "last_name",
        "non_field_errors",
      ] as const;

      for (const key of keys) {
        const value = data[key];

        if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
          return value[0];
        }

        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }

    if (status === 400) {
      return t("register.errors.invalidForm");
    }

    return t("register.errors.failed");
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof RegisterFormState, string>> = {};

    if (!form.first_name.trim()) {
      errors.first_name = t("register.errors.firstNameRequired");
    }

    if (!form.last_name.trim()) {
      errors.last_name = t("register.errors.lastNameRequired");
    }

    const phone = form.phone_number.trim();
    if (!phone) {
      errors.phone_number = t("register.errors.phoneRequired");
    } else if (!/^\+?[0-9\s().-]{7,20}$/.test(phone)) {
      errors.phone_number = t("register.errors.phoneInvalid");
    }

    const email = form.email.trim();
    if (!email) {
      errors.email = t("register.errors.emailRequired");
    } else if (!email.includes("@")) {
      errors.email = t("register.errors.emailInvalid");
    }

    if (!form.password) {
      errors.password = t("register.errors.passwordRequired");
    } else if (form.password.length < 8) {
      errors.password = t("register.errors.passwordMin");
    }

    setFieldError(errors);

    return Object.keys(errors).length === 0;
  };

  const handleFieldChange =
    (key: keyof RegisterFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const value = event.target.value;

      setForm((prev) => ({
        ...prev,
        [key]: value,
      }));

      // Clear field-level and form-level errors as the user corrects input.
      setFieldError((prev) => ({
        ...prev,
        [key]: undefined,
      }));
      setServerError(null);
    };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const { user, tokens } = await registerThenLoginWithProfile({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone_number: form.phone_number.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      const access = String(tokens.access || "").trim();
      const refresh = tokens.refresh ? String(tokens.refresh).trim() : "";

      if (!access) {
        setServerError(t("register.errors.loginAfterRegisterFailed"));
        navigate(`/login${safeNextQuery}`, { replace: true });
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
      setServerError(getRegisterErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="register" aria-labelledby="register-title">
      <div className="register__layout">
        <section className="register__panel" aria-label={t("register.pageLabel")}>
          <header className="register__header">
            <p className="register__eyebrow">KFursenko Candles</p>

            <h1 id="register-title" className="register__title">
              {t("register.title")}
            </h1>

            <p className="register__subtitle">{t("register.subtitle")}</p>
          </header>

          <form className="register__form" onSubmit={onSubmit} noValidate>
            <div className="register__grid">
              <div className="register__field">
                <label className="register__label" htmlFor="reg_first_name">
                  {t("register.firstName")}
                </label>

                <input
                  id="reg_first_name"
                  className="register__input"
                  type="text"
                  autoComplete="given-name"
                  value={form.first_name}
                  onChange={handleFieldChange("first_name")}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldError.first_name)}
                  aria-describedby={fieldError.first_name ? firstNameErrorId : undefined}
                />

                {fieldError.first_name ? (
                  <p
                    id={firstNameErrorId}
                    className="register__message register__message--error"
                    role="alert"
                  >
                    {fieldError.first_name}
                  </p>
                ) : null}
              </div>

              <div className="register__field">
                <label className="register__label" htmlFor="reg_last_name">
                  {t("register.lastName")}
                </label>

                <input
                  id="reg_last_name"
                  className="register__input"
                  type="text"
                  autoComplete="family-name"
                  value={form.last_name}
                  onChange={handleFieldChange("last_name")}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldError.last_name)}
                  aria-describedby={fieldError.last_name ? lastNameErrorId : undefined}
                />

                {fieldError.last_name ? (
                  <p
                    id={lastNameErrorId}
                    className="register__message register__message--error"
                    role="alert"
                  >
                    {fieldError.last_name}
                  </p>
                ) : null}
              </div>

              <div className="register__field register__field--full">
                <label className="register__label" htmlFor="reg_phone">
                  {t("register.phone")}
                </label>

                <input
                  id="reg_phone"
                  className="register__input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone_number}
                  onChange={handleFieldChange("phone_number")}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldError.phone_number)}
                  aria-describedby={fieldError.phone_number ? phoneErrorId : undefined}
                />

                {fieldError.phone_number ? (
                  <p
                    id={phoneErrorId}
                    className="register__message register__message--error"
                    role="alert"
                  >
                    {fieldError.phone_number}
                  </p>
                ) : null}
              </div>

              <div className="register__field register__field--full">
                <label className="register__label" htmlFor="reg_email">
                  {t("register.email")}
                </label>

                <input
                  id="reg_email"
                  className="register__input"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleFieldChange("email")}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldError.email)}
                  aria-describedby={fieldError.email ? emailErrorId : undefined}
                />

                {fieldError.email ? (
                  <p
                    id={emailErrorId}
                    className="register__message register__message--error"
                    role="alert"
                  >
                    {fieldError.email}
                  </p>
                ) : null}
              </div>

              <div className="register__field register__field--full">
                <label className="register__label" htmlFor="reg_password">
                  {t("register.password")}
                </label>

                <input
                  id="reg_password"
                  className="register__input"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleFieldChange("password")}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldError.password)}
                  aria-describedby={fieldError.password ? passwordErrorId : undefined}
                />

                {fieldError.password ? (
                  <p
                    id={passwordErrorId}
                    className="register__message register__message--error"
                    role="alert"
                  >
                    {fieldError.password}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="register__actions">
              <button
                type="submit"
                className="register__cta register__cta--primary"
                disabled={submitting}
              >
                {submitting ? t("register.creating") : t("register.register")}
              </button>

              <Link
                to={`/login${safeNextQuery}`}
                className="register__cta register__cta--secondary"
              >
                {t("register.logIn")}
              </Link>
            </div>

            {serverError ? (
              <div
                id={serverErrorId}
                className="register__message register__message--server"
                role="alert"
                aria-live="polite"
              >
                {serverError}
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </main>
  );
};

export default Register;