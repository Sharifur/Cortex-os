---
name: local-html-render
description: Pixel-precise CSS layout rendered via headless Chromium
triggers: ["html render", "css layout", "pixel precise", "chromium render", "web layout"]
backend_hints: ["local"]
inputs:
  - name: html_template
    optional: true
  - name: dimensions
    default: "1080x1080"
---

Use LocalRenderAdapter with Playwright/Chromium subprocess.
Requires Playwright installed: npx playwright install chromium.
Renders HTML/CSS template to PNG at device pixel ratio 2x for sharpness.
Use brand fonts via @import or local font paths.
Timeout: 60 seconds max.
Output: PNG at specified dimensions.
Best for: typography-heavy designs, complex layouts, CSS animations (first frame).
