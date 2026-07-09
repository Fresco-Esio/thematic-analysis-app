/**
 * ReportChapter.js
 * ──────────────────────────────────────────────────────────────────────────
 * One chapter in the Living Report.
 *
 * PROPS:
 *   section {object}  — { themeId, theme, proseBlocks, pullQuoteIds }
 *   mode    {string}  — 'edit' | 'present'
 *   onMoveUp, onMoveDown, isFirst, isLast — (Task 4) reorder callbacks
 *
 * Header: color bar + theme label + (edit mode) reorder buttons
 * Body: two-column grid — prose left (1fr), pull-quote margin right (220px)
 * Pull quotes: live or tombstone display; drag+click to add/remove (edit mode)
 * Code tray: per-chapter codes, draggable and clickable (edit mode)
 */

import React, { useState } from 'react';
import { useGraphDispatch, useGraph, makeId } from '../../context/GraphContext';
import { parseInline, pullQuoteFor } from '../../utils/reportUtils';

export default function ReportChapter({
  section,
  mode = 'edit',
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}) {
  const { themeId, theme, proseBlocks = [], pullQuoteIds = [] } = section;
  const dispatch = useGraphDispatch();
  const { nodes } = useGraph();
  const themeColor = theme?.color ?? '#6b6560';
  const themeLabel = theme ? theme.label : '(deleted theme)';
  const isDeleted = !theme;

  // Local editing state: track which block is being edited and its current text
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [editingText, setEditingText] = useState('');
  // Capture original text when entering edit mode for comparison on blur
  const [originalText, setOriginalText] = useState('');

  // Margin drop zone state
  const [dragOverMargin, setDragOverMargin] = useState(false);

  /**
   * Enter edit mode for a block: capture original text and autofocus textarea
   */
  function handleStartEdit(blockId, blockText) {
    setEditingBlockId(blockId);
    setEditingText(blockText);
    setOriginalText(blockText);
  }

  /**
   * On blur: commit to store only if text changed
   */
  function handleBlur() {
    const blockId = editingBlockId;
    if (blockId && editingText !== originalText) {
      dispatch({
        type: 'REPORT_UPDATE_BLOCK',
        themeId,
        blockId,
        text: editingText,
      });
    }
    setEditingBlockId(null);
    setEditingText('');
    setOriginalText('');
  }

  /**
   * Escape cancels without saving
   */
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditingBlockId(null);
      setEditingText('');
    }
  }

  /**
   * Add a new empty block
   */
  function handleAddParagraph() {
    const blockId = makeId('block');
    dispatch({
      type: 'REPORT_ADD_BLOCK',
      themeId,
      blockId,
    });
    // Immediately enter edit mode for the new block after it's added
    setTimeout(() => {
      setEditingBlockId(blockId);
      setEditingText('');
      setOriginalText('');
    }, 0);
  }

  /**
   * Delete a block after confirmation
   */
  function handleDeleteBlock(blockId) {
    if (window.confirm('Delete this paragraph?')) {
      dispatch({
        type: 'REPORT_DELETE_BLOCK',
        themeId,
        blockId,
      });
    }
  }

  /**
   * Margin drag-over handlers
   */
  function handleMarginDragOver(e) {
    e.preventDefault();
    setDragOverMargin(true);
  }

  function handleMarginDragLeave(e) {
    if (e.currentTarget === e.target) {
      setDragOverMargin(false);
    }
  }

  function handleMarginDrop(e) {
    e.preventDefault();
    setDragOverMargin(false);
    const codeId = e.dataTransfer.getData('text/ta-code-id');
    if (codeId) {
      dispatch({
        type: 'REPORT_ADD_PULL_QUOTE',
        themeId,
        codeId,
      });
    }
  }

  /**
   * Add a pull quote via click affordance (from code tray)
   */
  function handleAddPullQuote(codeId) {
    dispatch({
      type: 'REPORT_ADD_PULL_QUOTE',
      themeId,
      codeId,
    });
  }

  /**
   * Remove a pull quote
   */
  function handleRemovePullQuote(codeId) {
    dispatch({
      type: 'REPORT_REMOVE_PULL_QUOTE',
      themeId,
      codeId,
    });
  }

  // Codes for this chapter (used in tray and for checking already-added)
  const chapterCodes = nodes.filter(n => n.type === 'code' && n.primaryThemeId === themeId);

  return (
    <section data-testid="report-chapter" style={{ marginBottom: '40px' }}>
      {/* Color bar header */}
      <div style={{ height: '8px', backgroundColor: themeColor, marginBottom: 0 }} />

      {/* Theme title with reorder buttons (edit mode only) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '16px 0 24px 0',
        }}
      >
        <h2
          style={{
            fontFamily: 'Bricolage Grotesque, sans-serif',
            fontWeight: 700,
            fontSize: 28,
            margin: 0,
            fontStyle: isDeleted ? 'italic' : 'normal',
            color: isDeleted ? '#6b6560' : 'inherit',
          }}
        >
          {themeLabel}
        </h2>

        {/* Reorder buttons (edit mode only) */}
        {mode === 'edit' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              aria-label="Move chapter up"
              style={{
                padding: '4px 8px',
                backgroundColor: isFirst ? '#e5e7eb' : '#0f0d0a',
                color: isFirst ? '#9ca3af' : '#f0ebe3',
                border: 'none',
                cursor: isFirst ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              ↑
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              aria-label="Move chapter down"
              style={{
                padding: '4px 8px',
                backgroundColor: isLast ? '#e5e7eb' : '#0f0d0a',
                color: isLast ? '#9ca3af' : '#f0ebe3',
                border: 'none',
                cursor: isLast ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              ↓
            </button>
          </div>
        )}
      </div>

      {/* Code tray (edit mode only) */}
      {mode === 'edit' && chapterCodes.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '12px',
              letterSpacing: '0.1em',
              color: '#6b6560',
              marginBottom: '12px',
              fontWeight: 600,
            }}
          >
            CODES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {chapterCodes.map(code => {
              const isAdded = pullQuoteIds.includes(code.id);
              return (
                <div
                  key={code.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    borderLeft: `3px solid ${code.color}`,
                    boxShadow: '2px 2px 0 rgba(0, 0, 0, 0.05)',
                    opacity: isAdded ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 500, flex: 1 }}>
                    {code.label}
                  </span>
                  <button
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('text/ta-code-id', code.id);
                    }}
                    onClick={() => handleAddPullQuote(code.id)}
                    aria-label={`Add as pull quote: ${code.label}`}
                    disabled={isAdded}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: isAdded ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      padding: '2px 4px',
                      opacity: isAdded ? 0 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    ❝
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Body grid: prose left, pull-quotes margin right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 220px',
          gap: '24px',
        }}
      >
        {/* Prose column */}
        <div>
          {proseBlocks.map(block => (
            <div
              key={block.id}
              data-testid="prose-block"
              style={{
                marginBottom: '16px',
                position: 'relative',
              }}
            >
              {editingBlockId === block.id ? (
                // Textarea edit mode
                <textarea
                  autoFocus
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    fontSize: 17,
                    lineHeight: 1.6,
                    border: '2px solid #dc2626',
                    padding: '8px',
                    marginBottom: '16px',
                    boxSizing: 'border-box',
                    fontFamily: 'Bricolage Grotesque, sans-serif',
                    resize: 'none',
                  }}
                  rows={Math.max(2, editingText.split('\n').length)}
                />
              ) : (
                // Rendered paragraph (click to edit)
                <>
                  <p
                    role="button"
                    tabIndex={0}
                    aria-label="Edit paragraph"
                    onClick={() => handleStartEdit(block.id, block.text)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStartEdit(block.id, block.text);
                      }
                    }}
                    style={{
                      cursor: mode === 'edit' ? 'pointer' : 'default',
                      margin: 0,
                      marginBottom: '16px',
                      padding: mode === 'edit' ? '8px' : '0',
                      borderRadius: mode === 'edit' ? '4px' : '0',
                      transition: mode === 'edit' ? 'background-color 0.2s' : 'none',
                    }}
                    onMouseOver={(e) => {
                      if (mode === 'edit') {
                        e.currentTarget.style.backgroundColor = '#f5f5f0';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (mode === 'edit') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {parseInline(block.text).map((token, idx) => {
                      if (token.type === 'text') return token.content;
                      if (token.type === 'bold') return <strong key={idx}>{token.content}</strong>;
                      if (token.type === 'italic') return <em key={idx}>{token.content}</em>;
                      return null;
                    })}
                  </p>

                  {/* Delete button (edit mode only, shown on hover) */}
                  {mode === 'edit' && (
                    <button
                      onClick={() => handleDeleteBlock(block.id)}
                      aria-label="Delete paragraph"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontSize: '16px',
                        padding: '4px 8px',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        pointerEvents: 'auto',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      ✕
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Add paragraph button (edit mode only) */}
          {mode === 'edit' && (
            <button
              onClick={handleAddParagraph}
              aria-label="Add paragraph"
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                backgroundColor: '#0f0d0a',
                color: '#f0ebe3',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              ＋ Add paragraph
            </button>
          )}
        </div>

        {/* Pull quotes margin column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minHeight: '200px',
            ...(mode === 'edit'
              ? {
                  borderRadius: '4px',
                  transition: dragOverMargin ? 'outline 0.2s' : 'outline 0.2s',
                  outline: dragOverMargin ? '2px dashed #dc2626' : '2px dashed transparent',
                  padding: '12px',
                  marginLeft: '-12px',
                  marginRight: '-12px',
                }
              : {}),
          }}
          onDragOver={mode === 'edit' ? handleMarginDragOver : undefined}
          onDragLeave={mode === 'edit' ? handleMarginDragLeave : undefined}
          onDrop={mode === 'edit' ? handleMarginDrop : undefined}
        >
          {pullQuoteIds.map(codeId => {
            const q = pullQuoteFor(codeId, nodes);
            return (
              <blockquote
                key={codeId}
                data-testid="pull-quote"
                style={{
                  margin: 0,
                  padding: '12px',
                  paddingLeft: '12px',
                  borderLeft: q.tombstone ? '3px dashed #9ca3af' : `3px solid ${q.color}`,
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                {q.tombstone ? (
                  <div style={{ fontStyle: 'italic', color: '#9ca3af' }}>
                    Removed code — this quote's source was deleted.
                  </div>
                ) : (
                  <>
                    <div style={{ fontStyle: 'italic', marginBottom: '8px', color: '#374151' }}>
                      {q.quote || <span style={{ color: '#9ca3af' }}>No quote recorded</span>}
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{q.label}</div>
                    <div style={{ fontSize: '11px', letterSpacing: '0.05em', color: '#6b7280', textTransform: 'uppercase' }}>
                      {q.source}
                    </div>
                  </>
                )}
                {/* Remove button (edit mode only) */}
                {mode === 'edit' && (
                  <button
                    onClick={() => handleRemovePullQuote(codeId)}
                    aria-label="Remove pull quote"
                    style={{
                      marginTop: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '2px 4px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </blockquote>
            );
          })}
        </div>
      </div>
    </section>
  );
}
