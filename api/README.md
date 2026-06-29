# api — Java 21 + Spring Boot

## Dev
```bash
./mvnw spring-boot:run    # http://localhost:8080
```

Requires Postgres on `localhost:5432` and Redis on `localhost:6379` (or set env vars).

## Env vars
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | JDBC URL for Postgres |
| `SPRING_DATASOURCE_USERNAME` | Postgres user |
| `SPRING_DATASOURCE_PASSWORD` | Postgres password |
| `SPRING_REDIS_URL` | Redis connection URL |
| `JWT_SECRET` | HMAC-SHA256 signing secret (≥32 chars) |
| `RUNNER_IMAGE` | Docker image name for the C++ sandbox |
| `RUNNER_TIMEOUT_SECONDS` | Hard wall-clock timeout per execution |
| `RUNNER_MEMORY` | Docker memory limit (e.g. `256m`) |
| `RUNNER_CPUS` | Docker CPU quota (e.g. `0.5`) |
