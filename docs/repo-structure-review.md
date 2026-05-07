# Repository Structure Review

Date: 2026-05-07

## Overall verdict

The repository structure is generally good for a product-oriented monorepo:

- Clear top-level separation between applications (`apps/`), shared packages (`packages/`), infrastructure (`infra/`), and documentation (`docs/`).
- Backend and frontend are independently deployable while still living in one repository.
- Terraform modules are split by domain and paired with environment overlays (`dev`, `staging`, `prod`), which is maintainable.

## What is already strong

1. **Monorepo boundaries are clear**
   - `apps/api` and `apps/web` are easy to reason about.
   - `packages/shared-types` provides a natural place for cross-app contracts.

2. **Infrastructure is organized for scale**
   - `infra/terraform/modules/*` follows reusable module conventions.
   - `infra/terraform/environments/*` cleanly separates deployment targets.

3. **Backend internal layering is sensible**
   - Domain folders (`services`, `tasks`, `jobs`, `schemas`, `core`) are separated.
   - Alembic migrations are versioned in a dedicated path.

4. **Frontend route and component grouping is coherent**
   - Next.js `app/` structure mirrors product domains.
   - Component folders are grouped by feature (`chat`, `groups`, `slides`, etc.).

## Improvements recommended

1. **Add a root-level workspace manifest**
   - Add a root `package.json` with npm workspaces (or pnpm/turbo) to standardize multi-app scripts (`lint`, `test`, `typecheck`).

2. **Codify architecture conventions**
   - Add `docs/architecture.md` describing boundaries:
     - what belongs in `services` vs `jobs` vs `tasks`
     - what can be imported from shared packages
     - API contract ownership between backend and frontend

3. **Promote shared-types from placeholder to contract source**
   - Enforce generated or shared DTO typing flow so `packages/shared-types` is authoritative and not "future".

4. **Create root developer automation**
   - Add root `Makefile` or task runner shortcuts (`make dev`, `make test`, `make lint`) to reduce setup friction.

5. **Add structure guardrails in CI**
   - Lint for forbidden import directions (e.g., app-level code importing infra files).
   - Validate Terraform formatting and Python/TypeScript linting from one CI entrypoint.

## Conclusion

Yes — the structure is good and above average for an early-to-mid stage monorepo. The key next step is adding consistency tooling at the repository root so the good structure is continuously enforced.
