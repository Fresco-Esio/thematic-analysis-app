/**
 * exportUtils.js
 * ──────────────────────────────────────────────────────────────────────────
 * Exports the canvas as PNG or PDF.
 *
 * USAGE:
 *   import { exportToPng, exportToPdf } from '../utils/exportUtils';
 *
 *   // Pass the canvas DOM element (the div that wraps nodes + SVG)
 *   await exportToPng(canvasRef.current);
 *   await exportToPdf(canvasRef.current);
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Capture the canvas element as a PNG and trigger download.
 * @param {HTMLElement} element — the canvas wrapper div
 * @param {string} filename — default 'thematic-map'
 */
export async function exportToPng(element, filename = 'thematic-map') {
  const canvas = await html2canvas(element, {
    backgroundColor: '#0f172a', // match app background
    scale: 2,                   // 2x for retina quality
    useCORS: true,
    logging: false,
  });

  const link = document.createElement('a');
  link.download = `${filename}-${datestamp()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * Capture the canvas element and export as a PDF.
 * Adds a footer with the app name and date.
 * @param {HTMLElement} element — the canvas wrapper div
 * @param {string} filename — default 'thematic-map'
 */
export async function exportToPdf(element, filename = 'thematic-map') {
  const canvas = await html2canvas(element, {
    backgroundColor: '#0f172a',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData   = canvas.toDataURL('image/png');
  const imgWidth  = canvas.width  / 2; // undo the 2x scale
  const imgHeight = canvas.height / 2;

  // Choose orientation based on aspect ratio
  const orientation = imgWidth >= imgHeight ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'px', format: [imgWidth, imgHeight + 40] });

  // Main image
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

  // Footer bar
  pdf.setFillColor(30, 41, 59); // #1e293b
  pdf.rect(0, imgHeight, imgWidth, 40, 'F');

  // Footer text
  pdf.setTextColor(148, 163, 184); // #94a3b8
  pdf.setFontSize(12);
  pdf.text('ThematicMap', 16, imgHeight + 26);
  pdf.setTextColor(100, 116, 139); // #64748b
  pdf.text(new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }), imgWidth - 16, imgHeight + 26, { align: 'right' });

  pdf.save(`${filename}-${datestamp()}.pdf`);
}

/** Returns a YYYYMMDD datestamp string for filenames */
function datestamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
