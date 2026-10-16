import "dotenv/config";
import { importBaseline } from "../lib/database";
import { getPrisma } from "../lib/prisma";
import { seedAdmin } from "../lib/seed-admin";
try {
  await importBaseline();
  await seedAdmin();
  console.log("Workbook baseline imported and the admin account is ready to claim. Existing records preserved.");
}
finally { await getPrisma().$disconnect(); }
