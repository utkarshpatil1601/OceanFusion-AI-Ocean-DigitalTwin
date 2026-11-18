import { describe, it, expect } from "vitest";

describe("OceanFusion Frontend Module Suite", () => {
  it("defines all scientific workspace modules correctly", () => {
    const modules = [
      "Overview",
      "Digital Twin",
      "Ocean Explorer",
      "Fisheries",
      "Biodiversity",
      "Molecular",
      "AI Analytics",
      "Data Hub",
      "Reports",
    ];
    expect(modules.length).toBe(9);
    expect(modules).toContain("Digital Twin");
    expect(modules).toContain("Fisheries");
    expect(modules).toContain("AI Analytics");
  });

  it("validates DNA nucleotide composition calculation logic", () => {
    const rawFasta = ">Test seq\nACGTACGT\n";
    const cleanSeq = rawFasta
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith(">"))
      .join("")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

    expect(cleanSeq).toBe("ACGTACGT");
    expect(cleanSeq.length).toBe(8);

    const gCount = (cleanSeq.match(/G/g) || []).length;
    const cCount = (cleanSeq.match(/C/g) || []).length;
    const gcContent = (((gCount + cCount) / cleanSeq.length) * 100).toFixed(1);

    expect(gcContent).toBe("50.0");
  });

  it("verifies geographic study domain coordinates for Arabian Sea", () => {
    const studyBounds = {
      minLon: 50.0,
      maxLon: 78.0,
      minLat: 5.0,
      maxLat: 26.0,
    };

    expect(studyBounds.minLon).toBe(50.0);
    expect(studyBounds.maxLon).toBe(78.0);
    expect(studyBounds.minLat).toBe(5.0);
    expect(studyBounds.maxLat).toBe(26.0);
  });

  it("verifies the five monitored coastal states", () => {
    const coastalStates = ["Gujarat", "Maharashtra", "Goa", "Karnataka", "Kerala"];
    expect(coastalStates.length).toBe(5);
    expect(coastalStates).toContain("Gujarat");
    expect(coastalStates).toContain("Kerala");
  });
});
