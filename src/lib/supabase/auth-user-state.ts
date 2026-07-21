import type { User } from "@supabase/supabase-js";

export function preserveUserIdentity(
  current: User | null,
  incoming: User | null,
): User | null {
  return current?.id === incoming?.id ? current : incoming;
}
