import { z } from "zod";

export const UsernameSchema = z.string().trim().regex(/^[A-Za-z0-9_]{4,20}$/, "Username phải dài 4–20 ký tự và chỉ gồm chữ, số, dấu gạch dưới.");
export const FullNameSchema = z.string().trim().min(2).max(50);
export const DisplayNameSchema = z.string().trim().min(2).max(20);
export const PasswordSchema = z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự.");
export const AvatarPresetSchema = z.enum(["robot", "wolf", "fox", "panda", "arena"]);

export const RegisterRequestSchema = z.object({
  fullName: FullNameSchema,
  displayName: DisplayNameSchema,
  username: UsernameSchema,
  password: PasswordSchema,
});

export const LoginRequestSchema = z.object({
  username: UsernameSchema,
  password: z.string().min(1),
  remember: z.boolean().default(false),
});

export const RecoverRequestSchema = z.object({
  username: UsernameSchema,
  recoveryCode: z.string().trim().min(8).max(128),
  newPassword: PasswordSchema,
});

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: PasswordSchema,
});

export const ProfilePatchRequestSchema = z.object({
  fullName: FullNameSchema.optional(),
  displayName: DisplayNameSchema.optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  avatarPreset: AvatarPresetSchema.optional(),
}).strict();

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RecoverRequest = z.infer<typeof RecoverRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
export type ProfilePatchRequest = z.infer<typeof ProfilePatchRequestSchema>;
export type AvatarPreset = z.infer<typeof AvatarPresetSchema>;
