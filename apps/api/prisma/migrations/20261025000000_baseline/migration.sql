-- Gate G1 baseline migration: intentionally empty.
-- It proves the migration pipeline works (Prisma records it in _prisma_migrations)
-- without creating product tables. Product tables arrive at Gate G2.
SELECT 1;
