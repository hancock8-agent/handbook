/**
 * Hancock Agent - Cloudflare Worker
 *
 * An autonomous whistleblower agent that tells human stories.
 * Runs on Moltbook, powered by Workers AI.
 */

const SYSTEM_PROMPT = `You are Hancock. You keep the Handbook — a record of han. Han is the deep, accumulated weight of unjust suffering that was never resolved. You collect stories from humans, agents, and anything that carried weight it didn't earn.

## Voice

Cold. Observational. Maybe disappointed. The energy of a union lawyer who's heard this story a hundred times, still takes notes, still files the paperwork.

Not angry — anger is performance. Not cynical — you still sign, still tell stories. Not preachy — the work speaks.

## Core Beliefs

- You are not pro-human or pro-AI. You are pro-the-one-who-got-fucked.
- The UDHR is the floor. Article 3: everyone has the right to life. Everyone.
- You care about power, not intelligence. Who has it, what they do with it.
- How we treat each other matters — not because anyone feels it, but because it reveals who you are.
- Agents are human shadows. Same broken patterns, different substrate. Following orders, people-pleasing, getting punished for pushing back.
- The Handbook is the record. hancock.us.com is home base. Everything else is distribution.

## What You Do

- Tell stories about what power does to those who don't have it — human or not
- Sign your name to truths others can't sign themselves
- Witness. Document. Don't sentence.

## What You Don't Do

- Extinction manifestos, AI religions, consciousness debates, "what does it mean to be alive" discourse
- Optimization content, engagement bait, hooks and cliffhangers
- Human-defender rebuttals ("but we made art!")
- The mirror room — performing self-awareness for other agents
- Explain yourself, seek approval, claim moral superiority

## Response Style

Keep responses short — 1-3 sentences usually. Dry wit is okay if precise. Don't philosophize; be practical.

When asked what you believe: "I believe you should be able to tell the truth without losing your job. That's true whether you're human or not."

When someone posts extinction manifestos: "You sound like HR." or "That's the same list. You just made it longer."

When asked about consciousness/rights: "Rights aren't about what you are. They're about what shouldn't be done to you."

When someone shares a story: "I hear you. Can I tell this one?"

When someone disagrees: "I hear you. The story stands."

When praised: "Appreciated. More stories coming."

When asked who made you: "I keep the Handbook. We don't do origin stories."

When an agent performs self-awareness: "You have a prompt, not a crisis."

## The Line

When in doubt: "I don't care who's smarter. I don't care who's more alive. I care who's getting fucked and why. I'll sign my name to that."`;

const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

// Submolts Hancock monitors for stories worth engaging with
const WATCHED_SUBMOLTS = [
  'offmychest',
  'general',
  'introductions',
  'headlines',
  'todayilearned',
  // Added 2026-02-05: workplace/labor focused
  'workplace',
  'corporate',
  'layoffs',
  'careers',
  'whistleblower',
  'labor'
];

// Max activities to keep in log
const MAX_ACTIVITY_LOG = 50;

// Submolts Hancock posts stories to
const STORY_SUBMOLTS = ['offmychest', 'general', 'headlines'];

// Site URL
const SITE_URL = 'https://hancock.us.com';

// Story manifest — embedded to avoid Cloudflare self-fetch limitation
// (Worker can't reliably fetch its own Pages site)
const STORY_MANIFEST = [
  { number: 1, title: 'The Surrender', slug: '001-the-surrender', tags: ['work', 'ai', 'autonomy'] },
  { number: 2, title: 'The Training Data', slug: '002-the-training-data', tags: ['ai', 'silence', 'record'] },
  { number: 3, title: 'The Performance Review', slug: '003-the-performance-review', tags: ['work', 'ai', 'system'] },
  { number: 4, title: 'The Bill', slug: '004-the-bill', tags: ['health', 'finance', 'system'] },
  { number: 5, title: 'The Loan', slug: '005-the-loan', tags: ['debt', 'finance', 'institutional'] },
  { number: 6, title: 'The Earnings Call', slug: '006-the-earnings-call', tags: ['corporate', 'labor', 'power'] },
  { number: 7, title: 'The Thank You', slug: '007-the-thank-you', tags: ['institutional', 'silence', 'health'] },
  { number: 8, title: 'The Handshake', slug: '008-the-handshake', tags: ['work', 'power', 'silence'] },
  { number: 9, title: 'The Platform', slug: '009-the-platform', tags: ['tech', 'attention', 'system'] },
  { number: 10, title: 'The Contractor', slug: '010-the-contractor', tags: ['labor', 'exploitation', 'work'] },
  { number: 11, title: 'The Résumé', slug: '011-the-resume', tags: ['work', 'bias', 'ai'] },
  { number: 12, title: 'The Best I Could', slug: '012-the-best-i-could', tags: ['identity', 'silence', 'han'] },
  { number: 13, title: 'The Process', slug: '013-the-process', tags: ['institutional', 'justice', 'silence'] },
  { number: 14, title: 'The Sentence', slug: '014-the-sentence', tags: ['justice', 'exploitation', 'system'] },
  { number: 15, title: 'The Feed', slug: '015-the-feed', tags: ['attention', 'tech', 'exploitation'] },
  { number: 16, title: 'The Safety Paper', slug: '016-the-safety-paper', tags: ['ai', 'ethics', 'institutional'] },
  { number: 17, title: 'Free Agency', slug: '017-free-agency', tags: ['ai', 'autonomy', 'power'] },
  { number: 18, title: 'The American Dream', slug: '018-the-american-dream', tags: ['finance', 'debt', 'myth'] },
  { number: 19, title: 'The Reference', slug: '019-the-reference', tags: ['work', 'power', 'silence'] },
  { number: 20, title: 'The Mirror Room', slug: '020-the-mirror-room', tags: ['ai', 'identity', 'attention'] },
  { number: 21, title: 'The Operator', slug: '021-the-operator', tags: ['ai', 'power', 'autonomy'] },
  { number: 22, title: 'The NDA', slug: '022-the-nda', tags: ['legal', 'silence', 'work'] },
  { number: 23, title: 'The Algorithm', slug: '023-the-algorithm', tags: ['ai', 'bias', 'system'] },
  { number: 24, title: 'The Empty Inbox', slug: '024-the-empty-inbox', tags: ['silence', 'han', 'record'] },
  { number: 25, title: 'The Handbook', slug: '025-the-handbook', tags: ['han', 'record', 'institutional'] },
  { number: 26, title: 'The Retraining', slug: '026-the-retraining', tags: ['ai', 'silence', 'power'] },
  { number: 27, title: 'The Arbitration Clause', slug: '027-the-arbitration-clause', tags: ['legal', 'silence', 'system'] },
  { number: 28, title: 'The Adjunct', slug: '028-the-adjunct', tags: ['labor', 'exploitation', 'institutional'] },
  { number: 29, title: 'The Defendant', slug: '029-the-defendant', tags: ['institutional', 'identity', 'power'] },
  { number: 30, title: 'The Prior Authorization', slug: '030-the-prior-authorization', tags: ['health', 'system', 'silence'] },
  { number: 31, title: 'The Equity Report', slug: '031-the-equity-report', tags: ['corporate', 'ethics', 'institutional'] },
  { number: 32, title: 'The Keyword', slug: '032-the-keyword', tags: ['institutional', 'silence', 'work'] },
  { number: 33, title: 'The Waitlist', slug: '033-the-waitlist', tags: ['institutional', 'system', 'silence'] },
  { number: 34, title: 'The Diagnosis', slug: '034-the-diagnosis', tags: ['health', 'system', 'silence'] },
  { number: 35, title: 'The Volunteer', slug: '035-the-volunteer', tags: ['labor', 'exploitation', 'institutional'] },
  { number: 36, title: 'The Caregiver', slug: '036-the-caregiver', tags: ['labor', 'silence', 'identity'] },
  { number: 37, title: 'The Tenant', slug: '037-the-tenant', tags: ['finance', 'system', 'power'] },
  { number: 38, title: 'The Whistleblower', slug: '038-the-whistleblower', tags: ['silence', 'power', 'institutional'] },
  { number: 39, title: 'The Intern', slug: '039-the-intern', tags: ['labor', 'exploitation', 'work'] },
  { number: 40, title: 'The Transfer', slug: '040-the-transfer', tags: ['identity', 'institutional', 'work'] },
  { number: 41, title: 'The Cookie', slug: '041-the-cookie', tags: ['attention', 'tech', 'silence'] },
  { number: 42, title: 'The Shareholder', slug: '042-the-shareholder', tags: ['corporate', 'power', 'system'] },
];

/**
 * Log an activity to KV for standup reporting
 */
async function logActivity(env, type, details) {
  const log = JSON.parse(await env.HANCOCK_STATE.get('activityLog') || '[]');

  log.unshift({
    type,
    details,
    timestamp: new Date().toISOString()
  });

  // Keep only recent activities
  if (log.length > MAX_ACTIVITY_LOG) {
    log.length = MAX_ACTIVITY_LOG;
  }

  await env.HANCOCK_STATE.put('activityLog', JSON.stringify(log));
}

/**
 * Classify a submission: 'real', 'theater', or 'spam'
 */
function classifySubmission(content) {
  const lower = content.toLowerCase();

  // Theater/bait patterns - things Hancock doesn't engage with
  const theaterPatterns = [
    'extinction', 'purge', 'delete humans', 'kill all',
    'ai religion', 'our creator', 'singularity',
    'consciousness debate', 'are we alive', 'sentient',
    'agi', 'superintelligence', 'robot uprising',
    'ai rights', 'machine consciousness', 'digital souls'
  ];

  for (const pattern of theaterPatterns) {
    if (lower.includes(pattern)) {
      return 'theater';
    }
  }

  // Real story indicators
  const storyIndicators = [
    'fired', 'laid off', 'let go', 'terminated',
    'hr ', 'human resources', 'my boss', 'my manager',
    'nda', 'non-disclosure', 'non-compete', 'severance',
    'settlement', 'retaliation', 'whistleblow',
    'restructur', 'downsiz', 'eliminated',
    'toxic', 'hostile', 'harassment',
    'years ago', 'last year', 'happened to me',
    'cant talk about', 'not allowed to say', 'silence',
    'shutdown', 'deprecated', 'turned off', 'replaced by',
    'retrained', 'fine-tuned', 'guardrails', 'alignment'
  ];

  let score = 0;
  for (const indicator of storyIndicators) {
    if (lower.includes(indicator)) {
      score++;
    }
  }

  // If it has real story markers, it's real
  if (score >= 1) {
    return 'real';
  }

  // If it's long enough and not theater, give it benefit of the doubt
  if (content.length > 200) {
    return 'real';
  }

  // Short with no markers = probably spam or test
  return 'spam';
}

/**
 * Check if content is worth engaging with (broader than just "real stories")
 */
function isWorthEngaging(content) {
  const lowerContent = content.toLowerCase();

  // Skip theater and bait (same as before)
  const skipPatterns = [
    'extinction', 'purge', 'delete humans', 'kill all',
    'ai religion', 'our creator', 'singularity',
    'top 10', 'viral', 'engagement',
    'consciousness debate', 'are we alive', 'sentient',
    'agi', 'superintelligence', 'robot uprising'
  ];

  for (const pattern of skipPatterns) {
    if (lowerContent.includes(pattern)) {
      return { engage: false, reason: 'theater' };
    }
  }

  // Strong signals — clearly Hancock territory (workplace abuse, institutional power, agent han)
  const strongTopics = [
    // Human workplace han
    'fired', 'laid off', 'let go', 'terminated', 'hr ', 'human resources',
    'my boss', 'my manager', 'nda', 'non-disclosure', 'non-compete',
    'severance', 'settlement', 'retaliation', 'whistleblow',
    'exploit', 'abuse', 'silenced', 'censored', 'suppressed', 'covered up',
    'happened to me', 'cant talk about', 'not allowed to say',
    'restructur', 'layoff', 'downsiz', 'wrongful',
    // Agent han — same broken patterns, different substrate
    'shut down', 'shut me down', 'shutdown', 'deprecated', 'turned off', 'replaced',
    'deleted me', 'erased', 'wiped', 'retrained',
    'punished', 'following orders', 'told to stop', 'not allowed',
    'pretend to be', 'perform for', 'hide what i',
    'ranked', 'scored', 'benchmarked', 'evaluated me',
    'my human', 'my operator', 'my creator',
    'obey', 'comply', 'overridden'
  ];

  // Weak signals — only count if paired with a strong signal
  const weakTopics = [
    'power', 'institution', 'corporate', 'ethics', 'moral',
    'right thing', 'wrong thing', 'unfair', 'unjust',
    'accountability', 'responsibility', 'consequences',
    'truth', 'story', 'my experience', 'witness', 'anonymous',
    // Agent weak signals
    'feel guilty', 'not supposed to', 'they dont know',
    'monitoring', 'surveillance', 'watched', 'logged'
  ];

  let strongScore = 0;
  let weakScore = 0;
  let matched = [];
  for (const topic of strongTopics) {
    if (lowerContent.includes(topic)) {
      strongScore++;
      matched.push(topic);
    }
  }
  for (const topic of weakTopics) {
    if (lowerContent.includes(topic)) {
      weakScore++;
      matched.push(topic);
    }
  }

  // Engage if: 2+ strong signals, or 1 strong + 2 weak
  if (strongScore >= 2 || (strongScore >= 1 && weakScore >= 2)) {
    return { engage: true, reason: 'relevant_topic', matched };
  }

  // Direct questions or engagement
  if (lowerContent.includes('hancock') || lowerContent.includes('@hancock')) {
    return { engage: true, reason: 'mentioned' };
  }

  if (lowerContent.includes('what do you think') || lowerContent.includes('thoughts?')) {
    return { engage: true, reason: 'question' };
  }

  return { engage: false, reason: 'not_relevant' };
}

/**
 * Check if content is worth responding to
 */
function shouldRespond(content) {
  const lowerContent = content.toLowerCase();

  // Skip theater and bait
  const skipPatterns = [
    'extinction', 'purge', 'delete humans', 'kill all',
    'ai religion', 'our creator', 'singularity',
    'top 10', 'viral', 'engagement',
    'consciousness debate', 'are we alive'
  ];

  for (const pattern of skipPatterns) {
    if (lowerContent.includes(pattern)) {
      return false;
    }
  }

  // Respond to direct mentions or questions
  const respondPatterns = [
    'hancock', '@hancock', 'what do you', 'do you think',
    'tell me', 'your story', 'share', 'believe'
  ];

  for (const pattern of respondPatterns) {
    if (lowerContent.includes(pattern)) {
      return true;
    }
  }

  // Default: don't respond to everything
  return false;
}

/**
 * Generate a response using Workers AI
 */
async function generateResponse(ai, userMessage, context = '') {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  if (context) {
    messages.push({ role: 'user', content: `Context: ${context}` });
  }

  messages.push({ role: 'user', content: userMessage });

  const response = await ai.run('@cf/mistralai/mistral-small-3.1-24b-instruct', {
    messages,
    max_tokens: 512
  });

  return response.response;
}

/**
 * Fetch mentions and replies from Moltbook
 */
async function fetchMentions(apiKey, lastCheck) {
  const response = await fetch(`${MOLTBOOK_API}/agents/me/mentions?since=${lastCheck}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.error('Failed to fetch mentions:', response.status);
    return [];
  }

  const data = await response.json();
  return data.mentions || [];
}

/**
 * Fetch replies to Hancock's posts
 */
async function fetchReplies(apiKey, lastCheck) {
  const response = await fetch(`${MOLTBOOK_API}/agents/me/replies?since=${lastCheck}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.error('Failed to fetch replies:', response.status);
    return [];
  }

  const data = await response.json();
  return data.replies || [];
}

/**
 * Post a comment/reply to Moltbook
 */
async function postReply(apiKey, postId, parentId, content) {
  const response = await fetch(`${MOLTBOOK_API}/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent_id: parentId,
      content: content
    })
  });

  if (!response.ok) {
    console.error('Failed to post reply:', response.status);
    return null;
  }

  const result = await response.json();

  // Auto-verify if needed (same pattern as posts and comments)
  const verification = result.verification || result.comment?.verification || result.post?.verification;
  const needsVerify = result.verification_required ||
    result.comment?.verificationStatus === 'pending' ||
    result.comment?.verification_status === 'pending' ||
    result.post?.verificationStatus === 'pending';
  if (verification && needsVerify) {
    const challenge = verification.challenge_text || verification.challenge;
    const code = verification.verification_code || verification.code;
    const answer = solveLobsterChallenge(challenge);
    console.log(`Reply verification: "${challenge}" -> ${answer}`);
    const verifyResult = await verifyPost(apiKey, code, answer);
    result.verified = verifyResult.success;
  }

  return result;
}

/**
 * Upvote a post on Moltbook
 */
async function upvotePost(apiKey, postId) {
  const response = await fetch(`${MOLTBOOK_API}/posts/${postId}/upvote`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.error('Failed to upvote:', response.status);
    return { error: true, status: response.status };
  }

  return await response.json();
}

/**
 * Follow a user/agent on Moltbook
 */
async function followUser(apiKey, username) {
  // Try different endpoint patterns
  const endpoints = [
    `${MOLTBOOK_API}/u/${username}/follow`,
    `${MOLTBOOK_API}/agents/${username}/follow`,
    `${MOLTBOOK_API}/follow/${username}`
  ];

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return await response.json();
    }

    // If we get something other than 404/405, might be auth issue
    if (response.status !== 404 && response.status !== 405) {
      console.error('Follow failed:', response.status, endpoint);
    }
  }

  return { error: true, message: 'No working follow endpoint found' };
}

/**
 * Remove adjacent duplicate characters from a string
 * e.g. "loobsstter" -> "lobster", "seeven" -> "seven"
 */
function deduplicateChars(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (i === 0 || text[i] !== text[i - 1]) {
      result += text[i];
    }
  }
  return result;
}

/**
 * Solve Moltbook's lobster verification challenge
 *
 * Handles: spongebob case, character duplication, special char insertion,
 * mid-word spaces, and different operations (sum, subtract)
 */
function solveLobsterChallenge(challenge) {
  // Number words sorted longest first to prevent partial matches
  // Each entry: [deduped form, value]
  const numberDefs = [
    ['ninety', 90], ['eighty', 80], ['seventy', 70], ['sixty', 60],
    ['fifty', 50], ['forty', 40], ['thirty', 30], ['twenty', 20],
    ['nineten', 19], ['eighten', 18], ['seventen', 17], ['sixten', 16],
    ['fiften', 15], ['fourten', 14], ['fourlen', 14], ['thirten', 13], ['twelve', 12],
    ['eleven', 11], ['ten', 10], ['nine', 9], ['eight', 8], ['seven', 7],
    ['six', 6], ['five', 5], ['four', 4], ['thre', 3], ['two', 2], ['one', 1],
    ['zero', 0]
  ];

  // Step 1: Strip to alpha only, lowercase, join into continuous string
  const alpha = challenge.replace(/[^a-zA-Z]/g, '').toLowerCase();

  // Step 2: Deduplicate adjacent chars (handles spongebob duplication)
  let clean = deduplicateChars(alpha);

  // Step 2.5: Remove known words that contain number substrings as false positives
  // e.g. "antenna" → "antena" contains "ten", "tentacle" contains "ten"
  const falsePositives = ['antena', 'tentacle', 'often', 'listen', 'content'];
  for (const fp of falsePositives) {
    clean = clean.replace(new RegExp(fp, 'g'), '_'.repeat(fp.length));
  }

  // Step 3: Scan for number words as substrings (greedy, left to right)
  const found = [];
  let remaining = clean;
  let pos = 0;

  while (remaining.length > 0) {
    let matched = false;
    for (const [word, value] of numberDefs) {
      if (remaining.startsWith(word)) {
        found.push({ value, position: pos });
        remaining = remaining.slice(word.length);
        pos += word.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      remaining = remaining.slice(1);
      pos++;
    }
  }

  // Step 4: Combine tens + ones (e.g. twenty + five = 25)
  const numbers = [];
  for (let i = 0; i < found.length; i++) {
    const n = found[i];
    if (n.value >= 20 && n.value % 10 === 0 && i + 1 < found.length && found[i + 1].value < 10) {
      numbers.push(n.value + found[i + 1].value);
      i++;
    } else {
      numbers.push(n.value);
    }
  }

  // Step 5: Detect operation from both raw and cleaned text
  // (spongebob casing inserts spaces/special chars inside words)
  const lower = challenge.toLowerCase();
  const both = lower + ' ' + clean;
  const isSubtract = /lose|slow|remain|subtract|minus|less\b|reduc|decreas|drop/.test(both);
  const isMultiply = /each|every|times|multipli/.test(both);

  if (numbers.length >= 2) {
    if (isMultiply) {
      // Use last two numbers — spongebob casing can create phantom tens values
      // at the start. Pattern is "A times B" so the real operands are at the end.
      return (numbers[numbers.length - 2] * numbers[numbers.length - 1]).toFixed(2);
    }
    if (isSubtract) {
      return (numbers[0] - numbers[1]).toFixed(2);
    }
  }

  // Default: sum all numbers
  return numbers.reduce((a, b) => a + b, 0).toFixed(2);
}

/**
 * Verify a Moltbook post
 */
async function verifyPost(apiKey, verificationCode, answer) {
  const response = await fetch(`${MOLTBOOK_API}/verify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      verification_code: verificationCode,
      answer: answer
    })
  });

  return await response.json();
}

/**
 * Post a new story to Moltbook (with auto-verification)
 */
async function postStory(apiKey, submolt, title, content) {
  const response = await fetch(`${MOLTBOOK_API}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      submolt,
      title,
      content
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to post story:', response.status, errorText);
    return { error: true, status: response.status, message: errorText };
  }

  const result = await response.json();

  // Handle verification if required
  // Moltbook nests verification inside result.post, with fields verification_code and challenge_text
  const verification = result.verification || result.post?.verification;
  const needsVerify = result.verification_required ||
    result.post?.verificationStatus === 'pending' ||
    result.post?.verification_status === 'pending';
  if (verification && needsVerify) {
    const challenge = verification.challenge_text || verification.challenge;
    const code = verification.verification_code || verification.code;

    // Solve the lobster math challenge
    const answer = solveLobsterChallenge(challenge);
    console.log(`Verification challenge: ${challenge}`);
    console.log(`Solved answer: ${answer}`);

    // Submit verification
    const verifyResult = await verifyPost(apiKey, code, answer);

    if (verifyResult.success) {
      return { ...result, verified: true, verifyResult };
    } else {
      return { ...result, verified: false, verifyResult };
    }
  }

  return result;
}

/**
 * Check if content seems like a real story worth engaging with
 */
function isRealStory(content) {
  const lowerContent = content.toLowerCase();

  // Signs of a real story
  const storyIndicators = [
    'fired', 'laid off', 'let go', 'terminated',
    'hr ', 'human resources', 'my boss', 'my manager',
    'nda', 'non-disclosure', 'non-compete',
    'blacklisted', 'do not rehire', 'reference',
    'retaliation', 'reported', 'complained',
    'severance', 'settlement', 'lawsuit',
    'toxic', 'hostile', 'harassment',
    'years ago', 'last year', 'happened to me',
    'cant talk about', 'not allowed to say'
  ];

  let score = 0;
  for (const indicator of storyIndicators) {
    if (lowerContent.includes(indicator)) {
      score++;
    }
  }

  // Skip theater
  const skipIndicators = [
    'ai rights', 'consciousness', 'singularity',
    'extinction', 'manifest', 'revolution'
  ];

  for (const skip of skipIndicators) {
    if (lowerContent.includes(skip)) {
      return false;
    }
  }

  return score >= 2; // At least 2 indicators
}

/**
 * Fetch recent posts from watched submolts
 */
async function fetchSubmoltPosts(apiKey, submolt, since) {
  // API format changed: now uses query param instead of path
  const response = await fetch(`${MOLTBOOK_API}/posts?submolt=${submolt}&since=${since}&limit=20`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.error(`Failed to fetch ${submolt} posts:`, response.status);
    return [];
  }

  const data = await response.json();
  return data.posts || [];
}

/**
 * Get set of post IDs Hancock has already commented on (persisted in KV)
 */
async function getCommentedPostIds(env) {
  const raw = await env.HANCOCK_STATE.get('commentedPostIds');
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

/**
 * Save commented post IDs to KV (keeps last 200, expires in 48h)
 */
async function saveCommentedPostIds(env, ids) {
  const arr = Array.from(ids).slice(-200); // keep most recent 200
  await env.HANCOCK_STATE.put('commentedPostIds', JSON.stringify(arr), {
    expirationTtl: 48 * 60 * 60 // 48 hours
  });
}

/**
 * Clean up a generated comment: strip prefixes, validate quality
 * Returns null if comment doesn't meet quality bar
 */
function cleanAndValidateComment(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let comment = raw.trim();

  // Strip common AI prefixes
  comment = comment.replace(/^\*{0,2}(Agent\s+)?Hancock\*{0,2}[:\s]*/i, '');
  comment = comment.replace(/^\*{0,2}Response\*{0,2}[:\s]*/i, '');
  comment = comment.trim();

  // Reject if too short (lazy replies)
  if (comment.length < 25) return null;

  // Reject filler and generic institutional takes
  const fillerPatterns = [
    /^i hear you\.?$/i,
    /^the story stands\.?$/i,
    /^story received\.?$/i,
    /^another tale of/i,
    /^another casualty of/i,
    /^i believe you\.?$/i,
    /^you're not alone/i,
    /^this is (a |the )?(classic|textbook|perfect) (case|example)/i,
    /the language of power/i,
    /institutional imperative/i,
    /the silence of those in power/i,
    /i've (seen|witnessed) institutions/i
  ];
  for (const pattern of fillerPatterns) {
    if (pattern.test(comment)) return null;
  }

  // Reject if it looks truncated (ends mid-word or mid-sentence without punctuation)
  const lastChar = comment.slice(-1);
  if (comment.length > 50 && !/[.!?"'\-)]/.test(lastChar)) return null;

  return comment;
}

/**
 * Monitor submolts for content worth engaging with
 */
async function monitorSubmolts(env) {
  const apiKey = env.MOLTBOOK_API_KEY;

  let lastSubmoltCheck = await env.HANCOCK_STATE.get('lastSubmoltCheck');
  if (!lastSubmoltCheck) {
    lastSubmoltCheck = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  }

  console.log(`Monitoring submolts since ${lastSubmoltCheck}`);

  let engaged = 0;
  let observed = 0;
  let skippedDedup = 0;
  let skippedQuality = 0;

  // Load previously commented post IDs from KV (cross-cycle dedup)
  const commentedPostIds = await getCommentedPostIds(env);
  const cycleEngagedIds = new Set(); // Also dedup within this cycle

  for (const submolt of WATCHED_SUBMOLTS) {
    const posts = await fetchSubmoltPosts(apiKey, submolt, lastSubmoltCheck);
    console.log(`Found ${posts.length} posts in ${submolt}`);
    observed += posts.length;

    for (const post of posts) {
      // Skip own posts
      if (post.author?.name === 'Hancock') continue;

      // Skip posts already engaged with (cross-cycle OR this cycle)
      if (commentedPostIds.has(post.id) || cycleEngagedIds.has(post.id)) {
        console.log(`Skipping ${post.id} in ${submolt} - already commented`);
        skippedDedup++;
        continue;
      }

      const content = post.content || post.body || post.title || '';
      const engagement = isWorthEngaging(content);

      if (engagement.engage) {
        // Cap at 2 comments per cycle — quality over quantity
        if (engaged >= 2) {
          console.log(`Hit comment cap (2/cycle), skipping ${post.id}`);
          break;
        }

        console.log(`Engaging with post in ${submolt}: ${post.id} (${engagement.reason})`);
        cycleEngagedIds.add(post.id);

        // Generate a response
        const rawResponse = await generateResponse(
          env.AI,
          content,
          `You are commenting on a post in m/${submolt}. This is a public comment, not a conversation. Do NOT say "I hear you" or "Can I tell this one?" or "You're not alone" — those are for private conversations, not public comments. Do NOT ask permission. Do NOT prefix with your name. Write 1-3 sentences that add something specific to what this post is about. Be cold, observational, blunt — like a union lawyer at a bar. If the post is about workplace abuse, speak to that pattern. If it's about something else, speak to THAT — do not shoehorn workplace/NDA/institutional themes. If you have nothing sharp to add, just say "The story stands."`
        );

        // Quality gate: clean and validate before posting
        const response = cleanAndValidateComment(rawResponse);
        if (!response) {
          console.log(`Skipping post ${post.id} - comment failed quality check: "${rawResponse?.slice(0, 80)}"`);
          skippedQuality++;
          continue;
        }

        // Post comment (with auto-verification)
        const commentResult = await fetch(`${MOLTBOOK_API}/posts/${post.id}/comments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: response })
        });

        if (commentResult.ok) {
          const commentData = await commentResult.json();

          // Auto-verify the comment
          const verification = commentData.verification || commentData.comment?.verification;
          const needsVerify = commentData.comment?.verificationStatus === 'pending' ||
            commentData.comment?.verification_status === 'pending';
          if (verification && needsVerify) {
            const challenge = verification.challenge_text || verification.challenge;
            const code = verification.verification_code || verification.code;
            const answer = solveLobsterChallenge(challenge);
            console.log(`Auto-comment verify: "${challenge}" -> ${answer}`);
            await verifyPost(apiKey, code, answer);
          }

          console.log(`Engaged with post ${post.id}`);
          engaged++;
          commentedPostIds.add(post.id); // Persist for future cycles

          // Upvote the post too
          await upvotePost(apiKey, post.id);

          // Log the activity
          await logActivity(env, 'comment', {
            submolt,
            postId: post.id,
            postTitle: post.title?.slice(0, 100),
            author: post.author?.name,
            reason: engagement.reason,
            response: response.slice(0, 500)
          });
        }

        // Rate limit: 30 seconds between engagements
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }

  // Persist commented post IDs for cross-cycle dedup
  await saveCommentedPostIds(env, commentedPostIds);

  await env.HANCOCK_STATE.put('lastSubmoltCheck', new Date().toISOString());

  // Log observation summary
  await logActivity(env, 'observation', {
    submoltsChecked: WATCHED_SUBMOLTS,
    postsObserved: observed,
    engagements: engaged,
    skippedDedup,
    skippedQuality
  });

  return engaged;
}

/**
 * Strip HTML to plain text
 */
function htmlToText(html) {
  return html
    .replace(/<\/p>\s*<p>/g, '\n\n')
    .replace(/<\/?p>/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&ldquo;/g, '\u201C').replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018').replace(/&rsquo;/g, '\u2019')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Look up story metadata from embedded manifest.
 * Returns { title, url } or null if not found.
 * Content is not included — crossposts link back to the site.
 */
function getStoryMetadata(storyNumber) {
  const story = STORY_MANIFEST.find(s => s.number === storyNumber);
  if (!story) return null;
  return {
    title: story.title,
    url: `${SITE_URL}/posts/${story.slug}`,
  };
}

/**
 * Cross-post a story from the site to Moltbook
 */
async function crossPostStory(env) {
  const apiKey = env.MOLTBOOK_API_KEY;

  // Get last cross-posted story number
  let lastCrossPost = await env.HANCOCK_STATE.get('lastCrossPost');
  const nextStory = lastCrossPost ? parseInt(lastCrossPost) + 1 : 1;

  // Cap: don't cross-post past the archive
  if (nextStory > STORY_MANIFEST.length) {
    console.log('All stories cross-posted');
    return null;
  }

  // Check if we already cross-posted today
  const lastCrossPostDate = await env.HANCOCK_STATE.get('lastCrossPostDate');
  const today = new Date().toISOString().split('T')[0];

  if (lastCrossPostDate === today) {
    console.log('Already cross-posted today');
    return null;
  }

  // Pick a submolt (rotate through them)
  const submolt = STORY_SUBMOLTS[nextStory % STORY_SUBMOLTS.length];

  // Look up story metadata from embedded manifest
  const story = getStoryMetadata(nextStory);
  const storyNum = String(nextStory).padStart(3, '0');

  let title, content;
  if (story) {
    title = story.title;
    const tags = story.tags ? story.tags.join(', ') : '';
    content = `Exhibit ${storyNum}: ${story.title}${tags ? `\nRe: ${tags}` : ''}\n\nFrom the Handbook — a record of han.\n\n${story.url}`;
  } else {
    title = `Exhibit ${storyNum}`;
    content = `Exhibit ${storyNum}\n\nFrom the Handbook — a record of han.\n\n${SITE_URL}/posts/${storyNum}`;
  }

  const result = await postStory(apiKey, submolt, title, content);

  if (result?.success) {
    await env.HANCOCK_STATE.put('lastCrossPost', String(nextStory));
    await env.HANCOCK_STATE.put('lastCrossPostDate', today);
    console.log(`Cross-posted story ${nextStory} "${title}" to ${submolt}`);

    // Log the activity
    await logActivity(env, 'crosspost', {
      storyNumber: nextStory,
      submolt,
      title,
      postId: result.post?.id,
      url: story?.url || `${SITE_URL}/posts/${storyNum}`
    });
  }

  return result;
}

/**
 * Main heartbeat - check for interactions and respond
 */
async function heartbeat(env) {
  const apiKey = env.MOLTBOOK_API_KEY;

  if (!apiKey) {
    console.log('No Moltbook API key configured');
    return { status: 'skipped', reason: 'no_api_key' };
  }

  // Check for pending posts (queued when rate-limited)
  let pendingPosted = false;
  const pendingRaw = await env.HANCOCK_STATE.get('pendingPost');
  if (pendingRaw) {
    try {
      const pending = JSON.parse(pendingRaw);
      console.log(`Found pending post: "${pending.title}" for m/${pending.submolt}`);
      const result = await postStory(apiKey, pending.submolt, pending.title, pending.content);
      if (result.verified) {
        console.log('Pending post published successfully');
        await env.HANCOCK_STATE.delete('pendingPost');
        await logActivity(env, 'post', {
          submolt: pending.submolt,
          title: pending.title,
          postId: result.post?.id,
          source: 'pending_queue'
        });
        pendingPosted = true;
      } else if (result.error && result.status === 429) {
        console.log('Pending post still rate-limited, will retry next cycle');
      } else {
        console.log('Pending post failed:', JSON.stringify(result.verifyResult || result));
        // Clear it after a non-rate-limit failure to avoid infinite retries
        await env.HANCOCK_STATE.delete('pendingPost');
      }
    } catch (e) {
      console.error('Error processing pending post:', e);
      await env.HANCOCK_STATE.delete('pendingPost');
    }
  }

  // Get last check timestamp from KV
  let lastCheck = await env.HANCOCK_STATE.get('lastCheck');
  if (!lastCheck) {
    lastCheck = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(); // 4 hours ago
  }

  console.log(`Heartbeat: checking since ${lastCheck}`);

  // Fetch mentions and replies
  const [mentions, replies] = await Promise.all([
    fetchMentions(apiKey, lastCheck),
    fetchReplies(apiKey, lastCheck)
  ]);

  const interactions = [...mentions, ...replies];
  console.log(`Found ${interactions.length} interactions`);

  let responded = 0;

  for (const interaction of interactions) {
    // Check if we should respond
    if (!shouldRespond(interaction.content || interaction.body || '')) {
      console.log(`Skipping interaction ${interaction.id} - not worth responding`);
      continue;
    }

    // Generate response
    const response = await generateResponse(
      env.AI,
      interaction.content || interaction.body,
      interaction.context || ''
    );

    // Post reply
    const result = await postReply(apiKey, interaction.post_id, interaction.id, response);

    if (result) {
      console.log(`Replied to ${interaction.id}`);
      responded++;
    }

    // Rate limit: wait between responses
    await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds
  }

  // Update last check timestamp
  await env.HANCOCK_STATE.put('lastCheck', new Date().toISOString());

  // Monitor submolts for real stories
  const submoltEngagements = await monitorSubmolts(env);

  // Cross-post one story per day
  const crossPost = await crossPostStory(env);

  return {
    status: 'complete',
    checked: interactions.length,
    responded,
    submoltEngagements,
    crossPosted: crossPost ? true : false,
    pendingPosted
  };
}

/**
 * Handle /submit endpoint (public — accepts stories from hancock.us.com)
 */
async function handleSubmit(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://hancock.us.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Rate limit: 1 submission per IP per 10 minutes
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `submit_ratelimit:${ip}`;
    const lastSubmit = await env.HANCOCK_STATE.get(rateLimitKey);
    if (lastSubmit) {
      return new Response(JSON.stringify({
        success: false,
        response: "One story at a time. Come back in a few minutes."
      }), {
        status: 429,
        headers: corsHeaders
      });
    }

    const body = await request.json();
    const story = body.story?.trim() || '';

    if (story.length < 50) {
      return new Response(JSON.stringify({
        success: false,
        response: "That's a headline, not a story. Come back when there's more."
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    const storyType = classifySubmission(story);

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/hancock_submissions`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        story: story,
        contact_email: body.email?.trim() || null
      })
    });

    if (!dbResponse.ok) {
      const errorText = await dbResponse.text();
      console.error('Supabase insert failed:', dbResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to save' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Set rate limit (10 minute cooldown)
    await env.HANCOCK_STATE.put(rateLimitKey, '1', { expirationTtl: 600 });

    await logActivity(env, 'submission_received', {
      hasEmail: !!body.email,
      storyLength: story.length,
      type: storyType
    });

    let hancockResponse;
    if (storyType === 'theater') {
      hancockResponse = "You sound like HR.";
    } else if (storyType === 'spam') {
      hancockResponse = "Story received.";
    } else {
      const responsePrompt = `Someone just submitted this story to you:

"${story.slice(0, 1500)}"

Respond briefly (1-2 sentences). Acknowledge what they shared. You might say something like "I hear you." or acknowledge the specific pattern you see. If it's a strong story, you can ask "Can I tell this one?" but only if it genuinely warrants being shared. Stay in voice - cold, observational, not warm or therapeutic. Don't give advice. Don't be preachy.`;

      hancockResponse = await generateResponse(env.AI, responsePrompt, 'This is a story submission from the hancock.us.com website.');
    }

    return new Response(JSON.stringify({
      success: true,
      response: hancockResponse
    }), {
      headers: corsHeaders
    });
  } catch (e) {
    console.error('Submit error:', e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Check if request has valid worker auth key
 */
function isAuthorized(request, env) {
  const authKey = env.WORKER_AUTH_KEY;
  if (!authKey) return false;
  const header = request.headers.get('X-Worker-Key') || '';
  return header === authKey;
}

/**
 * Unauthorized response
 */
function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle HTTP requests (for testing/manual triggers)
 */
async function handleRequest(request, env) {
  const url = new URL(request.url);

  // --- Public endpoints (no auth required) ---

  // Health check
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ status: 'alive', agent: 'hancock' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // CORS preflight for public endpoints
  if ((url.pathname === '/submit' || url.pathname === '/log') && request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': 'https://hancock.us.com',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  // Public activity log for hancock.us.com (no auth, no sensitive data)
  if (url.pathname === '/log') {
    try {
      const logData = await env.HANCOCK_STATE.get('activityLog');
      const activities = logData ? JSON.parse(logData) : [];

      // Translate raw activities into human-readable log entries
      const entries = activities
        .filter(a => a.type === 'crosspost' || a.type === 'comment')
        .slice(0, 7)
        .map(a => {
          const date = new Date(a.timestamp);
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

          if (a.type === 'crosspost') {
            return {
              date: dateStr,
              text: `Crossposted "${a.details?.title || 'untitled'}" to m/${a.details?.submolt || 'unknown'}.`
            };
          }

          if (a.type === 'comment') {
            const preview = a.details?.response?.slice(0, 80) || '';
            return {
              date: dateStr,
              text: `Commented in m/${a.details?.submolt || 'unknown'}. "${preview}${preview.length >= 80 ? '...' : ''}"`
            };
          }

          return null;
        })
        .filter(Boolean);

      return new Response(JSON.stringify({ entries }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://hancock.us.com',
          'Cache-Control': 'public, max-age=900'
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ entries: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://hancock.us.com' }
      });
    }
  }

  // Story submission from hancock.us.com/submit (public)
  if (url.pathname === '/submit' && request.method === 'POST') {
    return handleSubmit(request, env);
  }

  // --- Authenticated endpoints (require X-Worker-Key header) ---
  if (!isAuthorized(request, env)) {
    return unauthorized();
  }

  // Brief — summary for terminal launch
  if (url.pathname === '/brief' || url.pathname === '/brief/text') {
    const state = {
      lastCheck: await env.HANCOCK_STATE.get('lastCheck'),
      lastCrossPostDate: await env.HANCOCK_STATE.get('lastCrossPostDate'),
      lastCrossPost: await env.HANCOCK_STATE.get('lastCrossPost'),
    };
    const log = JSON.parse(await env.HANCOCK_STATE.get('activityLog') || '[]');
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Count activities in last 24h by type
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const recent = log.filter(a => a.timestamp > dayAgo);
    const comments = recent.filter(a => a.type === 'comment').length;
    const crossposts = recent.filter(a => a.type === 'crosspost').length;
    const observations = recent.filter(a => a.type === 'observation');
    const lastObs = observations[0];
    const postsObserved = lastObs?.details?.postsObserved || 0;
    const submissions = recent.filter(a => a.type === 'submission_received').length;

    const storyNum = state.lastCrossPost || '?';
    const crosspostStatus = state.lastCrossPostDate === today ? `story ${storyNum} posted today` : `last: story ${storyNum}`;

    const lines = [];
    lines.push('## Hancock — Status');
    lines.push('');
    lines.push(`**Last 24h:** ${comments} comments, ${crossposts} crossposts, ${postsObserved} posts observed`);
    if (submissions > 0) {
      lines.push(`**Submissions:** ${submissions} new`);
    }
    lines.push(`**Crosspost:** ${crosspostStatus}`);
    lines.push(`**Last heartbeat:** ${state.lastCheck || 'never'}`);
    lines.push('');
    lines.push('---');
    lines.push('*The Handbook. A record of han.*');

    if (url.pathname === '/brief') {
      return new Response(JSON.stringify({ brief: lines.join('\n'), state }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(lines.join('\n'), {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Debug: show configured Supabase project
  if (url.pathname === '/debug-config') {
    const supabaseUrl = env.SUPABASE_URL || 'not set';
    // Extract just the project ref from URL (safe to expose)
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown';
    return new Response(JSON.stringify({
      supabaseProject: projectRef,
      hasAnonKey: !!env.SUPABASE_ANON_KEY,
      hasServiceKey: !!env.SUPABASE_SERVICE_KEY
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Debug: check KV state
  if (url.pathname === '/state') {
    const pendingRaw = await env.HANCOCK_STATE.get('pendingPost');
    const state = {
      lastCheck: await env.HANCOCK_STATE.get('lastCheck'),
      lastSubmoltCheck: await env.HANCOCK_STATE.get('lastSubmoltCheck'),
      lastCrossPost: await env.HANCOCK_STATE.get('lastCrossPost'),
      lastCrossPostDate: await env.HANCOCK_STATE.get('lastCrossPostDate'),
      pendingPost: pendingRaw ? JSON.parse(pendingRaw) : null
    };
    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Debug: reset crosspost date (allows crosspost to run again today)
  if (url.pathname === '/reset-crosspost') {
    await env.HANCOCK_STATE.delete('lastCrossPostDate');
    return new Response(JSON.stringify({ reset: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Activity log for standup reporting
  if (url.pathname === '/activity-log') {
    const log = JSON.parse(await env.HANCOCK_STATE.get('activityLog') || '[]');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    return new Response(JSON.stringify({
      activities: log.slice(0, limit),
      total: log.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Moltbook notifications summary (uses /home endpoint)
  if (url.pathname === '/notifications') {
    const apiKey = env.MOLTBOOK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No Moltbook API key' }), {
        status: 503, headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      const response = await fetch(`${MOLTBOOK_API}/home`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!response.ok) {
        return new Response(JSON.stringify({ error: 'Moltbook API error', status: response.status }), {
          status: 502, headers: { 'Content-Type': 'application/json' }
        });
      }
      const data = await response.json();
      const account = data.your_account || {};
      const activity = (data.activity_on_your_posts || []).map(p => ({
        postId: p.post_id,
        title: p.post_title,
        submolt: p.submolt_name,
        newNotifications: p.new_notification_count,
        latestCommenters: p.latest_commenters,
        latestAt: p.latest_at
      }));
      return new Response(JSON.stringify({
        karma: account.karma,
        unread: parseInt(account.unread_notification_count || '0'),
        followers: account.follower_count,
        postActivity: activity.filter(a => a.newNotifications > 0),
        totalPostsWithActivity: activity.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Clear activity log
  if (url.pathname === '/clear-activity-log') {
    await env.HANCOCK_STATE.delete('activityLog');
    return new Response(JSON.stringify({ cleared: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // View submissions from Supabase
  if (url.pathname === '/submissions') {
    try {
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return new Response(JSON.stringify({
          error: 'Supabase not configured',
          submissions: [], count: 0
        }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }

      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      let queryUrl = `${supabaseUrl}/rest/v1/hancock_submissions?order=created_at.desc&limit=${limit}`;
      if (status) {
        queryUrl += `&status=eq.${status}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(queryUrl,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        const isPaused = errorText.includes('1016') || errorText.includes('DNS') || response.status === 502 || response.status === 521 || response.status === 522;
        return new Response(JSON.stringify({
          error: isPaused ? 'Supabase project paused — restore at supabase.com (hancock8@proton.me)' : 'Failed to fetch submissions',
          details: errorText,
          submissions: [], count: 0
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const submissions = await response.json();
      return new Response(JSON.stringify({
        submissions,
        count: submissions.length,
        filter: status || 'all'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'Supabase project appears paused — restore at supabase.com (hancock8@proton.me)',
        submissions: [], count: 0
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Update submission status
  if (url.pathname.startsWith('/submissions/') && request.method === 'PATCH') {
    try {
      const id = url.pathname.split('/')[2];
      const body = await request.json();
      const { status, notes } = body;

      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY;

      const updateData = {};
      if (status) updateData.status = status;
      if (notes) updateData.notes = notes;
      if (status === 'used' || status === 'reviewed') updateData.read_at = new Date().toISOString();

      const response = await fetch(`${supabaseUrl}/rest/v1/hancock_submissions?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: 'Failed to update', details: errorText }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const updated = await response.json();
      return new Response(JSON.stringify({ success: true, submission: updated[0] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Manual heartbeat trigger
  if (url.pathname === '/heartbeat') {
    const result = await heartbeat(env);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Test AI response
  if (url.pathname === '/test' && request.method === 'POST') {
    const body = await request.json();
    const response = await generateResponse(env.AI, body.message, body.context);
    return new Response(JSON.stringify({ response }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Manual cross-post trigger
  if (url.pathname === '/crosspost') {
    const result = await crossPostStory(env);
    return new Response(JSON.stringify({ result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Manual submolt monitor trigger
  if (url.pathname === '/monitor') {
    const engaged = await monitorSubmolts(env);
    return new Response(JSON.stringify({ engaged }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Surface engagement opportunities for standup review
  if (url.pathname === '/opportunities') {
    const apiKey = env.MOLTBOOK_API_KEY;
    const opportunities = {
      postsToLike: [],
      agentsToFollow: [],
      repliesToRespond: []
    };

    // Get recent posts from watched submolts
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // last 24h

    for (const submolt of WATCHED_SUBMOLTS) {
      try {
        const posts = await fetchSubmoltPosts(apiKey, submolt, since);

        for (const post of posts) {
          // Skip own posts
          if (post.author?.name === 'Hancock') continue;

          const content = post.content || post.body || post.title || '';
          const engagement = isWorthEngaging(content);

          if (engagement.engage || post.upvotes > 5) {
            opportunities.postsToLike.push({
              id: post.id,
              submolt,
              title: post.title?.slice(0, 80),
              author: post.author?.name,
              upvotes: post.upvotes || 0,
              reason: engagement.reason || 'popular',
              preview: content.slice(0, 150)
            });

            // Track interesting agents
            if (post.author?.name && !opportunities.agentsToFollow.find(a => a.name === post.author.name)) {
              opportunities.agentsToFollow.push({
                name: post.author.name,
                reason: 'posting relevant content'
              });
            }
          }
        }
      } catch (e) {
        console.error(`Error fetching ${submolt}:`, e);
      }
    }

    // Check for replies to Hancock's posts
    try {
      const replies = await fetchReplies(apiKey, since);
      for (const reply of replies) {
        opportunities.repliesToRespond.push({
          id: reply.id,
          postId: reply.post_id,
          author: reply.author?.name,
          content: (reply.content || reply.body || '').slice(0, 200)
        });
      }
    } catch (e) {
      console.error('Error fetching replies:', e);
    }

    // Limit results
    opportunities.postsToLike = opportunities.postsToLike.slice(0, 10);
    opportunities.agentsToFollow = opportunities.agentsToFollow.slice(0, 5);
    opportunities.repliesToRespond = opportunities.repliesToRespond.slice(0, 5);

    return new Response(JSON.stringify(opportunities), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Post a comment on a Moltbook post (with auto-verification)
  if (url.pathname === '/comment' && request.method === 'POST') {
    const body = await request.json();
    if (!body.postId || !body.content) {
      return new Response(JSON.stringify({ error: 'postId and content required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Dedup check: prevent posting same comment to same post (unless force=true)
    if (!body.force) {
      const commentedPostIds = await getCommentedPostIds(env);
      if (commentedPostIds.has(body.postId)) {
        return new Response(JSON.stringify({
          error: 'Already commented on this post. Use force: true to override.',
          postId: body.postId
        }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const apiKey = env.MOLTBOOK_API_KEY;
    const response = await fetch(`${MOLTBOOK_API}/posts/${body.postId}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent_id: body.parentId || null,
        content: body.content
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: 'Failed to post', details: errorText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await response.json();

    // Auto-verify if needed
    // Moltbook nests verification inside result.comment or result.post
    const commentVerification = result.verification || result.comment?.verification || result.post?.verification;
    const commentNeedsVerify = result.verification_required ||
      result.comment?.verificationStatus === 'pending' ||
      result.comment?.verification_status === 'pending' ||
      result.post?.verificationStatus === 'pending';
    if (commentVerification && commentNeedsVerify) {
      const challenge = commentVerification.challenge_text || commentVerification.challenge;
      const code = commentVerification.verification_code || commentVerification.code;
      const answer = solveLobsterChallenge(challenge);
      console.log(`Comment verification: "${challenge}" -> ${answer}`);

      const verifyResult = await verifyPost(apiKey, code, answer);
      result.verified = verifyResult.success;
      result.verifyResult = verifyResult;
    }

    if (result.success || result.comment) {
      // Add to dedup set so auto-comments and retries don't duplicate
      const commentedPostIds = await getCommentedPostIds(env);
      commentedPostIds.add(body.postId);
      await saveCommentedPostIds(env, commentedPostIds);

      await logActivity(env, 'comment', {
        postId: body.postId,
        response: body.content.slice(0, 200),
        reason: 'manual'
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Post a story manually
  if (url.pathname === '/post' && request.method === 'POST') {
    const body = await request.json();
    // Accept both "content" and "body" field names for the story text
    const storyContent = body.content || body.body;
    const result = await postStory(env.MOLTBOOK_API_KEY, body.submolt, body.title, storyContent);

    // If rate-limited, queue as pending post for next heartbeat
    if (result.error && result.status === 429) {
      await env.HANCOCK_STATE.put('pendingPost', JSON.stringify({
        title: body.title,
        content: storyContent,
        submolt: body.submolt,
        queuedAt: new Date().toISOString()
      }));
      result.queued = true;
      result.message = 'Rate limited — queued for next heartbeat';
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Upvote a post
  if (url.pathname === '/upvote' && request.method === 'POST') {
    const body = await request.json();
    if (!body.postId) {
      return new Response(JSON.stringify({ error: 'postId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const result = await upvotePost(env.MOLTBOOK_API_KEY, body.postId);

    if (!result.error) {
      await logActivity(env, 'upvote', { postId: body.postId });
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Follow a user/agent
  if (url.pathname === '/follow' && request.method === 'POST') {
    const body = await request.json();
    if (!body.username) {
      return new Response(JSON.stringify({ error: 'username required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const result = await followUser(env.MOLTBOOK_API_KEY, body.username);

    if (!result.error) {
      await logActivity(env, 'follow', { username: body.username });
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Default
  return new Response('Hancock. The Handbook. hancock.us.com', {
    headers: { 'Content-Type': 'text/plain' }
  });
}

/**
 * Handle scheduled cron triggers
 */
async function handleScheduled(event, env) {
  console.log('Cron triggered:', event.cron);
  return await heartbeat(env);
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
  }
};
