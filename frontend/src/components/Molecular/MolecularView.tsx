import React, { useState } from "react";
import { MolecularData, SequenceMatch } from "../../types";
import { readApiJson } from "../../lib/api";

interface MolecularViewProps {
  data: MolecularData;
  apiBaseUrl: string;
}

const SAMPLE_SEQUENCES = [
  {
    name: "Conus biliosus (Cone Snail)",
    accession: "BOLD:ANGEN388-17",
    fasta: ">BOLD:ANGEN388-17 Conus biliosus COI-5P marine reference\nTTATATATTATGTTTGGTGTATGATCTGGTTTGGTCGGGACTGCCCTAAGTCTTTTGATTCGGGCTGAGCTTGGACAGCCAGGGTCTCTAATTGGTGATGATCAAATTTATAATGTTATCGTAACTGCTCATGCTTTTATTATAATTTTTTTTATGGTTATACCAATTATGATTGGAGGATTTGGTAATTGATTAGTACCACTTATGCTTGGAGCCCCTGATATGGCTTTTCCTCGAATGAATAATATAAGTTTTTGACTTCTCCCTCCTTCTCTTTTACTCCTGCTTTCTTCTGCAGCTGTAGAAAAGGGTGCAGGTACTGGTTGAACTGTTTATCCTCCTTTATCAAGTAATATTTCTCATTCAGGAGCATCAGTAGATTTAGCTATTTTTTCTCTACATTTAGCAGGAATTTCTTCTATTTTAGGAGCAGTTAATTTTATTACCACTATCATTAACATACGTTGACCAGGAATACATTTTGAACGTCTTCCTCTTTTTGTTTGATCAGTAGTAATTACTGCCATTTTACTTCTCCTTTCTTTACCAGTACTAGCTGGTGCTATTACAATACTATTAACTGACCGAAACCTAAATACTTCATTTTTTGACCCAGCTGGAGGAGGAGATCCAATTTTATACCAACATTTATTT\n",
  },
  {
    name: "Sepia recurvirostra (Cuttlefish)",
    accession: "BOLD:ANGEN387-17",
    fasta: ">BOLD:ANGEN387-17 Sepia recurvirostra COI-5P marine reference\nTTATGTTTTTAGTATGAGCGGGTATAATTGGTACTTCTTTAAGTATATTAATTCGAGCTGAATTAGGCCAACCAGGTACACTATTAGGTGATGATCAAATTTATAATGTAATTGTTACAGCACATGCATTTATTATAATTTTTTTTATAGTTATACCAATCATAATTGGAGGATTTGGAAATTGACTAGTACCTTTAATATTAGGAGCTCCTGATATAGCTTTTCCACGAATAAATAATATAAGTTTTTGACTATTACCCCCATCTTTAACTTTATTATTATCAAGTAGTATAGTAGAAAGAGGGGTAGGTACTGGTTGAACTGTTTATCCTCCTTTATCTAGTAATATTGCTCATAGAGGTTCTTCTGTAGATTTAGCTATTTTCTCATTACATTTAGCTGGTATTTCTTCTATTTTAGGAGCTATTAATTTTATTACAACTATTATTAATATACGTTGAACAGGTATACAATTTGAACGAATTCCT\n",
  },
  {
    name: "Thais sacella (Rock Snail)",
    accession: "BOLD:ANGEN386-17",
    fasta: ">BOLD:ANGEN386-17 Thais sacella COI-5P marine reference\nAACTTTATATTTTATTTTTGGTATTTGATCAGGAATAGTGGGTACTTCACTAAGACTTTTAATTCGTGTTGAATTAGGAAATCCTGGATCATTAATTGGAGATGATCAAATTTATAATGTAATTGTTACTGCCCATGCCTTCATTATAATTTTTTTTATAGTTATACCTATTATAATTGGGGGTTTTGGAAATTGATTAGTTCCTTTAATATTAGGAGCTCCTGATATAGCATTCCCACGAATAAATAATATAAGTTTTTGATTACTACCTCCTTCTCTTACTCTTTTACTTTCTTCAGCGGCTGTAGAAAGGGGTGCAGGAACAGGATGAACAGTTTATCCTCCTTTATCAAGTAATATTGCTCATAGAGGACCATCAGTTGATTTAGCTATTTTTTCTTTACACTTAGCAGGAATTTCTTCTATTTTAGGGGCTATTAATTTTATTACCACCATTATTAATATACGTTGATCAGGAATACATTTCGACCGTCTTCCTTTATTTGTTTGATCTGTAGTTATTACTGCTATTCTTTTATTATTATCATTACCAGTTTTAGCCGGTGCTATTACTATACTTCTTACTGATCGTAATTTTAATACTTCATTCTTTGACCCTGCTGGAGGAGGAGATCCTATTTTATACCAACATTTATTT\n",
  },
];

export const MolecularView: React.FC<MolecularViewProps> = ({ data, apiBaseUrl }) => {
  const summary = data?.summary ?? {
    reference_count: 0,
    marine_count: 0,
    bold_count: 0,
    ncbi_count: 0,
    valid_count: 0,
    invalid_count: 0,
    returned_count: 500,
    ecological_scope: "marine",
  };
  const references = data?.references ?? [];

  const [fastaInput, setFastaInput] = useState<string>("");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [scope, setScope] = useState<string>("marine");
  const [isAligning, setIsAligning] = useState<boolean>(false);
  const [alignmentMatches, setAlignmentMatches] = useState<SequenceMatch[]>([]);
  const [queryMeta, setQueryMeta] = useState<{ queryName: string; queryLength: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Analyze sequence nucleotides
  const cleanSequence = fastaInput
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"))
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  const seqLen = cleanSequence.length;
  const aCount = (cleanSequence.match(/A/g) || []).length;
  const cCount = (cleanSequence.match(/C/g) || []).length;
  const gCount = (cleanSequence.match(/G/g) || []).length;
  const tCount = (cleanSequence.match(/T/g) || []).length;
  const gcContent = seqLen > 0 ? (((gCount + cCount) / seqLen) * 100).toFixed(1) : "0.0";

  const identityThreshold = 90.0;
  const coverageThreshold = 80.0;

  const passingMatches = alignmentMatches.filter(
    (m) => m.percent_identity >= identityThreshold && m.query_coverage >= coverageThreshold
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFastaInput(text);
    };
    reader.readAsText(file);
  };

  const loadSample = (sample: (typeof SAMPLE_SEQUENCES)[0]) => {
    setFastaInput(sample.fasta);
    setSelectedFileName(`Sample: ${sample.name}`);
    setStatusMessage(`Loaded sample query sequence for ${sample.name}. Ready for alignment.`);
  };

  const executeAlignment = async () => {
    setIsAligning(true);
    setStatusMessage("Validating sequence and aligning against reference database via Biopython...");
    try {
      const response = await fetch(`${apiBaseUrl}/molecular/identify?scope=${scope}&limit=20`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fastaInput }),
      });

      const result = await readApiJson<{
        status?: string;
        matches?: SequenceMatch[];
        query_name?: string;
        query_length?: number;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(result.error || "Alignment execution failed");
      }

      setAlignmentMatches(result.matches ?? []);
      setQueryMeta({
        queryName: result.query_name ?? "Query Sequence",
        queryLength: result.query_length ?? seqLen,
      });
      setStatusMessage(
        `Alignment complete: Found ${result.matches?.length ?? 0} candidate matches (${scope} references).`
      );
    } catch (err) {
      setAlignmentMatches([]);
      setStatusMessage(err instanceof Error ? err.message : "Alignment service is unavailable. Check the API connection and retry.");
    } finally {
      setIsAligning(false);
    }
  };

  const downloadMatchesCSV = () => {
    if (!alignmentMatches.length) return;
    const headers = ["accession", "candidate_species", "percent_identity", "query_coverage", "alignment_score"];
    const rows = alignmentMatches.map((m) => [
      m.accession,
      `"${m.candidate_species}"`,
      m.percent_identity,
      m.query_coverage,
      m.alignment_score,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `oceanfusion_dna_alignment_results.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="molecular-container">
      {data?.status !== "ok" && <div className="empty-state-panel" role="status">
        {data?.status === "empty" ? "No reference sequences are stored yet. Ingest BOLD or NCBI references before running identification." : "Reference database status is unavailable. Check the API connection before interpreting search results."}
      </div>}
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">TOTAL REFERENCES</span>
            <span className="kpi-badge">BOLD + NCBI</span>
          </div>
          <div className="kpi-value">{summary.reference_count.toLocaleString()}</div>
          <div className="kpi-subtitle">
            {summary.bold_count.toLocaleString()} BOLD barcode records · {(summary.ncbi_count ?? 0).toLocaleString()} NCBI references
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">MARINE-CLASSIFIED REFERENCES</span>
            <span className="kpi-badge verified">Scope metadata</span>
          </div>
          <div className="kpi-value primary">{summary.marine_count.toLocaleString()}</div>
          <div className="kpi-subtitle">References classified as marine from available source metadata</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">ALIGNMENT ENGINE</span>
            <span className="kpi-badge">Biopython</span>
          </div>
          <div className="kpi-value small">PairwiseAligner</div>
          <div className="kpi-subtitle">Local Smith-Waterman alignment score</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-meta">
            <span className="kpi-title">BARCODE MARKER</span>
            <span className="kpi-badge">Mitochondrial</span>
          </div>
          <div className="kpi-value text-teal">COI-5P</div>
          <div className="kpi-subtitle">Cytochrome c oxidase subunit I gene</div>
        </div>
      </div>

      {/* Interactive Sequence Workbench */}
      <div className="section-card workbench-card">
        <div className="section-header">
          <div>
            <div className="badge-row">
              <span className="badge-pill bio-pill">BIOINFORMATICS PIPELINE</span>
              <span className="badge-pill verified-pill">Strict Marine Thresholds: 90% Identity · 80% Coverage</span>
            </div>
            <h3>DNA Barcode Sequence Identification Workbench</h3>
            <p className="section-desc">
              Compare unknown marine organism nucleotide sequences against validated BOLD and GenBank reference sequences.
            </p>
          </div>
          <div className="sample-quickload">
            <span className="quickload-label">Quick-Load Marine Test Barcodes:</span>
            <div className="sample-btn-group">
              {SAMPLE_SEQUENCES.map((s) => (
                <button
                  key={s.accession}
                  className="btn-sample-chip"
                  onClick={() => loadSample(s)}
                  type="button"
                >
                  🧬 {s.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="workbench-grid">
          {/* Left Column: FASTA Input & Controls */}
          <div className="workbench-input-col">
            <div className="file-upload-strip">
              <label className="btn-file-label" htmlFor="fasta-file-input">
                📂 Choose FASTA File
                <input
                  id="fasta-file-input"
                  type="file"
                  accept=".fasta,.fa,.fas,.txt"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
              <span className="selected-file-text">{selectedFileName}</span>
            </div>

            <div className="textarea-wrapper">
              <textarea
                className="fasta-textarea"
                rows={8}
                value={fastaInput}
                onChange={(e) => setFastaInput(e.target.value)}
                placeholder=">Query_Sequence_Header [organism=Unknown]\nACGT..."
                aria-label="FASTA sequence input"
              />
            </div>

            {/* Sequence Analysis Meter */}
            <div className="seq-analysis-strip">
              <div className="seq-stat">
                <span>Sequence Length:</span>
                <strong>{seqLen} bp</strong>
              </div>
              <div className="seq-stat">
                <span>GC Content:</span>
                <strong className="text-teal">{gcContent}%</strong>
              </div>
              <div className="seq-stat">
                <span>Composition:</span>
                <small className="mono">A: {aCount} | C: {cCount} | G: {gCount} | T: {tCount}</small>
              </div>
            </div>

            {/* Alignment Options & Execute */}
            <div className="alignment-actions-row">
              <div className="scope-select-wrap">
                <label>Reference Scope:</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="input-select"
                >
                  <option value="marine">Marine References Only (Conservative, 245 seqs)</option>
                  <option value="all">All stored references</option>
                </select>
              </div>

              <button
                className="btn-primary align-btn"
                onClick={executeAlignment}
                disabled={isAligning || seqLen === 0}
                type="button"
              >
                {isAligning ? "Aligning Sequence..." : "⚡ Execute Pairwise Alignment"}
              </button>
            </div>

            {statusMessage && (
              <div className="alignment-status-banner">
                <span>ℹ️</span>
                <span>{statusMessage}</span>
              </div>
            )}
          </div>

          {/* Right Column: Query Overview & Scientific Guardrails */}
          <div className="workbench-info-col">
            <div className="info-box-panel">
              <h4>Candidate Match Scientific Interpretation</h4>
              <p>
                Pairwise local alignment produces mathematical similarity metrics against stored barcode sequences.
                Identification criteria:
              </p>
              <ul className="criteria-list">
                <li>
                  <strong>≥ 90% Sequence Identity:</strong> High candidate probability for taxonomic congruency.
                </li>
                <li>
                  <strong>≥ 80% Query Coverage:</strong> Substantial span coverage over COI-5P standard length.
                </li>
                <li>
                  <strong>Passing Matches:</strong> {passingMatches.length} candidate(s) meet both criteria.
                </li>
              </ul>
              <div className="guardrail-note">
                <strong>Bioinformatics Disclaimer:</strong> Pairwise alignment matches indicate candidate species hypotheses, not formal taxonomic proof or legal identification.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alignment Results Table */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>Candidate Alignment Matches ({alignmentMatches.length})</h3>
            <p className="section-desc">
              Ranked by Smith-Waterman alignment score and percent sequence identity against reference barcodes.
            </p>
          </div>
          {alignmentMatches.length > 0 && (
            <button className="btn-secondary" onClick={downloadMatchesCSV} type="button">
              📥 Download Matches CSV
            </button>
          )}
        </div>

        <div className="ocean-table-wrap">
          <table className="ocean-table">
            <thead>
              <tr>
                <th>Accession</th>
                <th>Candidate Species</th>
                <th>Sequence Identity</th>
                <th>Query Coverage</th>
                <th>Alignment Score</th>
                <th>Evaluation Status</th>
              </tr>
            </thead>
            <tbody>
              {alignmentMatches.length > 0 ? (
                alignmentMatches.map((m) => {
                  const isPassing = m.percent_identity >= identityThreshold && m.query_coverage >= coverageThreshold;
                  return (
                    <tr key={m.accession}>
                      <td className="mono font-bold">{m.accession}</td>
                      <td className="italic font-bold">{m.candidate_species || "Unspecified Taxon"}</td>
                      <td className="mono">
                        <span className={`pct-badge ${m.percent_identity >= 95 ? "perfect" : m.percent_identity >= 90 ? "high" : "low"}`}>
                          {m.percent_identity.toFixed(1)}%
                        </span>
                      </td>
                      <td className="mono">{m.query_coverage.toFixed(1)}%</td>
                      <td className="mono">{m.alignment_score.toFixed(1)}</td>
                      <td>
                        {isPassing ? (
                          <span className="status-pill success">✓ Candidate Species Match</span>
                        ) : (
                          <span className="status-pill warning">⚠️ Inconclusive (&lt; 90%/80%)</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center muted py-4">
                    No active alignment matches. Click "Execute Pairwise Alignment" or choose a sample sequence above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stored Reference Sequences Catalog */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h3>Stored Reference Library Samples</h3>
            <p className="section-desc">
              Curated barcode library specimens stored in the OceanFusion database.
            </p>
          </div>
          <span className="table-count-tag">Showing {references.length} library entries</span>
        </div>

        <div className="ocean-table-wrap">
          <table className="ocean-table">
            <thead>
              <tr>
                <th>Accession</th>
                <th>Organism</th>
                <th>Gene Marker</th>
                <th>Sequence Length</th>
                <th>Ecological Scope</th>
                <th>Validation Status</th>
              </tr>
            </thead>
            <tbody>
              {references.slice(0, 20).map((ref) => (
                <tr key={ref.accession}>
                  <td className="mono">{ref.accession}</td>
                  <td className="italic">{ref.organism || "Unspecified"}</td>
                  <td>{ref.marker}</td>
                  <td className="mono">{ref.sequence_length} bp</td>
                  <td>
                    <span className={`scope-badge ${ref.ecological_scope === "marine" ? "marine" : "other"}`}>
                      {ref.ecological_scope || "unresolved"}
                    </span>
                  </td>
                  <td>
                    <span className="status-pill success">{ref.validation_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
