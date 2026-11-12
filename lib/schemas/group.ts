import { z } from "zod";

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Poné un nombre")
  .max(60, "Muy largo");

export const groupEmojiSchema = z.string().trim().max(8).nullable();

export const createGroupSchema = z.object({
  name: groupNameSchema,
  emoji: groupEmojiSchema,
});

export const renameGroupSchema = z.object({
  groupId: z.string().uuid(),
  name: groupNameSchema,
});

export const setGroupEmojiSchema = z.object({
  groupId: z.string().uuid(),
  emoji: groupEmojiSchema,
});

export const setMemberRoleSchema = z.object({
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member"]),
});

export const removeMemberSchema = z.object({
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const leaveGroupSchema = z.object({
  groupId: z.string().uuid(),
});
