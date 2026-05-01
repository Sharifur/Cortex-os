// Curated emoji set for the visitor + operator pickers. Small enough to ship
// inline (no external sprite/font dep), broad enough to cover ~95% of chat use.

export interface EmojiCategory {
  name: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '😐', '😑', '😶', '🙄', '😏', '😒', '😞', '😔', '😟', '😕',
      '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
      '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰',
      '😥', '😓', '🤗', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏',
      '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷',
    ],
  },
  {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  },
  {
    name: 'Hands',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤝', '🙏', '✍️', '💪', '🦾'],
  },
  {
    name: 'Objects',
    emojis: ['🔥', '✨', '🎉', '🎊', '🎁', '🏆', '🥇', '⭐', '🌟', '💫', '💥', '💯', '✅', '❌', '⚠️', '❓', '❗', '💡', '📌', '📎', '🔗', '🔒', '🔑', '⏰', '⏳', '📅', '📆', '🗓️', '📊', '📈'],
  },
  {
    name: 'Travel',
    emojis: ['🚀', '✈️', '🚗', '🚕', '🚙', '🚌', '🏠', '🏢', '🏥', '🏦', '🏪', '🏫', '⛺', '🌍', '🌎', '🌏', '🗺️', '🏖️', '🏔️', '🌋'],
  },
];

/**
 * Common ASCII / kaomoji shortcuts. Replaced on word boundaries so partial
 * typing isn't disrupted; case-sensitive where it matters (`:p` lowercase
 * snipes a different emotion than `:P` uppercase, etc).
 */
export const EMOJI_SHORTCUTS: Array<[string, string]> = [
  [':)', '🙂'],
  [':-)', '🙂'],
  [':D', '😄'],
  [':-D', '😄'],
  ['xD', '😆'],
  ['XD', '😆'],
  [':P', '😛'],
  [':p', '😋'],
  [':-P', '😛'],
  [":'(", '😢'],
  [':(', '🙁'],
  [':-(', '🙁'],
  [';)', '😉'],
  [';-)', '😉'],
  [':O', '😮'],
  [':o', '😮'],
  [':-O', '😮'],
  [':oO', '😳'],
  [':|', '😐'],
  [':-|', '😐'],
  [':/', '😕'],
  [':-/', '😕'],
  ['<3', '❤️'],
  ['</3', '💔'],
  [':*', '😘'],
  ['B)', '😎'],
];

/**
 * Apply shortcut substitutions to a string. Walks the array in declaration
 * order so longer matches (`:-)` before `:)`) win over shorter prefixes.
 * Only triggers on word boundaries — `:Don't` doesn't get clobbered.
 */
export function applyEmojiShortcuts(input: string): string {
  let out = input;
  for (const [token, emoji] of EMOJI_SHORTCUTS) {
    // Escape regex metacharacters in the token.
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Boundary: preceded by start/whitespace, followed by end/whitespace/punct.
    const re = new RegExp(`(^|\\s)${escaped}(?=\\s|$|[.,!?])`, 'g');
    out = out.replace(re, `$1${emoji}`);
  }
  return out;
}
