# SOPCare environments

SOPCare uses PostgreSQL through a `DATABASE_URL`. Neon is the recommended host,
and TablePlus can connect with the same standard PostgreSQL credentials.

## Environment model

| Environment | Git branch | Site | Neon database branch | Data |
| --- | --- | --- | --- | --- |
| Development | feature branches | local preview | `development` | synthetic only |
| Staging | `develop` | separate staging Site | `staging` | synthetic or de-identified |
| Production | `main` | public SOPCare Site | `production` | live records |

Never point staging or local development at the production connection string.
Production clinical data must not be copied into staging.

## Safe change workflow

1. Create a feature branch from `develop`.
2. Make the code and schema changes locally.
3. Generate and review the PostgreSQL migration with `npm run db:generate`.
4. Load the selected branch connection string as the protected `DATABASE_URL` secret.
5. Confirm `APP_ENV=development`, run `npm run db:migrate`, then `npm run db:verify`.
6. Test the staging Site, including create, update, reload, and permission flows.
7. Open a pull request into `main`.
8. Back up production, apply the reviewed migration, then deploy the approved code.
9. Keep a rollback migration or a documented forward-fix for every destructive change.

## Required secrets

Configure `DATABASE_URL` separately in local development, staging, and
production. Do not add credentials to Git, screenshots, documentation, or chat.

The prototype login also requires `SOPCARE_MOCK_PASSWORD` and
`SOPCARE_SESSION_SECRET`. Store both as protected environment secrets and use
independent values in every environment.

Synthetic demo data is inserted only when both `APP_ENV=development` and
`SOPCARE_ENABLE_DEV_SEED=true`. Schema creation is never performed at request
time; reviewed Drizzle migrations own all database structure changes.

## TablePlus

Create a PostgreSQL connection using the host, port, database, user, password,
and TLS settings from the selected Neon branch. Save production and staging as
separate connections with clear names and different colors.
