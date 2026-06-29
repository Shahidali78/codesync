# admin — PHP 8.2 Analytics Panel

## Dev
```bash
php -S localhost:8000 -t public
```

Requires Postgres accessible at the configured host/port.

## Env vars
| Variable | Default | Purpose |
|---|---|---|
| `DB_HOST` | `localhost` | Postgres host |
| `DB_PORT` | `5432` | Postgres port |
| `DB_NAME` | `codesync` | Database name |
| `DB_USER` | `codesync` | Database user |
| `DB_PASS` | — | Database password |
| `ADMIN_USER` | `admin` | HTTP basic-auth username |
| `ADMIN_PASS` | — | HTTP basic-auth password |
