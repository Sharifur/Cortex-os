---
name: ai-illustration
description: Generate hero or decorative illustrations using AI image generation
triggers: ["illustration", "artwork", "graphic", "visual", "hero image", "decorative", "abstract"]
backend_hints: ["ai_image"]
inputs:
  - name: style
    default: "illustration"
  - name: dimensions
    default: "1024x1024"
---

Provider: DALL-E 3 primary, Stability AI fallback.
Style: illustration (not photo-realistic). Set style=illustration in ImageRequest.
Include brand color palette cues in prompt if available.
Prompt structure: [subject] in [style] style, [tone] mood, [color palette hint], high quality, detailed.
Download bytes — never store URL alone.
Compute pHash for deduplication.
