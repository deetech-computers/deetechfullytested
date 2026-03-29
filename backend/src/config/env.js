// src/config/env.js
import dotenv from "dotenv";
import path from "path";
import logger from "../utils/logger.js";

// Load .env from the backend project root.
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

const NODE_ENV = process.env.NODE_ENV || "development";
const required = ["MONGO_URI", "JWT_SECRET"];
if (NODE_ENV === "production") {
  required.push("FRONTEND_URL");
}

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}`
  );
}

if (NODE_ENV !== "production") {
  logger.info(`Environment loaded from ${envPath}`);
}

// Exported config values
export const PORT = process.env.PORT || 5000;
export { NODE_ENV };
export const MONGO_URI = process.env.MONGO_URI;
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const FRONTEND_URL = process.env.FRONTEND_URL;
export const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || "";
export const REDIS_URL = process.env.REDIS_URL || "";
export const RATE_LIMIT_PREFIX = process.env.RATE_LIMIT_PREFIX || "deetech:rl";

// Flat SMTP exports
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = process.env.SMTP_PORT || 587;
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
export const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || "";
export const EMAILJS_RESET_SERVICE_ID = process.env.EMAILJS_RESET_SERVICE_ID || "";
export const EMAILJS_RESET_TEMPLATE_ID = process.env.EMAILJS_RESET_TEMPLATE_ID || "";
export const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || "";

// Cloudinary (optional in local dev, expected in production media hosting)
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";