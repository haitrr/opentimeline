# Start all dev dependencies and the Next.js dev server
start:
    docker compose -f docker-compose.dev.yml up -d
    pnpm dev --port 3847

# Stop Docker services
stop:
    docker compose -f docker-compose.dev.yml down

# Run unit tests
test:
    pnpm test

# Run e2e tests
test-e2e:
    pnpm test:e2e

# Lint
lint:
    pnpm lint
