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
  body: z.string().trim().min(1, "Message cannot be empty").max(1000, "Message is too long"),
  replyToId: z.string().min(1).max(64).nullable().optional()
});

export const groupSchema = z.object({
  name: z.string().trim().min(2, "Group name must be at least 2 characters").max(40, "Group name is too long")
});

export const inviteSchema = z.object({
  userId: z.string().min(1, "Choose a user")
});

export const inviteResponseSchema = z.object({
  action: z.enum(["accept", "decline"])
});

export const typingSchema = z.object({
  scopeType: z.enum(["direct", "group"]),
  targetId: z.string().min(1),
  isTyping: z.boolean()
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

export const deleteAccountSchema = z.object({
  confirm: z.literal(true)
});
