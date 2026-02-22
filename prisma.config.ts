import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";

// Load .env so Prisma CLI commands can read DATABASE_URL
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
