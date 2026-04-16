/**
 * ImportModal.js
 * ──────────────────────────────────────────────────────────────────────────
 * Two-step import wizard for Excel/CSV data.
 *
 * STEP 1 — Upload:
 *   Drag-and-drop or click-to-browse. Accepts .xlsx and .csv.
 *   Shows template download button.
 *
 * STEP 2 — Preview & Confirm:
 *   Table showing first 8 rows with code label, truncated quote, theme badge.
 *   Summary of how many nodes will be created.
 *   Option to clear existing canvas before import or append to it.
 *
 * PROPS:
 *   open      {boolean}
 *   onClose   {fn}
 */

import React, { useState, useRef, useEffect } from 'react';
import { useGraph, useGraphDispatch } from '../../context/GraphContext';
import { parseFile, buildGraphFromRows, generateTemplate, getSheetNames } from '../../utils/importUtils';

export default function ImportModal({ open, onClose }) {
  const { nodes }  = useGraph();
  const dispatch   = useGraphDispatch();

  const [step,     setStep]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null); // buildGraphFromRows output
  const [clearFirst, setClearFirst] = useState(false);
  const [fileName, setFileName] = useState('');
  const [sheetNames,    setSheetNames]    = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [pendingFile,   setPendingFile]   = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // ── File handling ──────────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    setLoading(true);
    setError(null);
    setFileName(file.name);
    setPendingFile(file);
    try {
      const ext = file.name.split('.').pop().toLowerCase();

      // Check for multi-sheet workbooks (xlsx/xls only)
      if (ext === 'xlsx' || ext === 'xls') {
        const sheets = await getSheetNames(file);
        setSheetNames(sheets);

        if (sheets.length > 1) {
          // Go to sheet selector step
          setSelectedSheet('');
          setStep(2);
          setLoading(false);
          return;
        }
      }

      // Single sheet or CSV: proceed directly to preview
      const parsed = await parseFile(file);
      const existingThemes = nodes.filter(n => n.type === 'theme');
      const built = buildGraphFromRows(parsed, clearFirst ? [] : existingThemes);
      setResult(built);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }

  function handleInputChange(e) {
    handleFile(e.target.files[0]);
  }

  // ── Confirm import ─────────────────────────────────────────────────────────
  function handleConfirm() {
    if (!result) return;

    if (clearFirst) dispatch({ type: 'CLEAR' });

    // Add theme nodes first (so code nodes can reference them)
    if (result.themeNodes.length > 0) {
      dispatch({ type: 'ADD_NODES', nodes: result.themeNodes });
    }
    if (result.codeNodes.length > 0) {
      dispatch({ type: 'ADD_NODES', nodes: result.codeNodes });
    }
    result.edges.forEach(edge => {
      dispatch({ type: 'ADD_EDGE', edge });
    });

    handleClose();
  }

  // ── Template download ──────────────────────────────────────────────────────
  function handleTemplateDownload() {
    const data = generateTemplate();
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'thematic-analysis-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSheetConfirm() {
    if (!selectedSheet || !pendingFile) return;
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseFile(pendingFile, selectedSheet);
      const existingThemes = nodes.filter(n => n.type === 'theme');
      const built = buildGraphFromRows(parsed, clearFirst ? [] : existingThemes);
      setResult(built);
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setStep(1); setResult(null); setError(null); setFileName('');
    setSheetNames([]); setSelectedSheet(''); setPendingFile(null);
    onClose();
  }

  // ── Preview rows (first 8) ─────────────────────────────────────────────────
  const previewRows = result
    ? result.codeNodes.slice(0, 8).map(cn => {
        const theme = result.themeNodes.find(t => t.id === cn.primaryThemeId)
          ?? nodes.find(n => n.id === cn.primaryThemeId);
        return { code: cn.label, quote: cn.quote, theme, unassigned: !cn.primaryThemeId };
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="import-modal-title" className="bg-white border-2 border-[#0f0d0a] rounded-none p-7 w-[700px] max-w-full shadow-[8px_8px_0_#0f0d0a] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-8 h-8 flex items-center justify-center text-base font-bold border-2 border-[#0f0d0a] ${step === 1 ? 'bg-[#dc2626] text-white border-[#dc2626]' : 'bg-white text-[#6b6560]'}`}>1</div>
          <div className="flex-1 h-px bg-[#0f0d0a]" />
          {sheetNames.length > 1 && <>
            <div className={`w-8 h-8 flex items-center justify-center text-base font-bold border-2 border-[#0f0d0a] ${step === 2 ? 'bg-[#dc2626] text-white border-[#dc2626]' : 'bg-white text-[#6b6560]'}`}>2</div>
            <div className="flex-1 h-px bg-[#0f0d0a]" />
          </>}
          <div className={`w-8 h-8 flex items-center justify-center text-base font-bold border-2 border-[#0f0d0a] ${step === (sheetNames.length > 1 ? 3 : 2) ? 'bg-[#dc2626] text-white border-[#dc2626]' : 'bg-white text-[#6b6560]'}`}>{sheetNames.length > 1 ? 3 : 2}</div>
        </div>

        {/* ── STEP 1: Upload ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h2 id="import-modal-title" className="text-xl font-bold text-[#0f0d0a] mb-1">Import Data</h2>
            <p className="text-base text-[#6b6560] mb-6">Upload a .xlsx or .csv file. Expected columns: Source, Quoted Text, Code, Preliminary Theme.</p>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-[#0f0d0a] p-10 text-center cursor-pointer hover:border-[#dc2626] hover:text-[#dc2626] transition-colors mb-5 text-[#6b6560]"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-4xl mb-3">📂</div>
              <p className="text-base">Drag & drop your file here, or <span className="text-[#dc2626] font-bold">click to browse</span></p>
              <p className="text-base text-[#6b6560] mt-2">Accepts .xlsx and .csv</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleInputChange} />

            {/* Template download */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-base text-[#6b6560]">Need a template?</span>
              <button onClick={handleTemplateDownload} className="text-base font-bold text-[#0f0d0a] border-2 border-[#0f0d0a] px-4 py-2 hover:bg-[#0f0d0a] hover:text-white transition-colors">
                ↓ Download Template
              </button>
            </div>

            {/* Clear option */}
            <label className="flex items-center gap-3 cursor-pointer mb-6">
              <input type="checkbox" checked={clearFirst} onChange={e => setClearFirst(e.target.checked)} className="w-5 h-5 accent-indigo-500" />
              <span className="text-base text-[#0f0d0a] font-bold">Clear existing canvas before importing</span>
            </label>

            {error && <p className="text-base text-[#dc2626] font-bold mb-4">⚠ {error}</p>}
            {loading && <p className="text-base text-[#6b6560]">Parsing file…</p>}

            <div className="flex justify-end">
              <button onClick={handleClose} className="text-base font-bold text-[#0f0d0a] px-5 py-2 border-2 border-[#0f0d0a] hover:bg-[#0f0d0a] hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Sheet Selector ────────────────────────────────────────────────── */}
        {step === 2 && sheetNames.length > 1 && !result && (
          <>
            <h2 id="import-modal-title" className="text-xl font-bold text-[#0f0d0a] mb-1">Select Sheet</h2>
            <p className="text-base text-[#6b6560] mb-6">This workbook has {sheetNames.length} sheets. Choose which one to import.</p>

            <div className="flex flex-col gap-2 mb-6">
              {sheetNames.map(name => (
                <button
                  key={name}
                  onClick={() => setSelectedSheet(name)}
                  className={`px-4 py-3 text-left text-base font-bold border-2 transition-colors ${
                    selectedSheet === name
                      ? 'bg-[#dc2626] text-white border-[#dc2626]'
                      : 'bg-white text-[#0f0d0a] border-[#0f0d0a] hover:bg-[#f0ebe3]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            {error && <p className="text-base text-[#dc2626] font-bold mb-4">⚠ {error}</p>}
            {loading && <p className="text-base text-[#6b6560]">Parsing file…</p>}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="text-base font-bold text-[#0f0d0a] px-5 py-2 border-2 border-[#0f0d0a] hover:bg-[#0f0d0a] hover:text-white transition-colors">
                ← Back
              </button>
              <button
                onClick={handleSheetConfirm}
                disabled={!selectedSheet || loading}
                className="text-base font-bold text-white px-5 py-2 bg-[#dc2626] border-2 border-[#dc2626] shadow-[3px_3px_0_#0f0d0a] hover:bg-[#b91c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Preview ────────────────────────────────────────────────── */}
        {step === 3 && result && (
          <>
            <h2 id="import-modal-title" className="text-xl font-bold text-[#0f0d0a] mb-1">Preview Import</h2>
            <p className="text-base text-[#6b6560] mb-1">
              From <span className="text-[#0f0d0a] font-bold">{fileName}</span>
            </p>
            <p className="text-base text-[#6b6560] mb-5">
              <span className="text-[#0f0d0a] font-bold">{result.summary.codeCount}</span> code nodes,{' '}
              <span className="text-[#0f0d0a] font-bold">{result.summary.themeCount}</span> new theme nodes —{' '}
              <span className="text-[#dc2626] font-bold">{result.summary.assigned} assigned</span>,{' '}
              <span className="text-[#6b6560] font-bold">{result.summary.unassigned} unassigned</span>
            </p>

            {/* Preview table */}
            <div className="overflow-hidden border-2 border-[#0f0d0a] mb-5">
              <table className="w-full text-base">
                <thead className="bg-[#0f0d0a]">
                  <tr>
                    <th className="text-left px-4 py-3 text-white font-bold">Code</th>
                    <th className="text-left px-4 py-3 text-white font-bold">Quote</th>
                    <th className="text-left px-4 py-3 text-white font-bold">Theme</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t-2 border-[#0f0d0a] hover:bg-[#f0ebe3]">
                      <td className="px-4 py-3 text-[#0f0d0a] font-bold max-w-[180px] truncate">{row.code}</td>
                      <td className="px-4 py-3 text-[#6b6560] italic max-w-[220px] truncate">"{row.quote}"</td>
                      <td className="px-4 py-3">
                        {row.theme
                          ? <span className="text-base font-bold px-3 py-1 text-white" style={{ backgroundColor: row.theme.color }}>{row.theme.label}</span>
                          : <span className="text-base font-bold px-3 py-1 text-[#6b6560] border border-[#6b6560]">Unassigned</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.summary.codeCount > 8 && (
                <p className="text-base text-[#6b6560] px-4 py-2 bg-[#f0ebe3] text-center font-bold">
                  … and {result.summary.codeCount - 8} more rows
                </p>
              )}
            </div>

            <div className="flex justify-between items-center">
              <button onClick={() => setStep(sheetNames.length > 1 ? 2 : 1)} className="text-base font-bold text-[#0f0d0a] px-5 py-2 border-2 border-[#0f0d0a] hover:bg-[#0f0d0a] hover:text-white transition-colors">
                ← Back
              </button>
              <div className="flex gap-3">
                <button onClick={handleClose} className="text-base font-bold text-[#0f0d0a] px-5 py-2 border-2 border-[#0f0d0a] hover:bg-[#0f0d0a] hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirm} className="text-base font-bold text-white px-5 py-2 bg-[#dc2626] border-2 border-[#dc2626] shadow-[3px_3px_0_#0f0d0a] hover:bg-[#b91c1c] transition-colors">
                  ✓ Confirm Import
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
