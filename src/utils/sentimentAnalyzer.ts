/**
 * MoodMap — Journal Sentiment Analyzer
 * Keyword-based sentiment scoring for journal entries.
 */

export type Sentiment = 'positive' | 'neutral' | 'negative';

// Positive keywords — joy, gratitude, achievement, love, peace
const POSITIVE_WORDS = new Set([
  // Emotions
  'happy', 'joy', 'joyful', 'grateful', 'thankful', 'blessed', 'love', 'loved',
  'wonderful', 'amazing', 'awesome', 'fantastic', 'great', 'excellent', 'beautiful',
  'excited', 'thrilled', 'delighted', 'cheerful', 'glad', 'elated', 'blissful',
  'content', 'satisfied', 'pleased', 'overjoyed', 'ecstatic', 'euphoric',
  // Achievement
  'achieved', 'accomplished', 'succeeded', 'proud', 'progress', 'improved',
  'growth', 'milestone', 'breakthrough', 'victory', 'win', 'winning', 'success',
  'completed', 'finished', 'mastered', 'learned', 'better',
  // Peace & Calm
  'peaceful', 'calm', 'relaxed', 'serene', 'tranquil', 'soothing', 'comfort',
  'comfortable', 'cozy', 'warm', 'safe', 'secure', 'balanced', 'harmony',
  // Connection
  'friend', 'friends', 'family', 'together', 'connection', 'support', 'supported',
  'caring', 'kind', 'kindness', 'generous', 'helpful', 'compassion',
  // Activity & Energy
  'fun', 'enjoy', 'enjoyed', 'enjoying', 'laugh', 'laughed', 'laughing', 'smile',
  'smiled', 'smiling', 'dance', 'play', 'celebrate', 'celebration', 'party',
  'adventure', 'explore', 'discover', 'inspired', 'inspiring', 'motivation',
  'motivated', 'energized', 'enthusiastic', 'passionate', 'creative',
  // Gratitude
  'appreciate', 'appreciation', 'gratitude', 'fortunate', 'lucky', 'blessing',
  // Nature & beauty
  'sunshine', 'sunset', 'sunrise', 'nature', 'flowers', 'garden', 'fresh',
  // Music & art
  'music', 'song', 'melody', 'art', 'painting', 'beauty', 'gorgeous',
  // Food & treats
  'delicious', 'yummy', 'tasty', 'treat', 'favorite', 'favourite',
  // General positive
  'good', 'nice', 'fine', 'well', 'perfect', 'incredible', 'magical',
  'hope', 'hopeful', 'optimistic', 'positive', 'bright', 'promising',
  'thank', 'thanks', 'yes', 'best', 'fantastic',
]);

// Negative keywords — sadness, anger, anxiety, stress, pain
const NEGATIVE_WORDS = new Set([
  // Sadness
  'sad', 'sadness', 'unhappy', 'depressed', 'depression', 'miserable', 'gloomy',
  'hopeless', 'despair', 'devastated', 'heartbroken', 'grief', 'mourning',
  'crying', 'cried', 'tears', 'lonely', 'loneliness', 'isolated', 'alone',
  'empty', 'hollow', 'numb', 'lost',
  // Anger
  'angry', 'anger', 'furious', 'rage', 'mad', 'irritated', 'frustrated',
  'frustration', 'annoyed', 'annoying', 'hate', 'hated', 'hatred', 'resent',
  'resentment', 'bitter', 'bitterness', 'hostile',
  // Anxiety & Fear
  'anxious', 'anxiety', 'worried', 'worry', 'worrying', 'nervous', 'scared',
  'afraid', 'fear', 'fearful', 'terrified', 'panic', 'panicking', 'dread',
  'dreading', 'overwhelmed', 'overwhelming', 'uneasy', 'restless',
  // Stress
  'stressed', 'stress', 'stressful', 'pressure', 'tense', 'tension',
  'burned', 'burnout', 'exhausted', 'exhausting', 'drained', 'fatigued',
  'overworked', 'struggling', 'struggle',
  // Pain
  'pain', 'painful', 'hurt', 'hurting', 'suffering', 'ache', 'aching',
  'sick', 'illness', 'awful', 'terrible', 'horrible', 'worst', 'dreadful',
  // Conflict
  'fight', 'fighting', 'argument', 'argued', 'conflict', 'betrayed',
  'betrayal', 'disappointed', 'disappointment', 'regret', 'regretful',
  'guilt', 'guilty', 'shame', 'ashamed', 'embarrassed',
  // General negative
  'bad', 'wrong', 'fail', 'failed', 'failure', 'broken', 'ruined',
  'destroyed', 'mess', 'disaster', 'chaos', 'nightmare', 'toxic',
  'ugly', 'useless', 'worthless', 'pathetic', 'disgusting',
  'never', 'can\'t', 'cannot', 'impossible', 'stuck',
]);

// Negation words that flip sentiment
const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'neither', 'nobody', 'nothing', 'nowhere',
  'nor', 'don\'t', 'doesn\'t', 'didn\'t', 'won\'t', 'wouldn\'t',
  'couldn\'t', 'shouldn\'t', 'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t',
  'haven\'t', 'hasn\'t', 'hadn\'t',
]);

// Intensifiers that boost the score
const INTENSIFIERS = new Set([
  'very', 'really', 'extremely', 'incredibly', 'absolutely', 'totally',
  'completely', 'deeply', 'truly', 'so', 'super', 'quite',
]);

/**
 * Analyze journal text and return a sentiment.
 * Uses keyword matching with negation handling and intensity boosting.
 */
export function analyzeJournalSentiment(
  content: string,
  title?: string | null,
  linkedMoodType?: string | null,
): Sentiment {
  // Combine title and content for analysis
  const fullText = [title, content].filter(Boolean).join(' ').toLowerCase();

  // Tokenize — split by non-word characters, filter out short noise
  const words = fullText
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) return 'neutral';

  let positiveScore = 0;
  let negativeScore = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = i > 0 ? words[i - 1] : '';
    const prevPrevWord = i > 1 ? words[i - 2] : '';

    // Check for negation (within 2 words before)
    const isNegated = NEGATION_WORDS.has(prevWord) || NEGATION_WORDS.has(prevPrevWord);

    // Check for intensifier
    const isIntensified = INTENSIFIERS.has(prevWord);
    const multiplier = isIntensified ? 1.5 : 1;

    if (POSITIVE_WORDS.has(word)) {
      if (isNegated) {
        negativeScore += multiplier;
      } else {
        positiveScore += multiplier;
      }
    }

    if (NEGATIVE_WORDS.has(word)) {
      if (isNegated) {
        positiveScore += multiplier * 0.5; // Negated negative is mildly positive
      } else {
        negativeScore += multiplier;
      }
    }
  }

  // Factor in linked mood if available (gives a slight nudge)
  if (linkedMoodType) {
    const positiveMoods = ['happy', 'calm', 'focused', 'peaceful', 'motivated'];
    const negativeMoods = ['sad', 'angry', 'anxious', 'stressed'];

    if (positiveMoods.includes(linkedMoodType)) {
      positiveScore += 1;
    } else if (negativeMoods.includes(linkedMoodType)) {
      negativeScore += 1;
    }
  }

  // Determine sentiment
  const totalScore = positiveScore + negativeScore;

  if (totalScore === 0) {
    // No sentiment keywords found — default to neutral
    return 'neutral';
  }

  const positiveRatio = positiveScore / totalScore;

  if (positiveRatio >= 0.6) return 'positive';
  if (positiveRatio <= 0.4) return 'negative';
  return 'neutral';
}
