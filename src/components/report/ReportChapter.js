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
 * Body: prose blocks (click-to-edit in edit mode), rendered from parseInline tokens
 * Edit controls: add paragraph button, per-block delete buttons
 */

import React, { useState } from 'react';
import { useGraphDispatch, makeId } from '../../context/GraphContext';
import { parseInline } from '../../utils/reportUtils';

export default function ReportChapter({
  section,
  mode = 'edit',
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}) {
  const { themeId, theme, proseBlocks = [] } = section;
  const dispatch = useGraphDispatch();
  const themeColor = theme?.color ?? '#6b6560';
  const themeLabel = theme ? theme.label : '(deleted theme)';
  const isDeleted = !theme;

  // Local editing state: track which block is being edited and its current text
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [editingText, setEditingText] = useState('');

  /**
   * Enter edit mode for a block: capture original text and autofocus textarea
   */
  function handleStartEdit(blockId, originalText) {
    setEditingBlockId(blockId);
    setEditingText(originalText);
  }

  /**
   * On blur: commit to store only if text changed
   */
  function handleBlur() {
    const blockId = editingBlockId;
    if (blockId && editingText !== (proseBlocks.find(b => b.id === blockId)?.text ?? '')) {
      dispatch({
        type: 'REPORT_UPDATE_BLOCK',
        themeId,
        blockId,
        text: editingText,
      });
    }
    setEditingBlockId(null);
    setEditingText('');
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

      {/* Prose blocks with click-to-edit */}
      {proseBlocks.map(block => (
        <div
          key={block.id}
          data-testid="prose-block"
          style={{
            marginBottom: '16px',
            position: 'relative',
            group: 'item',
          }}
          onMouseEnter={() => {
            // Show delete button on hover in edit mode
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
                  className="group-hover:opacity-100"
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
    </section>
  );
}
