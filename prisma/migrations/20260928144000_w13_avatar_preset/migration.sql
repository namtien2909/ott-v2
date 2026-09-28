-- W13 Avatar preset persistence. Existing profiles retain the fallback robot portrait.
ALTER TABLE "UserProfile" ADD COLUMN "avatarPreset" TEXT NOT NULL DEFAULT 'robot';
