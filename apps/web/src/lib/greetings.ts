// Greeting / smalltalk lookup table.
// Entries are pre-normalized: lowercase, emoji + punctuation stripped,
// whitespace collapsed. Use `normalizeForGreeting()` on incoming text
// before checking `GREETING_SET.has(...)`.

export function normalizeForGreeting(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[!?.,;:'"`~()[\]{}<>\-_*+=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const GREETING_LIST: readonly string[] = [
  // ── English: hi / hello / hey ──────────────────────────────────────────
  'hi', 'hii', 'hiii', 'hiiii', 'hiiiii', 'hi there', 'hi all', 'hi everyone',
  'hi team', 'hi bot', 'hi cortex', 'hi friend', 'hi mate', 'hi buddy',
  'hello', 'helo', 'hellooo', 'hellooooo', 'hello there', 'hello bot',
  'hello cortex', 'hello everyone', 'hello team', 'hello friend',
  'hey', 'heyy', 'heyyy', 'heyyyy', 'hey there', 'hey bot', 'hey cortex',
  'hey buddy', 'hey mate', 'hey friend', 'hey team', 'heya', 'heyo', 'hiya',
  'hiyaa', 'hai', 'haii', 'haiii',
  'yo', 'yoo', 'yooo', 'yooooo', 'yo bot', 'yo cortex',
  'sup', 'suppp', 'wassup', 'wazzup', 'whaddup',
  'howdy', 'howdy partner', 'howdy folks', 'howdy yall',
  'greetings', 'salutations',

  // ── English: how are you ──────────────────────────────────────────────
  'how are you', 'how are you doing', 'how are you today', 'how r u',
  'how r you', 'how are u', 'how r ya', 'how are ya', 'how are yall',
  'how are y all', 'how do you do', 'how is it going', 'how s it going',
  'hows it going', 'how is everything', 'how s everything', 'hows everything',
  'how are things', 'how s things', 'hows things', 'how have you been',
  'how have u been', 'how was your day', 'how was ur day', 'whats up',
  'what s up', 'whats up bot', 'what s good', 'whats good', 'sup bro',
  'sup buddy', 'how goes it',

  // ── English: time-of-day ──────────────────────────────────────────────
  'good morning', 'good morning bot', 'good morning team', 'g morning',
  'gd morning', 'gud morning', 'good mornin', 'morning', 'mornin',
  'good afternoon', 'good aftnoon', 'gd afternoon', 'afternoon',
  'good evening', 'good evenin', 'gd evening', 'evening',
  'good night', 'good nite', 'good nyt', 'gd night', 'gn', 'nighty night',
  'goodnight', 'sweet dreams', 'sleep well', 'sleep tight',
  'good day', 'gday', 'g day', 'gm', 'ge', 'ga',
  'have a good day', 'have a great day', 'have a nice day',
  'have a good one', 'have a great one', 'have a nice one',
  'have a good night', 'have a good evening',

  // ── English: thanks ───────────────────────────────────────────────────
  'thanks', 'thanksss', 'thank you', 'thank u', 'thanku', 'thankyou',
  'thank you so much', 'thank u so much', 'thanks so much', 'thanks a lot',
  'thanks a ton', 'thanks a bunch', 'thanks a million', 'thanks very much',
  'thank you very much', 'thank you very kindly', 'thank you kindly',
  'many thanks', 'much thanks', 'much appreciated', 'really appreciate it',
  'appreciate it', 'appreciate that', 'appreciate you', 'thx', 'thxx',
  'thnx', 'tnx', 'tnks', 'ty', 'tysm', 'tyvm', 'thanq', 'thnks',
  'cheers', 'cheers mate', 'cheers buddy', 'kudos', 'props',
  'youre the best', 'you are the best', 'youre awesome', 'you are awesome',
  'youre a star', 'legend',

  // ── English: ok / yes / no / fillers ──────────────────────────────────
  'ok', 'okk', 'okkk', 'okkkk', 'okay', 'okayy', 'k', 'kk', 'kkk',
  'alright', 'aight', 'all right', 'sure', 'sure thing', 'sure sure',
  'fine', 'thats fine', 'that s fine', 'cool', 'cool cool', 'too cool',
  'nice', 'very nice', 'super nice', 'great', 'so great', 'awesome',
  'amazing', 'perfect', 'brilliant', 'lovely', 'sweet', 'neat', 'rad',
  'gotcha', 'got it', 'got that', 'roger', 'roger that', 'copy that',
  'ack', 'acked', 'noted', 'understood', 'understood thanks', 'right',
  'right right', 'yep', 'yepp', 'yeah', 'yeahh', 'yup', 'yupp',
  'yes', 'yess', 'yesss', 'yass', 'yasss', 'absolutely', 'definitely',
  'totally', 'agreed', 'agree', 'no', 'noo', 'nope', 'nah', 'naah', 'nay',
  'no way', 'no thanks', 'no thank you', 'np', 'no problem', 'no worries',
  'no prob', 'no probs', 'all good', 'we good', 'were good',

  // ── English: bye ──────────────────────────────────────────────────────
  'bye', 'byee', 'byeee', 'byeeee', 'bye bye', 'goodbye', 'good bye',
  'cya', 'cyaa', 'see ya', 'see you', 'see u', 'see you later',
  'see ya later', 'see u later', 'see you soon', 'see ya soon',
  'see you tomorrow', 'see u tomorrow', 'talk later', 'talk to you later',
  'talk soon', 'ttyl', 'gtg', 'gtg bye', 'g2g', 'peace', 'peace out',
  'later', 'laters', 'farewell', 'take care', 'take care now', 'tata',
  'adios', 'au revoir', 'sayonara', 'ciao bye',

  // ── English: capability / help ────────────────────────────────────────
  'help', 'menu', 'commands', 'command', 'options', 'option',
  'capabilities', 'capability', 'about', 'whoami',
  'what can you do', 'what can u do', 'what do you do', 'what u do',
  'who are you', 'who r u', 'who are u', 'who is this', 'whats this',
  'what s this', 'what are you', 'what r u', 'what is this bot',
  'how do you work', 'how do u work',

  // ── Slash commands ────────────────────────────────────────────────────
  '/start', '/help', '/menu', '/about', '/commands',

  // ── Spanish ───────────────────────────────────────────────────────────
  'hola', 'hola amigo', 'hola amiga', 'que tal', 'que pasa', 'buenos dias',
  'buenas tardes', 'buenas noches', 'gracias', 'muchas gracias', 'mil gracias',
  'adios', 'hasta luego', 'hasta manana',

  // ── French ────────────────────────────────────────────────────────────
  'bonjour', 'bonsoir', 'salut', 'coucou', 'merci', 'merci beaucoup',
  'merci bien', 'au revoir', 'a bientot',

  // ── Italian / Portuguese ──────────────────────────────────────────────
  'ciao', 'ciao bella', 'ciao amico', 'buongiorno', 'buonasera',
  'grazie', 'grazie mille', 'arrivederci',
  'ola', 'ola amigo', 'bom dia', 'boa tarde', 'boa noite', 'obrigado',
  'obrigada',

  // ── Arabic / Urdu (transliterated) ────────────────────────────────────
  'salam', 'salaam', 'slm', 'as salam', 'as salaam',
  'assalamualaikum', 'assalam alaikum', 'as salamu alaykum',
  'salam alaikum', 'salam aleikum',
  'walaikum assalam', 'walaikumassalam', 'walaikumsalam', 'wa alaikum salam',
  'marhaba', 'ahlan', 'ahlan wa sahlan', 'shukran', 'shukran jazilan',
  'maa salama',
  'aap kaise hain', 'aap kaise ho', 'kaise ho', 'kya haal hai',
  'kya hal hai', 'shukriya', 'bahut shukriya',

  // ── Bengali / Bangla (transliterated) ─────────────────────────────────
  'kemon acho', 'kemon achen', 'kemne acho', 'kemon aso', 'tumi kemon acho',
  'apni kemon achen', 'bhalo achi', 'valo achi', 'bhalo asi', 'valo asi',
  'shubho sokal', 'shubho dupur', 'shubho bikal', 'shubho ratri',
  'shuvo sokal', 'shuvo ratri',
  'nomoshkar', 'nomoskar', 'pronam', 'salaam vai', 'salam bhai',
  'kemon achen vai', 'kemon achen bhai', 'vai kemon acho', 'bhai kemon acho',
  'dhonnobad', 'donnobad', 'thanks vai', 'thanks bhai',
  'allah hafez', 'khoda hafez', 'khuda hafiz',

  // ── Hindi (transliterated) ────────────────────────────────────────────
  'namaste', 'namaskar', 'pranam', 'pranaam',
  'kaise ho', 'kaise hain', 'kaise ho aap', 'theek ho', 'thik ho',
  'sab badhiya', 'sab badiya', 'sab thik', 'shukriya', 'dhanyavaad',
  'dhanyawad', 'alvida', 'phir milenge',

  // ── German / Dutch / Nordic ──────────────────────────────────────────
  'hallo', 'guten tag', 'guten morgen', 'guten abend', 'gute nacht',
  'danke', 'danke schon', 'tschuss', 'auf wiedersehen',
  'hoi', 'hallo daar', 'goedemorgen', 'dank je', 'dank u',
  'hej', 'hej hej', 'tack', 'tak', 'hei', 'moi',

  // ── Japanese / Chinese / Korean (romaji / pinyin) ─────────────────────
  'konnichiwa', 'konichiwa', 'ohayou', 'ohayo', 'konbanwa', 'oyasumi',
  'arigatou', 'arigato', 'arigatou gozaimasu', 'sayonara', 'mata ne',
  'ni hao', 'nihao', 'zao shang hao', 'wan shang hao', 'xie xie', 'xiexie',
  'zai jian',
  'annyeong', 'annyeonghaseyo', 'kamsahamnida', 'gomawo',

  // ── Hawaiian / Pacific ────────────────────────────────────────────────
  'aloha', 'aloha friend', 'mahalo',

  // ── Casual / slang ────────────────────────────────────────────────────
  'whats good', 'what s good', 'whaddup', 'wagwan', 'oi', 'ello', 'ello mate',
  'gday mate', 'allo', 'salut mon ami', 'que onda',
  'hey hey', 'hi hi', 'hellohello',
  'long time no see', 'long time', 'its been a while', 'it s been a while',
  'nice to meet you', 'pleased to meet you', 'glad to meet you',
  'pleasure', 'a pleasure',

  // ── Reactions / one-word affirmations ────────────────────────────────
  'wow', 'woah', 'whoa', 'omg', 'lol', 'lmao', 'rofl', 'haha', 'hahaha',
  'hehe', 'hehehe', 'hmm', 'hmmm', 'oh', 'ohh', 'ah', 'ahh', 'aha', 'ahaa',
  'oof', 'yay', 'yayy', 'yikes', 'damn', 'sheesh', 'bruh', 'bro',
];

const _normalized = GREETING_LIST.map((g) => normalizeForGreeting(g));
export const GREETING_SET: ReadonlySet<string> = new Set(_normalized);

export function isGreetingExact(text: string): boolean {
  return GREETING_SET.has(normalizeForGreeting(text));
}
