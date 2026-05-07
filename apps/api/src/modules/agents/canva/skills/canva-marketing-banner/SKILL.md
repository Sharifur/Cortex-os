---
name: canva-marketing-banner
description: Create web banners, hero images, and marketing headers using Canva
triggers: ["banner", "hero image", "web banner", "header", "advertisement", "ad banner", "linkedin banner", "marketing"]
backend_hints: ["canva"]
inputs:
  - name: dimensions
    default: "1200x628"
  - name: brand_kit_id
    optional: true
---

Use generate-design-structured with intent=marketing_banner.
Standard sizes: 1200x628 (social/OG), 1200x627 (LinkedIn), 728x90 (leaderboard), 300x250 (medium rectangle).
Always apply brand palette and fonts.
For composite banners: upload AI illustration via upload-asset-from-url, then embed in the design.
Export as PNG for web, PDF for print.
