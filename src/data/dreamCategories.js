export const DREAM_CATEGORIES = ['Uncategorized', 'Adventure', 'People', 'Places', 'Nightmare', 'Other'];

export function dreamTitle(text) {
  const firstLine = text.trim().split(/\n/)[0];
  const words = firstLine.split(/\s+/).slice(0, 7).join(' ');
  return words.length < firstLine.length ? `${words}…` : words;
}
