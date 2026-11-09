export const CATEGORIES = ['Food', 'Transportation', 'Shopping', 'Entertainment', 'Other'];
export const STORAGE_KEY = 'voice-expense:v1';

const words = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const rules = {
  Food: /\b(lunch|dinner|breakfast|coffee|groceries)\b/i,
  Transportation: /\b(bus|train|taxi|uber|parking)\b/i,
  Shopping: /\b(shirt|shoes|clothes)\b/i,
  Entertainment: /\b(movie|cinema|game|concert)\b/i,
};

export function amountToCents(value) {
  const input = String(value).trim().replace(/^\$/, '');
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ''] = input.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function wordAmount(text) {
  const parts = text.toLowerCase().replace(/-/g, ' ').split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (part === 'and') continue;
    if (!(part in words)) return null;
    total += words[part];
  }
  return total > 0 && total < 100 ? total : null;
}

export function parseExpenseTranscript(transcript) {
  const text = transcript.trim();
  const numeric = [...text.matchAll(/(?:^|\s)(\$?\d+(?:\.\d+)?)(?=\s|[,.!?]|$)/g)].map(match => match[1]);
  const verbal = [...text.matchAll(/\b((?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)(?:\s+and\s+(?:one|two|three|four|five|six|seven|eight|nine))?)\s+dollars?\b/gi)].map(match => wordAmount(match[1]));
  const amounts = [...numeric.map(amountToCents), ...verbal.map(value => value === null ? null : value * 100)].filter(value => value !== null);
  const ambiguous = amounts.length > 1;
  const category = CATEGORIES.find(name => name !== 'Other' && rules[name].test(text)) || 'Other';
  const descriptionMatch = text.match(/\b(?:on|for)\s+(.+?)(?:[.!?]|$)/i);
  const description = descriptionMatch ? descriptionMatch[1].trim() : '';
  return { amount: amounts.length === 1 ? (amounts[0] / 100).toFixed(2) : '', category, description, ambiguous };
}

export function isExpense(value) {
  return value && typeof value.id === 'string' && value.id.length > 0 && Number.isSafeInteger(value.amountCents) && value.amountCents > 0 && CATEGORIES.includes(value.category) && typeof value.description === 'string' && typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt));
}

export function decodeExpenses(raw) {
  if (raw === null) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isExpense) || new Set(parsed.map(item => item.id)).size !== parsed.length) throw new Error('Saved expense data is invalid. It has not been changed.');
  return parsed.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export const formatUSD = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
