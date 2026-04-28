const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const name = process.argv.slice(2).join(" ").trim();

  if (!name) {
    console.error("Usage: npm run migration:create -- add_claimed_at");
    process.exit(1);
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!slug) {
    console.error("Migration name must contain at least one letter or number.");
    process.exit(1);
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  const migrationsDir = path.join("apps", "api", "db", "migrations");
  const filePath = path.join(migrationsDir, `${timestamp}_${slug}.sql`);
  const contents = `-- ${name}\n-- Write SQL here.\n\nBEGIN;\n\n-- Example:\n-- ALTER TABLE refunds ADD COLUMN claimed_at timestamptz;\n\nCOMMIT;\n`;

  await mkdir(migrationsDir, { recursive: true });
  await writeFile(filePath, contents, { flag: "wx" });

  console.log(`Created ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
