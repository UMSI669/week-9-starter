// Turns a speech-to-text transcript into a whole-number answer.
// Quiz scoring stays in App.js `submitAnswer`; this only decides whether the
// transcript contains a clear number.

const UNITS = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};

const TENS = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

// Collects every number in the transcript, in spoken order.
function extractNumbers(transcript) {
  const tokens = transcript
    .toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, '$1') // "1,000" -> "1000"
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);

  const numbers = [];
  let current = null; // value of the number-word group being read
  let lastKind = null; // 'unit' | 'tens' | 'hundred' | 'tensAfterHundred'

  const flush = () => {
    if (current !== null) numbers.push(current);
    current = null;
    lastKind = null;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];

    if (/^\d+$/.test(token)) {
      flush();
      numbers.push(Number(token));
      continue;
    }

    if (token in UNITS) {
      // "seventy two" / "one hundred four" continue the group; "two three" does not.
      const canAppend = lastKind === 'hundred' ||
        ((lastKind === 'tens' || lastKind === 'tensAfterHundred') && UNITS[token] < 10);
      if (!canAppend) flush();
      current = (canAppend ? current : 0) + UNITS[token];
      lastKind = 'unit';
      continue;
    }

    if (token in TENS) {
      const canAppend = lastKind === 'hundred';
      if (!canAppend) flush();
      current = (canAppend ? current : 0) + TENS[token];
      lastKind = canAppend ? 'tensAfterHundred' : 'tens';
      continue;
    }

    if (token === 'hundred') {
      if (current === null) current = 1; // "hundred" / "a hundred"
      if (current >= 1 && current < 10 && lastKind !== 'hundred') {
        current *= 100;
        lastKind = 'hundred';
      } else {
        flush();
      }
      continue;
    }

    if (token === 'a' && next === 'hundred') continue;
    // "one hundred and forty four"
    if (token === 'and' && lastKind === 'hundred' && next && (next in UNITS || next in TENS)) continue;

    flush();
  }
  flush();

  return numbers;
}

export function parseSpokenAnswer(transcript) {
  if (typeof transcript !== 'string' || !transcript.trim()) {
    return { valid: false, message: "I didn't hear anything. Try again." };
  }

  const numbers = extractNumbers(transcript);
  if (numbers.length === 0) {
    return { valid: false, message: `I heard "${transcript.trim()}", but no number. Try again.` };
  }

  // Kids often repeat the question ("nine times eight is seventy-two") or
  // correct themselves, so the last number spoken is the answer.
  const answer = numbers[numbers.length - 1];
  if (!Number.isSafeInteger(answer) || answer < 0) {
    return { valid: false, message: 'That number did not sound right. Try again.' };
  }

  return { valid: true, answer };
}
