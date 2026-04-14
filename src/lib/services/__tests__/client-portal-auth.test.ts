import { describe, expect, it } from "vitest";
import { accessCodeMatchesHash, hashClientPortalAccessCode } from "@/lib/client-portal-auth";

describe("client portal auth helpers", () => {
  it("matches the correct access code against its hash", () => {
    const accessCode = "correct-horse-battery-staple";
    const hash = hashClientPortalAccessCode(accessCode);
    expect(accessCodeMatchesHash(accessCode, hash)).toBe(true);
  });

  it("rejects an incorrect access code", () => {
    const hash = hashClientPortalAccessCode("expected-code");
    expect(accessCodeMatchesHash("wrong-code", hash)).toBe(false);
  });

  it("rejects missing or malformed hashes", () => {
    expect(accessCodeMatchesHash("anything", null)).toBe(false);
    expect(accessCodeMatchesHash("anything", "not-a-hash")).toBe(false);
  });
});
