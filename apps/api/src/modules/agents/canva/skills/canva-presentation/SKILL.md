---
name: canva-presentation
description: Build presentation decks from an outline using Canva structured generation
triggers: ["presentation", "slide deck", "pitch deck", "keynote", "slides", "deck"]
backend_hints: ["canva"]
inputs:
  - name: outline
    optional: true
  - name: slide_count
    default: 10
  - name: dimensions
    default: "1920x1080"
---

Use generate-design-structured with intent=presentation.
Call request-outline-review on the outline before populating slides.
Standard dimensions: 1920x1080 (16:9 widescreen).
Apply brand fonts and palette via editing transaction.
Export as PDF for print quality, or PNG per-slide if requested.
Limit to 1 candidate for presentations (complexity is high).
