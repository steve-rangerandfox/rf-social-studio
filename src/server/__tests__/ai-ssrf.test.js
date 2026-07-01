import { describe, it, expect } from "vitest";
import { isBlockedIp } from "../ai.js";

// Guards the brand-learn SSRF fix: the fetch is only allowed to reach
// public IPs. If any of these flip, an authenticated user could pivot to
// cloud metadata / internal services.
describe("isBlockedIp (SSRF guard)", () => {
  it("blocks loopback / private / link-local / CGNAT / metadata", () => {
    for (const ip of [
      "127.0.0.1", "127.53.1.1", "0.0.0.0",
      "10.0.0.5", "192.168.1.1", "172.16.0.1", "172.31.255.255",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1",
      "::ffff:127.0.0.1", "::ffff:169.254.169.254", // IPv4-mapped
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows genuinely public addresses", () => {
    for (const ip of [
      "8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "192.167.0.1",
      "2606:4700:4700::1111",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("blocks malformed / non-IP input defensively", () => {
    expect(isBlockedIp("999.1.1.1")).toBe(true);
    expect(isBlockedIp("not-an-ip")).toBe(true);
    expect(isBlockedIp("")).toBe(true);
  });
});
