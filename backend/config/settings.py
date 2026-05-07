from pathlib import Path
from datetime import timedelta
import os  
import dj_database_url
from decouple import config
import cloudinary


# ------------------------------------------------------------
# Paths
# ------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent


# ------------------------------------------------------------
# Core security
# ------------------------------------------------------------
SECRET_KEY = config(
    "SECRET_KEY",
    default="django-insecure-+u3x!jorapg=_t+61hsh4$n-7qlyk6wclxyz(x3mjksw^3vz$v",
)

DEBUG = config("DEBUG", default=False, cast=bool)

ALLOWED_HOSTS = [
    h.strip()
    for h in config("ALLOWED_HOSTS", default="localhost,127.0.0.1").split(",")
    if h.strip()
]


# ------------------------------------------------------------
# Frontend / CORS / CSRF
# ------------------------------------------------------------
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:5173").rstrip("/")

# Дополнительные origins (для dev/staging)
# Пример:
# EXTRA_CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
EXTRA_CORS_ORIGINS = [
    o.strip().rstrip("/")
    for o in config("EXTRA_CORS_ORIGINS", default="").split(",")
    if o.strip()
]


def _with_www_variants(url: str) -> list[str]:
    return [
        url,
        url.replace("://www.", "://"),
        url.replace("://", "://www."),
    ]


CORS_ALLOWED_ORIGINS: list[str] = []

for origin in _with_www_variants(FRONTEND_URL):
    if origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(origin)

for origin in EXTRA_CORS_ORIGINS:
    for v in _with_www_variants(origin):
        if v not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(v)

# Vercel preview deployments
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https:\/\/.*\.vercel\.app$",
]

CORS_ALLOW_CREDENTIALS = config("CORS_ALLOW_CREDENTIALS", default=False, cast=bool)

# CSRF (актуально, если будут cookie-сессии; с JWT обычно не требуется,
# но пусть будет корректно)
CSRF_TRUSTED_ORIGINS: list[str] = []
for origin in CORS_ALLOWED_ORIGINS:
    if origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)


# ------------------------------------------------------------
# OpenAI (Lumière)
# ------------------------------------------------------------
OPENAI_API_KEY = config("OPENAI_API_KEY", default="", cast=str).strip()
OPENAI_MODEL = config("OPENAI_MODEL", default="gpt-4.1-mini", cast=str).strip()
OPENAI_TIMEOUT_SECONDS = config("OPENAI_TIMEOUT_SECONDS", default=20, cast=int)


# ------------------------------------------------------------
# Applications
# ------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "django_filters",
    "rest_framework",
    "drf_spectacular",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "cloudinary",
    "cloudinary_storage",
    "accounts",
    "candles",
    "cart",
    "orders",
    "newsletter",
    "lumiere", 
]


# ------------------------------------------------------------
# Middleware
# ------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "config.urls"


# ------------------------------------------------------------
# Templates
# ------------------------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]


WSGI_APPLICATION = "config.wsgi.application"


# ------------------------------------------------------------
# Database
# ------------------------------------------------------------
DATABASE_URL = config("DATABASE_URL", default="", cast=str).strip()

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=config("DB_CONN_MAX_AGE", default=60, cast=int),
            ssl_require=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME", default="candles_db"),
            "USER": config("DB_USER", default="candles_user"),
            "PASSWORD": config("DB_PASSWORD", default="candles_pass"),
            "HOST": config("DB_HOST", default="127.0.0.1"),
            "PORT": config("DB_PORT", default="5433"),
            "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", default=60, cast=int),
        }
    }


# ------------------------------------------------------------
# Auth / User model
# ------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"


# ------------------------------------------------------------
# Password validation
# ------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# ------------------------------------------------------------
# I18N / TZ
# ------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ------------------------------------------------------------
# Static / Media
# ------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

WHITENOISE_MANIFEST_STRICT = False


# ------------------------------------------------------------
# DRF / Swagger
# ------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": config("THROTTLE_ANON", default="60/min"),
        "user": config("THROTTLE_USER", default="300/min"),
        "orders_create": config("THROTTLE_ORDERS_CREATE", default="10/min"),
        "stripe_intent_anon": config("THROTTLE_STRIPE_INTENT_ANON", default="5/min"),
        "stripe_intent_user": config("THROTTLE_STRIPE_INTENT_USER", default="20/min"),
        "lumiere_anon": config("THROTTLE_LUMIERE_ANON", default="20/min"),
        "lumiere_user": config("THROTTLE_LUMIERE_USER", default="60/min"),
        "lumiere_search": config("THROTTLE_LUMIERE_SEARCH", default="30/min"),
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "KFursenko Candles API",
    "DESCRIPTION": "API for candles catalog, cart, orders, and Lumière assistant.",
    "VERSION": "1.0.0",
}


# ------------------------------------------------------------
# JWT (SimpleJWT)
# ------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("ACCESS_TOKEN_MINUTES", default=15, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("REFRESH_TOKEN_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# ------------------------------------------------------------
# Email
# ------------------------------------------------------------
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.smtp.EmailBackend",
).strip()

DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="no-reply@example.com")
SUPPORT_EMAIL = config("SUPPORT_EMAIL", default="support@example.com")

EMAIL_HOST = config("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_TIMEOUT = config("EMAIL_TIMEOUT", default=10, cast=int)

if not DEBUG and (not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD):
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"


# ------------------------------------------------------------
# Stripe
# ------------------------------------------------------------
USE_STRIPE = config("USE_STRIPE", default=False, cast=bool)
STRIPE_PUBLIC_KEY = config("STRIPE_PUBLIC_KEY", default="")
STRIPE_SECRET_KEY = config("STRIPE_SECRET_KEY", default="")
STRIPE_WEBHOOK_SECRET = config("STRIPE_WEBHOOK_SECRET", default="")


# ------------------------------------------------------------
# Production security headers
# ------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True

    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_HTTPONLY = False

    X_FRAME_OPTIONS = "DENY"

    SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=3600, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = False

    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"


# ------------------------------------------------------------
# Logging
# ------------------------------------------------------------
LOG_LEVEL = config("LOG_LEVEL", default="INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
}


# ------------------------------------------------------------
# Cloudinary
# ------------------------------------------------------------
cloudinary.config(secure=True)