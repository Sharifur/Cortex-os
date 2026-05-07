---
name: canva-social-post
description: Generate on-brand social media posts using Canva templates
triggers: ["instagram post", "social media", "facebook ad", "social post", "square post", "story", "reel cover", "tweet image", "linkedin post"]
backend_hints: ["canva"]
inputs:
  - name: brand_kit_id
    optional: true
  - name: dimensions
    default: "1080x1080"
  - name: platform
    optional: true
---

Use generate-design-structured with intent=social_post.
Always call list-brand-kits first if brand_kit_id is not supplied.
Preferred dimensions: 1080x1080 (square), 1080x1920 (story), 1200x628 (LinkedIn).
Apply brand palette via perform-editing-operations after transaction starts.
Export as PNG. Capture thumbnail immediately after export.
Generate 2-3 variants using different template styles (minimal, bold, illustrated).
