/**
 * ReportMiniMap.js
 * ──────────────────────────────────────────────────────────────────────────
 * Fixed static SVG map of the Wall, highlighting the active chapter's region.
 * Used in present mode to show the reader where they are in the map.
 *
 * PROPS:
 *   regions       {array}   — Wall regions [{ id, themeId, rect: {x, y, w, h} }]
 *   nodes         {array}   — All nodes; used to look up theme colors and code positions
 *   activeThemeId {string}  — Current chapter's themeId; null when none active
 *
 * Returns null if regions is empty.
 */

export default function ReportMiniMap({ regions, nodes, activeThemeId }) {
  if (!regions || regions.length === 0) return null;

  // Build a map of themeId → node for quick color lookup
  const themesById = new Map();
  nodes.forEach(n => {
    if (n.type === 'theme') themesById.set(n.id, n);
  });

  // Compute bounding box of all region rects + 24px padding
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  regions.forEach(r => {
    minX = Math.min(minX, r.rect.x);
    minY = Math.min(minY, r.rect.y);
    maxX = Math.max(maxX, r.rect.x + r.rect.w);
    maxY = Math.max(maxY, r.rect.y + r.rect.h);
  });

  const padding = 24;
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;
  const viewBoxW = maxX - minX + 2 * padding;
  const viewBoxH = maxY - minY + 2 * padding;

  return (
    <div
      data-testid="report-minimap"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        width: '200px',
        height: '140px',
        backgroundColor: 'white',
        border: '2px solid #0f0d0a',
        boxShadow: '4px 4px 0 #0f0d0a',
        zIndex: 50,
      }}
    >
      <svg
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* Render regions */}
        {regions.map(r => {
          const theme = themesById.get(r.themeId);
          const isActive = r.themeId === activeThemeId;
          const color = theme?.color ?? '#6b6560';
          const fillOpacity = isActive ? 0.55 : 0.18;
          const strokeWidth = isActive ? 6 : 2;

          return (
            <rect
              key={r.id}
              x={r.rect.x}
              y={r.rect.y}
              width={r.rect.w}
              height={r.rect.h}
              fill={color}
              fillOpacity={fillOpacity}
              stroke={color}
              strokeWidth={strokeWidth}
            />
          );
        })}

        {/* Render code dots at wallPosition */}
        {nodes.map(n => {
          if (n.type !== 'code' || !n.wallPosition) return null;
          return (
            <circle
              key={n.id}
              cx={n.wallPosition.x}
              cy={n.wallPosition.y}
              r={6}
              fill="#6b6560"
              opacity={0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
