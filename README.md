
# Piravel OS

**Open-source agency operations, client management, and financial workflow platform.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/burakuruk/piravel-os/actions/workflows/ci.yml/badge.svg)](https://github.com/burakuruk/piravel-os/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)

Piravel OS is a TypeScript-based, single-tenant business management platform designed to bring client relationships, contracts, financial records, and agency operations into a unified system.

The project explores practical approaches to building secure, auditable, and maintainable business software using modern open-source technologies.

**Status:** Active development — version 0.1.0. Core infrastructure, authentication, client management, and contract workflows have been developed. Additional financial and operational modules are planned.

> **Project maturity:** Piravel OS is an evolving open-source project, not a production-ready general-purpose ERP. Review its security and dependencies before deploying it with real business data.

## Why Piravel OS?

Small agencies often manage important business processes across spreadsheets, messaging applications, email, and disconnected tools.

This creates recurring challenges:

- Fragmented client and contract information
- Limited visibility into upcoming payments
- Inconsistent access to sensitive financial data
- Difficult-to-audit administrative changes
- Manual operational workflows
- Limited traceability of business decisions

Piravel OS aims to address these challenges through a cohesive application with explicit business rules, structured data, and security-conscious engineering.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19 |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Authentication | Better Auth |
| Styling | Tailwind CSS |
| Unit testing | Vitest |
| Browser testing | Playwright |
| CI | GitHub Actions |
| Local database | Docker Compose |

## Implemented Capabilities

### Authentication and Access Control

- Role-based authorization
- TOTP two-factor authentication
- Session management
- Authentication rate limiting and account lockout
- Step-up authentication for sensitive operations
- Resource-level and field-level access restrictions

Four application roles are defined: Super Admin, Finance, Operations, and Team Member.

Authorization is enforced at the application/API layer rather than relying solely on hidden interface elements.

### Client and Service Management

- Brand and client record management
- Contact information management
- Service catalogue administration
- Role-sensitive information access
- Assignment-based access restrictions
- Soft-delete patterns

### Contract Management

- Contract creation and lifecycle rules
- Contract items and pricing calculations
- Status transition validation
- Billing and payment schedule logic
- Contract-related authorization controls

### Financial Engineering

Financial correctness is a core architectural priority.

The project includes a dedicated money module featuring:

- Integer-based minor-unit calculations
- Currency consistency validation
- Exchange-rate conversion helpers
- Tax and VAT calculation utilities
- Deterministic payment amount allocation
- Automated calculation tests

Centralizing monetary calculations helps prevent inconsistent financial logic across the application.

### Auditability and Data Integrity

- Structured audit event recording
- Audit records written within business transactions
- Append-only audit protection mechanisms
- UUID v7 identifiers
- Database migrations and schema verification
- Data integrity and authorization rules

### Automated Quality Assurance

The repository includes automated checks for:

- TypeScript type safety
- ESLint validation
- Unit tests
- Production builds
- Database migrations
- Authentication and authorization flows
- Selected browser-based accessibility checks
- Security analysis through GitHub CodeQL

## Architecture

Piravel OS uses a modular application structure built around Next.js and PostgreSQL.

```text
piravel-os/
├── .github/workflows/   # Continuous integration
├── docs/                # Requirements and architecture
├── drizzle/             # Database migrations
├── public/              # Static assets
├── scripts/             # Setup and verification tools
├── src/
│   ├── app/             # Pages and API routes
│   ├── components/      # UI components
│   ├── db/              # Database and schema
│   └── lib/             # Business and security logic
├── docker-compose.yml
├── package.json
└── LICENSE
```

The architecture favors explicit business rules, database integrity, and maintainable modules over unnecessary infrastructure complexity.

## Getting Started

### Requirements

- Node.js 22
- npm
- Docker with Docker Compose
- Git

### 1. Clone the repository

```bash
git clone https://github.com/burakuruk/piravel-os.git
cd piravel-os
npm ci
```

### 2. Configure environment variables

Copy the example environment configuration.

On macOS/Linux:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and replace all security-related placeholder values.

Generate separate random values for the required authentication and invitation secrets:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Generate distinct values for:

- `BETTER_AUTH_SECRET`
- `INVITE_TOKEN_PEPPER`
- `APP_DB_PASSWORD`

The `APP_DB_PASSWORD` value must match the password in the application's `DATABASE_URL`.

Never commit real credentials or environment secrets.

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Apply migrations and database roles

```bash
npm run db:migrate
npm run db:roles
```

### 5. Start the development server

```bash
npm run dev
```

Open http://localhost:3000.

For detailed environment configuration, initial account setup, and deployment requirements, see [Deployment Notes](docs/07-dagitim.md).

The Docker Compose configuration provides local development infrastructure and should not be treated as a hardened production deployment.

## Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run db:generate` | Generate database migrations |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:roles` | Configure database access roles |
| `npm run db:verify-audit` | Verify audit protections |
| `npm run verify:schema` | Verify database schema |

Some integration verification scripts require a configured database, seeded test accounts, and a running application.

## Engineering Principles

Piravel OS follows several core principles:

**1. Financial correctness**

Monetary calculations use integer minor units, with financial arithmetic centralized in dedicated utilities.

**2. Least privilege**

Access restrictions are enforced on protected operations and sensitive database fields.

**3. Traceable changes**

Important business modifications are designed to produce auditable records.

**4. Explicit data integrity**

Database constraints, controlled state transitions, and soft-delete rules protect business data.

**5. Testable behavior**

Important workflows are validated through automated checks instead of depending entirely on manual testing.

**6. Maintainable architecture**

Business logic is organized into reusable modules with documented design decisions.

## Roadmap

The following capabilities are part of the development roadmap and should not be interpreted as fully implemented features:

- Expanded receivables and payment allocation workflows
- Expense and bank account management
- Multi-currency financial reporting
- Business dashboards and operational reporting
- Scheduled notifications and recurring jobs
- Data migration and recovery workflows
- Further security and reliability improvements

See the [Sprint Plan](docs/04-sprint-plani.md) for development scope.

## Documentation

Detailed project documentation is available in the `docs/` directory.

| Document | Description |
|---|---|
| [Product Requirements](docs/00-PRD.md) | Product scope and requirements |
| [Database Design](docs/01-veritabani-semasi.md) | Schema and data modeling |
| [Authorization Matrix](docs/02-yetki-matrisi.md) | Permissions and role boundaries |
| [API Contracts](docs/03-api-endpointleri.md) | API specifications |
| [Sprint Plan](docs/04-sprint-plani.md) | Development phases |
| [Backlog](docs/05-backlog.md) | Future capabilities |
| [Design System](docs/06-ui-ux-tasarim-sistemi.md) | Interface design decisions |
| [Deployment Notes](docs/07-dagitim.md) | Configuration and operations |

Some technical documentation is currently maintained in Turkish. English documentation improvements are welcome.

## Contributing

Contributions, issue reports, documentation improvements, and technical feedback are welcome.

If you would like to contribute:

1. Review the existing issues and documentation.
2. Open an issue to discuss significant changes.
3. Fork the repository and create a dedicated branch.
4. Implement your change with relevant tests.
5. Run the applicable quality checks.
6. Submit a pull request with a clear explanation.

Potential contribution areas include testing, accessibility, documentation, database reliability, and reusable business logic.

Please do not include real customer data, private credentials, or secrets in contributions.

## Security

Security-sensitive functionality requires careful review.

- Do not commit API keys, credentials, or production data.
- Use independently generated secrets for each installation.
- Review dependency security advisories before deployment.
- Validate authentication and authorization changes with tests.
- Do not expose the application publicly using development credentials.

Automated scanning is used to identify potential issues, but passing security checks does not guarantee the absence of vulnerabilities.

## License

Piravel OS is released under the [MIT License](LICENSE).

Copyright (c) 2026 Ahmetburak Uruk.

Third-party dependencies remain subject to their respective licenses. No trademark rights are granted by the MIT License.

---

**Developed and maintained by [Ahmetburak Uruk](https://github.com/burakuruk).**

Built to explore reliable engineering practices for open-source business software.
