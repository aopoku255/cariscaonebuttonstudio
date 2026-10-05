import "dotenv/config";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
import { POLICY_CATALOGUE } from "../src/lib/policies/catalogue";

/**
 * Loads the starting policy documents from prisma/policies/*.md.
 *
 * Each policy is created once, as version 1.0. A policy that already has any version
 * is left completely alone, so running this again never overwrites wording an
 * administrator has edited or published.
 *
 * No effective date is set here: that is for an administrator to enter once the
 * policies have been reviewed.
 */

const here = dirname(fileURLToPath(import.meta.url));

export async function seedPolicies(prisma: PrismaClient): Promise<void> {
  let created = 0;

  for (const [index, definition] of POLICY_CATALOGUE.entries()) {
    const policy = await prisma.policy.upsert({
      where: { slug: definition.slug },
      create: {
        slug: definition.slug,
        title: definition.title,
        summary: definition.summary,
        sortOrder: index + 1,
        requiredAtCheckout: definition.requiredAtCheckout,
      },
      update: { requiredAtCheckout: definition.requiredAtCheckout },
    });

    const existing = await prisma.policyVersion.count({ where: { policyId: policy.id } });
    if (existing > 0) continue;

    const content = readFileSync(join(here, "policies", `${definition.slug}.md`), "utf8");
    await prisma.policyVersion.create({
      data: {
        policyId: policy.id,
        version: "1.0",
        title: definition.title,
        content,
        status: "PUBLISHED",
        changeReason: "Initial version.",
        createdByName: "System (initial setup)",
        publishedByName: "System (initial setup)",
        publishedAt: new Date(),
      },
    });
    created += 1;
  }

  console.log(
    `  ✓ ${POLICY_CATALOGUE.length} policies (${created} new at version 1.0, ${POLICY_CATALOGUE.length - created} left as they are)`,
  );
}

// Run directly with `npm run db:seed:policies`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(
      {
        host: process.env.DB_HOST!,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_NAME!,
      },
      { useTextProtocol: true },
    ),
  });

  seedPolicies(prisma)
    .catch((error) => {
      console.error("Policy seed failed:", error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
