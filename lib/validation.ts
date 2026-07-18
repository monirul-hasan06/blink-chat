import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores")
  .transform((value) => value.toLowerCase());

export const pinSchema = z
  .string()
  .regex(/^\d{4,8}$/, "PIN must contain 4 to 8 digits");

export const authSchema = z.object({
  username: usernameSchema,
  pin: pinSchema
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(1000, "Message is too long")
});
