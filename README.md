# KFursenko Candles Store

KFursenko Candles Store is a modern e-commerce platform for handcrafted candles, designed to deliver a premium shopping experience with a focus on clarity, trust, and performance.

The application is built as a production-ready product, combining a clean, minimal interface with a scalable architecture and secure data handling. The goal is not only to present products, but to guide users through a smooth and intuitive purchasing journey — from discovery to checkout.

Live link: https://www.kfcandle.com

---

## Preview

### Homepage
![Homepage](./assets/preview/home.png)

### Product Catalog
![Catalog](./assets/preview/catalog.png)

### Product Detail
![Product](./assets/preview/product.png)

### AI Recommendation System
![AI](./assets/preview/ai.png)

### Cart & Checkout
![Cart](./assets/preview/cart.png)

## Product Experience

The platform is designed around real user behavior and expectations in modern e-commerce:

- Clear product presentation with structured catalog and filtering
- Fast navigation with minimal friction between pages
- Consistent UI across all devices
- Seamless add-to-cart and checkout flow
- Interface that responds instantly to user actions with clear feedback
- Stable performance as product data grows

Each interaction is intentionally simplified to reduce cognitive load, improve usability, and increase conversion.

---

## Personalization

The platform enhances product discovery through a combination of an interactive quiz and an AI-powered assistant.

Users can take a guided quiz to identify their scent preferences, allowing the system to recommend products that match their taste instead of relying on random browsing.

In addition, an AI assistant is integrated to support users in real time. It answers questions, suggests relevant products, and helps users navigate the catalog more efficiently.

This combination of guided discovery and real-time assistance reduces decision fatigue, increases user confidence, and creates a more personalized shopping experience.

---

## Security and Data Handling

Security is treated as a core part of the product, not an afterthought.

- Authentication is implemented using JWT (access and refresh tokens)
- Tokens are securely stored and automatically refreshed
- Sensitive operations are protected through backend validation
- No payment data is stored on the client side
- Payment processing is designed to be handled by Stripe (PCI-compliant)

This approach ensures that user data is protected and the system is ready for real-world usage.

---

## Performance and Reliability

The application is optimized to provide a fast and stable experience:

- Efficient state management using Redux Toolkit
- Optimized API communication through a centralized Axios instance
- Automatic token refresh without interrupting user sessions
- Clean and modular component architecture
- Production build optimized with Vite

The system is designed to scale without degrading performance or user experience.

---

## Architecture

The project follows a full-stack architecture with clear separation of concerns.

Frontend:
- React with TypeScript
- Redux Toolkit for state management
- React Router for navigation
- Axios with interceptors for API handling

Backend:
- Django REST Framework
- PostgreSQL database
- Token-based authentication (JWT)

This structure allows the product to evolve easily, supporting future features such as payments, analytics, and admin tools.

---

## Accessibility

Accessibility is treated as a core product requirement rather than a compliance checkbox.

The platform is designed with WCAG 2.1 and Section 508 standards in mind, ensuring that users with different abilities can interact with the product without barriers.

Key accessibility considerations include:

- Semantic HTML structure for screen reader compatibility
- Full keyboard navigation support
- Proper focus management and visible focus states
- ARIA attributes to enhance assistive technology support
- High-contrast UI in both light and dark modes

The AI assistant also includes voice support, allowing users to interact with the system through audio. This extends usability beyond traditional visual interfaces and makes the experience more inclusive.

Accessibility decisions are integrated into the development process from the start, improving usability for all users.

---

## Business Value

This project demonstrates the ability to build a real-world e-commerce product focused on measurable outcomes:

- Improving product discovery through personalization
- Reducing friction in the purchase flow
- Ensuring secure handling of user data
- Building a scalable and maintainable frontend architecture
- Delivering a production-ready user experience

The result is not a demo application, but a functional foundation for a commercial product.

---

## Author

Kseniia Rostovskaia  
Frontend Developer

Portfolio: https://kseniiaross.dev  
LinkedIn: https://www.linkedin.com/in/kseniia-rostovskaia
