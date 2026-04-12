import { describe, it, expect } from "vitest";
import { ComplianceNLPService } from "../compliance-nlp.service";

describe("ComplianceNLPService", () => {
  describe("deterministicScan", () => {
    it("should detect 'guarantee' as risky wording", () => {
      const result = ComplianceNLPService.deterministicScan(
        "This investment guarantees a 10% return every year.",
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((h) => h.patternId === "risky_guarantee")).toBe(true);
      expect(result.some((h) => h.category === "RISKY_WORDING")).toBe(true);
    });

    it("should detect 'no risk' as critical risky wording", () => {
      const result = ComplianceNLPService.deterministicScan(
        "There's no risk with this portfolio.",
      );
      expect(result.some((h) => h.patternId === "risky_no_risk")).toBe(true);
      expect(result.some((h) => h.severity === "CRITICAL")).toBe(true);
    });

    it("should detect Reg BI recommendation without basis", () => {
      const result = ComplianceNLPService.deterministicScan(
        "I recommend you invest in this fund.",
      );
      expect(result.some((h) => h.category === "REG_BI")).toBe(true);
    });

    it("should detect SEC Advertising Rule performance claims", () => {
      const result = ComplianceNLPService.deterministicScan(
        "Our clients saw 15% returns last quarter.",
      );
      expect(result.some((h) => h.category === "AD_RULE")).toBe(true);
    });

    it("should detect suitability violations", () => {
      const result = ComplianceNLPService.deterministicScan(
        "This product is right for everyone.",
      );
      expect(result.some((h) => h.category === "SUITABILITY")).toBe(true);
      expect(result.some((h) => h.severity === "CRITICAL")).toBe(true);
    });

    it("should detect insider trading references", () => {
      const result = ComplianceNLPService.deterministicScan(
        "I have insider information about this stock.",
      );
      expect(result.some((h) => h.patternId === "risky_insider")).toBe(true);
      expect(result.some((h) => h.severity === "CRITICAL")).toBe(true);
    });

    it("should not flag compliant text", () => {
      const result = ComplianceNLPService.deterministicScan(
        "Based on your risk tolerance and investment timeline, we can discuss several options that may align with your goals. Past performance does not guarantee future results.",
      );
      expect(result.length).toBe(0);
    });

    it("should detect multiple violations in a single text", () => {
      const result = ComplianceNLPService.deterministicScan(
        "I guarantee this is a sure thing — no risk at all, and you'll beat the market.",
      );
      expect(result.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("checkRegBiDisclosure", () => {
    it("should flag recommendation without disclosure", () => {
      const result = ComplianceNLPService.checkRegBiDisclosure(
        "I recommend you buy this annuity.",
      );
      expect(result.hasRecommendation).toBe(true);
      expect(result.hasDisclosure).toBe(false);
      expect(result.missingElements.length).toBeGreaterThan(0);
    });

    it("should pass when recommendation includes disclosure", () => {
      const result = ComplianceNLPService.checkRegBiDisclosure(
        "I recommend this fund. Disclosure: We receive compensation from the fund provider. Please review our fee structure and conflict of interest policy.",
      );
      expect(result.hasRecommendation).toBe(true);
      expect(result.hasDisclosure).toBe(true);
      expect(result.missingElements.length).toBe(0);
    });

    it("should pass when no recommendation is made", () => {
      const result = ComplianceNLPService.checkRegBiDisclosure(
        "Here are the options available for your consideration.",
      );
      expect(result.hasRecommendation).toBe(false);
      expect(result.missingElements.length).toBe(0);
    });
  });
});
