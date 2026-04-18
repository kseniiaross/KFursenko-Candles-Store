import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import loginLightBg from "../assets/images/lightmode.jpg";
import loginDarkBg from "../assets/images/darkmode.jpg";

import "../styles/LoginChoice.css";

function isSafePath(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

const LoginChoice: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const nextParam = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawNext = params.get("next");
    const safeNext = isSafePath(rawNext) ? rawNext : null;

    return safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
  }, [location.search]);

  return (
    <main
      className="loginChoice"
      aria-labelledby="login-choice-title"
      style={
        {
          "--login-choice-light-bg": `url(${loginLightBg})`,
          "--login-choice-dark-bg": `url(${loginDarkBg})`,
        } as React.CSSProperties
      }
    >
      <section
        className="loginChoice__container"
        aria-describedby="login-choice-subtitle"
      >
        <header className="loginChoice__header">
          <h1 id="login-choice-title" className="loginChoice__title">
            {t("loginChoice.title")}
          </h1>

          <p id="login-choice-subtitle" className="loginChoice__subtitle">
            {t("loginChoice.subtitle")}
          </p>
        </header>

        <nav
          className="loginChoice__buttons"
          aria-label={t("loginChoice.pageLabel")}
        >
          {/* Safe internal redirect is preserved through nextParam */}
          <Link
            to={`/login${nextParam}`}
            className="loginChoice__btn loginChoice__btn--primary"
          >
            {t("loginChoice.login")}
          </Link>

          <Link
            to={`/register${nextParam}`}
            className="loginChoice__btn loginChoice__btn--secondary"
          >
            {t("loginChoice.register")}
          </Link>
        </nav>
      </section>
    </main>
  );
};

export default LoginChoice;