/**
 * ReportChapter.js
 * ──────────────────────────────────────────────────────────────────────────
 * One chapter in the Living Report.
 *
 * PROPS:
 *   section {object}  — { themeId, theme, proseBlocks, pullQuoteIds }
 *   mode    {string}  — 'edit' | 'present' (Task 4 adds editing UI, Task 6 adds present mode)
 *
 * Header: color bar + theme label
 * Body: prose blocks rendered from parseInline tokens
 */

import React from 'react';
import { parseInline } from '../../utils/reportUtils';

export default function ReportChapter({ section, mode = 'edit' }) {
  const { theme, proseBlocks = [] } = section;
  const themeColor = theme?.color ?? '#6b6560';
  const themeLabel = theme ? theme.label : '(deleted theme)';
  const isDeleted = !theme;

  return (
    <section data-testid="report-chapter" style={{ marginBottom: '40px' }}>
      {/* Color bar header */}
      <div style={{ height: '8px', backgroundColor: themeColor, marginBottom: 0 }} />

      {/* Theme title */}
      <h2
        style={{
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontWeight: 700,
          fontSize: 28,
          margin: '16px 0 24px 0',
          fontStyle: isDeleted ? 'italic' : 'normal',
          color: isDeleted ? '#6b6560' : 'inherit',
        }}
      >
        {themeLabel}
      </h2>

      {/* Prose blocks (read-only in this task) */}
      {proseBlocks.map(block => (
        <p key={block.id} data-testid="prose-block" style={{ marginBottom: '16px' }}>
          {parseInline(block.text).map((token, idx) => {
            if (token.type === 'text') return token.content;
            if (token.type === 'bold') return <strong key={idx}>{token.content}</strong>;
            if (token.type === 'italic') return <em key={idx}>{token.content}</em>;
            return null;
          })}
        </p>
      ))}
    </section>
  );
}
