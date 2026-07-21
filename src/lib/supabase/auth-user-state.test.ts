import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { preserveUserIdentity } from "./auth-user-state";

function user(id: string, email: string) {
  return { id, email } as User;
}

describe("preserveUserIdentity", () => {
  it("mantiene lo stesso riferimento durante il rinnovo sessione dello stesso utente", () => {
    const current = user("user-1", "prima@example.com");
    const refreshed = user("user-1", "dopo@example.com");

    expect(preserveUserIdentity(current, refreshed)).toBe(current);
  });

  it("aggiorna lo stato per accesso, cambio utente e uscita", () => {
    const first = user("user-1", "uno@example.com");
    const second = user("user-2", "due@example.com");

    expect(preserveUserIdentity(null, first)).toBe(first);
    expect(preserveUserIdentity(first, second)).toBe(second);
    expect(preserveUserIdentity(second, null)).toBeNull();
  });
});
