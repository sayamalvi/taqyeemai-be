import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({
  path: process.env.NODE_ENV === "production"
    ? ".env.prod"
    : ".env.dev",
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});