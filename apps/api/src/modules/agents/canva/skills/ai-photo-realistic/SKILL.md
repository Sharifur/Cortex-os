---
name: ai-photo-realistic
description: Generate photo-style content using AI image generation
triggers: ["photo", "photo-realistic", "photography", "product photo", "lifestyle", "realistic"]
backend_hints: ["ai_image"]
inputs:
  - name: style
    default: "natural"
  - name: dimensions
    default: "1024x1024"
---

Provider: DALL-E 3 primary (style=natural), Stability AI fallback.
Avoid illustration/cartoon language in prompt.
Prompt: photorealistic, high resolution, professional photography, [subject], [lighting], [composition].
Use negative_prompt on Stability: "cartoon, illustration, anime, painting".
Download bytes — never store URL alone.
