import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { color, font } from 'q-wash-shared';

// Mobile-only bottom action area (design: a gradient fade over the page with
// the primary action pinned to the bottom edge). The spacer keeps the last
// content row from sitting underneath it.
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden style={{ height: 90 }} />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '16px 18px 30px',
          background: `linear-gradient(180deg, rgba(18,18,17,0), ${color.surface} 34%)`,
          zIndex: 12,
          display: 'flex',
          gap: 10,
        }}
      >
        {children}
      </div>
    </>
  );
}

export function StickyButton({
  accent = true,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { accent?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 15,
        fontFamily: font.body,
        fontSize: 15,
        fontWeight: 700,
        cursor: props.disabled ? 'default' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        background: accent ? color.gold : color.panel,
        color: accent ? color.goldOnLight : color.textPrimaryAlt,
        border: `1px solid ${accent ? color.gold : color.borderDashed}`,
        ...style,
      }}
    />
  );
}
