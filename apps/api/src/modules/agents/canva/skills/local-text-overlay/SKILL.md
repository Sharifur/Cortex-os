---
name: local-text-overlay
description: Quick text-on-image quote cards using Pillow — fast local render
triggers: ["quote card", "quote", "text overlay", "text on image", "quick graphic", "word art"]
backend_hints: ["local"]
inputs:
  - name: bg_color
    default: "#1e1b4b"
  - name: fg_color
    default: "#ffffff"
  - name: dimensions
    default: "1080x1080"
---

Use LocalRenderAdapter with Pillow.
Background color from brand palette[0] if available.
Render headline in large bold font, subheadline in regular, CTA in accent color (palette[2]).
Font: system DejaVu Sans or fallback to PIL default.
Timeout: 60 seconds max.
Output: PNG.
Fastest option — use when time is critical or for quick drafts.
