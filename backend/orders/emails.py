from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


def send_order_confirmation_email(order):
    user_email = getattr(order.user, "email", "")

    if not user_email:
        return

    subject = f"Order #{order.id} confirmation"

    context = {
        "order": order,
        "user": order.user,
        "items": order.items.all(),
        "frontend_url": getattr(settings, "FRONTEND_URL", ""),
        "support_email": getattr(settings, "SUPPORT_EMAIL", ""),
    }

    text_body = render_to_string("emails/orders/order_confirmation.txt", context)

    try:
        html_body = render_to_string("emails/orders/order_confirmation.html", context)
    except Exception:
        html_body = None

    email = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user_email],
    )

    if html_body:
        email.attach_alternative(html_body, "text/html")

    email.send(fail_silently=False)