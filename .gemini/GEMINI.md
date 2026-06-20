This project, "Faces of Plants," is a comprehensive multi-source biodiversity data platform. To ensure its long-term maintainability, scalability, and extensibility, here is a reference documentation outlining its architecture, technology stack, and core development principles.

For detailed guides on setup, development, deployment, and specific modules, please refer to the comprehensive documentation in the `docs/` directory.

---

**Faces of Plants: Future-Proofing Reference Documentation**

This document provides a high-level overview of the Faces of Plants project's architecture, technology stack, and core development principles. Its purpose is to serve as a quick reference for new and existing teams, ensuring consistent development practices that contribute to the long-term maintainability, scalability, and extensibility of the codebase.

For detailed guides on setup, development, deployment, and specific modules, please refer to the comprehensive documentation in the `docs/` directory.

**1. Project Overview & Architecture**
*   **Purpose:** To provide the world's most comprehensive multi-source biodiversity data platform.
*   **Monorepo Structure:** The project utilizes a pnpm workspace setup, which allows for managing multiple interdependent packages within a single repository. This facilitates code sharing, consistent dependency management, and streamlined development across different parts of the application.
*   **Core Architectural Principles:**
    *   **Serverless First:** The backend leverages AWS Lambda functions and DynamoDB, orchestrated through SST, to provide a scalable and cost-effective serverless architecture.
    *   **Separation of Concerns:** A clear distinction is maintained between the frontend (Next.js), backend functions (AWS Lambda), shared core logic, and infrastructure definitions.
    *   **Infrastructure as Code (IaC):** All cloud infrastructure is defined, provisioned, and managed declaratively using SST, ensuring consistency, repeatability, and version control of the environment.
    *   **Modular Design:** Components and services are designed to be independent and reusable, promoting maintainability and extensibility.

**2. Technology Stack**
*   **Monorepo Management:** `pnpm`
*   **Infrastructure:** `SST v3` (built on AWS CDK/Pulumi)
*   **Frontend:** `Next.js 15`, `React 19`, `TypeScript`, `Tailwind CSS`
*   **Backend (Functions):** `AWS Lambda`, `TypeScript`
*   **Database:** `AWS DynamoDB`
*   **Authentication:** `AWS Cognito`, `NextAuth.js` (with DynamoDB adapter)
*   **Shared Logic:** `@faces-of-plants/core` (TypeScript)
*   **Testing:** `Jest` (for `packages/core`), `Vitest` (for `packages/functions`), `Next.js Lint` (for `packages/web`)

**3. Project Structure (Key Directories)**
*   `docs/`: Contains comprehensive project documentation, including getting started guides, architecture overviews, development guidelines, API references, and deployment instructions. **Always refer here for detailed guides.**
*   `infra/`: Houses SST constructs for defining reusable AWS resources (e.g., API Gateway, Lambda functions, DynamoDB tables).
*   `packages/`: This directory contains the pnpm workspaces:
    *   `core/`: Contains reusable types, interfaces, and core business logic shared across the monorepo.
    *   `functions/`: Contains AWS Lambda functions, organized by domain (e.g., `api/` for general API endpoints, `eol/`, `gbif/`, `inaturalist/` for specific data source providers).
    *   `web/`: Contains the Next.js frontend application.
*   `scripts/`: Contains utility shell scripts for common development and deployment tasks (e.g., `deploy.sh`, `cleanup-infrastructure.sh`).
*   `stacks/`: Defines the SST stack configurations, composing the `infra/` constructs into deployable units.

**4. Development Guidelines for Future-Proofing**
*   **Adherence to Conventions:**
    *   **Code Style:** Strictly follow the established ESLint, Prettier, and TypeScript configurations. Regularly run `pnpm lint` and `pnpm format` to ensure code consistency.
    *   **Naming:** Maintain consistent naming conventions for files, variables, functions, and components across the entire codebase.
    *   **Modularity:** Design new features as independent modules or services with well-defined interfaces. Avoid tight coupling between components.
*   **Testing Strategy:**
    *   **Unit Tests:** Write comprehensive unit tests for all new business logic, especially within `packages/core` and `packages/functions`. Utilize Jest and Vitest as appropriate.
    *   **Integration Tests:** Implement integration tests for critical data flows, particularly for API endpoints and external data source integrations.
    *   **End-to-End (E2E) Tests:** Consider implementing E2E tests for key user journeys in the frontend to ensure overall system functionality.
    *   **Test Coverage:** Strive for high test coverage, prioritizing critical paths and complex logic.
*   **Infrastructure as Code (IaC) Best Practices:**
    *   **Declarative:** All infrastructure changes must be defined declaratively in `infra/` and `stacks/` using SST. Avoid manual modifications via the AWS console.
    *   **Modularity:** Break down infrastructure definitions into logical, reusable constructs to promote clarity and reusability.
    *   **Version Control:** All infrastructure changes must be committed to version control alongside code changes.
    *   **Stage Management:** Leverage SST stages (`dev`, `staging`, `production`) to maintain distinct and isolated environments.
*   **API Design Principles:**
    *   **RESTful/GraphQL (as applicable):** Adhere to established patterns for API design (e.g., RESTful principles for HTTP APIs).
    *   **Versioning:** Plan for API versioning from the outset if breaking changes are anticipated in the future.
    *   **Clear Contracts:** Define clear input/output contracts for all API endpoints and internal service interactions.
*   **Observability:**
    *   **Logging:** Implement structured logging for all functions and services to facilitate debugging and monitoring.
    *   **Monitoring:** Ensure key metrics and alarms are configured for critical components to proactively identify issues.
    *   **Tracing:** Utilize distributed tracing where possible to gain end-to-end visibility into request flows across services.
*   **Security:**
    *   **Least Privilege:** Grant only the minimum necessary permissions to AWS resources.
    *   **Input Validation:** Rigorously validate all user inputs to prevent common security vulnerabilities.
    *   **Dependency Management:** Regularly update dependencies and scan for known vulnerabilities.
    *   **Refer to `docs/security.md` for detailed security guidelines.**
*   **Documentation:**
    *   **Self-Documenting Code:** Write clean, readable code with meaningful names for variables, functions, and classes.
    *   **Inline Comments:** Use comments sparingly, primarily for explaining *why* complex logic exists or *why* a particular design choice was made, rather than *what* the code does.
    *   **External Documentation:** Any significant new features, architectural changes, or breaking changes must be documented and updated in the `docs/` directory.

**5. Contribution Workflow**
*   **Branching Strategy:** (e.g., Feature branches, pull requests into `main` or `develop`).
*   **Pull Requests:** All code changes must go through a pull request process and require code reviews from at least one other team member.
*   **CI/CD:** Ensure all changes pass continuous integration checks (linting, tests, build) before being merged into the main branch.

---