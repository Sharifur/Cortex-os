---
name: composite-design
description: Composite design — AI illustration layer embedded into a Canva template
triggers: ["composite", "ai overlay", "mixed media", "illustration in canva", "custom background", "unique design"]
backend_hints: ["canva", "ai_image"]
inputs:
  - name: ai_style
    default: "illustration"
  - name: dimensions
    default: "1080x1080"
---

Two-phase pipeline:
1. Generate AI illustration via AIImageAdapter (style=illustration).
2. Upload illustration to Canva via upload-asset-from-url to get asset_id.
3. Call generate-design-structured with asset_id as background reference.
4. Apply brand palette and typography via editing transaction.
5. Export as PNG.

This skill produces the most unique outputs as the AI illustration is bespoke.
Use when the brief emphasizes uniqueness, custom visuals, or brand creativity.
