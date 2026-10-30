# Deployment

Production runs on Google Cloud in `europe-west1`. Two Cloud Build pipelines,
triggered by pushes that touch each app, build and release everything.

## API and worker (`cloudbuild.api.yaml`)

1. **Build and push** the API image to Artifact Registry. The Docker build
   compiles the app and runs the full test suite; a failing test stops the
   release.
2. **Migrate.** A one-off Cloud Run job runs `prisma migrate deploy` against
   Cloud SQL using the new image, so schema changes land before any code that
   depends on them.
3. **Deploy the worker** (when `_BACKGROUND_MODE=cloud-tasks`): a private
   Cloud Run service (`--no-allow-unauthenticated`) that scales to zero, runs
   up to two instances with four concurrent tasks each, and accepts only
   OIDC-authenticated Cloud Tasks requests.
4. **Deploy the API**: the public service. With Cloud Tasks handling background
   work it scales to zero; without it, a warm instance is kept while live sales
   are enabled so recovery and email retries keep running between requests.

Secrets (database URL, Paystack and Celitech credentials, SMTP and OpenAI
keys) come from Secret Manager. The Paystack and OpenAI keys are pinned to
explicit versions, so rotating either cannot silently change a running revision.

### Release switches

| Substitution             | Effect                                                        |
| ------------------------ | ------------------------------------------------------------- |
| `_LIVE_SALES_ENABLED`    | Allow real-money purchases (also requires live Paystack keys) |
| `_LIVE_SALES_ADMIN_ONLY` | Restrict live checkout to administrators during acceptance    |
| `_CELITECH_MODE`         | `live` supplier calls or the `mock` adapter                   |
| `_CELITECH_WEBHOOKS`     | Enable supplier usage webhooks once their secret exists       |
| `_BACKGROUND_MODE`       | `cloud-tasks` in production                                   |
| `_ASSISTANT_ENABLED`     | Turn the AI support assistant on or off independently         |

## Web (`cloudbuild.web.yaml`)

`NEXT_PUBLIC_*` values are baked in at build time and the home page is
server-rendered from live catalogue data, so the pipeline first waits for the
API's `/health/ready` endpoint to report a compatible version. It then builds
the Next.js image and deploys it as a public Cloud Run service.

## Rollback

Every deploy creates a new Cloud Run revision, so rolling back is a traffic
switch to an earlier revision. Migrations run before the new revision takes
traffic, so only roll back to a revision that is compatible with the current
schema.

## Local and CI parity

GitHub Actions runs the same lint, type-check and test commands as the Docker
build on every push and pull request (see `.github/workflows/ci.yml`).
