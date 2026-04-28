const { readdir, readFile } = require("node:fs/promises");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const migrationsDir = path.join("apps", "api", "db", "migrations");

async function main() {
  const requestedMigration = process.argv[2];

  if (!requestedMigration) {
    console.error("Usage: npm run migration:run -- latest");
    console.error("   or: npm run migration:run -- 20260428T214049_add_claimed_at.sql");
    process.exit(1);
  }

  const migrationPath = await resolveMigrationPath(requestedMigration);
  const sql = await readFile(migrationPath, "utf8");

  console.log(`Running ${migrationPath}`);

  const result = spawnSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "payments",
      "-d",
      "payments",
    ],
    { input: sql, stdio: ["pipe", "inherit", "inherit"] },
  );

  process.exit(result.status ?? 1);
}

async function resolveMigrationPath(requestedMigration) {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  if (requestedMigration === "latest") {
    const latest = files.at(-1);

    if (!latest) {
      throw new Error(`No SQL migrations found in ${migrationsDir}`);
    }

    return path.join(migrationsDir, latest);
  }

  const fileName = path.basename(requestedMigration);

  if (!files.includes(fileName)) {
    throw new Error(`Migration not found: ${fileName}`);
  }

  return path.join(migrationsDir, fileName);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
