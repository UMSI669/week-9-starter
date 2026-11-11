/**
 * Demo dream fixtures.
 *
 * These are hand-written sample dreams shipped with the app so the gallery,
 * the cloud map, search, and export have something to show on a fresh install.
 * They were NOT produced by an AI model. Every one carries `isDemo: true`,
 * every card shows a "Demo" badge, `analysisModel` says so in words, and
 * Settings can remove them all in one tap.
 *
 * Counts are deliberately uneven (Adventure 4, Relationships 3, School & Work 3,
 * Nature & Animals 2, Flying & Falling 2, Mystery 1, Everyday Life 1, Other 0)
 * so the cloud map shows a real size hierarchy, an equal-count tie-breaker,
 * and an empty category on first run.
 */

import { nowIso } from './formatDate';

export const DEMO_ANALYSIS_MODEL = 'demo-fixture (hand-written sample, not AI output)';
export const SEED_SETTING_KEY = 'demoDreamsSeeded';
export const SEED_FIXTURE_VERSION = '1';

const MS_PER_DAY = 86400000;

/** `daysAgo` and `hour` build a plausible local wake-up time for each sample. */
const FIXTURES = [
  {
    id: 'demo_library_clouds',
    daysAgo: 1,
    hour: 6,
    visualSeed: 'demo-library-01',
    primaryCategory: 'adventure',
    title: 'The Library Above the Clouds',
    summary: 'I explored a floating library while searching for a friend.',
    transcript:
      'I was walking through a library that was somehow floating above the clouds. The shelves went up further than I could see and the floor was glass, so I could look down at the weather. I was looking for my friend Priya because she had the book I needed, and every time I turned a corner I thought I heard her laughing on the next level up. I never found her but I did not feel scared, just busy.',
    symbolKey: 'library',
    symbolLabel: 'Library',
    emoji: '📚',
    interpretation:
      'The floating library could reflect curiosity that feels larger than you can take in at once. Searching for Priya rather than for the book might connect with wanting a person more than an answer, and the laughing one level up may connect with a sense that what you need is close but not quite reachable.',
    reflectionQuestion: 'What were you hoping to find?',
    themes: ['exploration', 'friendship', 'searching'],
    moods: ['curious', 'hopeful'],
  },
  {
    id: 'demo_night_train',
    daysAgo: 3,
    hour: 7,
    visualSeed: 'demo-train-02',
    primaryCategory: 'adventure',
    title: 'Night Train With No Stops',
    summary: 'I rode a train through the dark and could not find my stop on the map.',
    transcript:
      'I was on a night train with warm yellow lights inside and total darkness outside the windows. I kept checking the little map above the door but the station names kept rearranging themselves. Nobody else on the train seemed worried about it. At one point I decided to just stay on and see where it went, and that felt surprisingly okay.',
    symbolKey: 'journeys',
    symbolLabel: 'Journey',
    emoji: '🚆',
    interpretation:
      'A train you cannot read the map for could reflect being underway without a settled destination. The other passengers being calm might connect with a sense that not knowing is survivable, and deciding to stay on may connect with letting a decision stay open for now.',
    reflectionQuestion: 'Where did it feel like you were trying to get to?',
    themes: ['journey', 'uncertainty'],
    moods: ['calm', 'curious'],
  },
  {
    id: 'demo_tide_pools',
    daysAgo: 6,
    hour: 8,
    visualSeed: 'demo-tide-03',
    primaryCategory: 'adventure',
    title: 'Tide Pools at the Edge of Town',
    summary: 'I found tide pools behind my street that had always been there.',
    transcript:
      'Behind the houses on my street there was a whole coastline I had never noticed, with tide pools full of small bright things. In the dream it was obvious that it had always been there and I had just never walked that far. I kept wanting to go back and tell someone but I also did not want to leave yet.',
    symbolKey: 'water',
    symbolLabel: 'Tide pools',
    emoji: '🌊',
    interpretation:
      'Discovering a coast behind a familiar street could reflect finding something close by that you had not looked at properly. The pull between telling someone and staying might connect with wanting to share a discovery and wanting to keep it yours a little longer.',
    reflectionQuestion: 'What was the water doing, and how close to it were you?',
    themes: ['discovery', 'water', 'home'],
    moods: ['awe', 'joyful'],
  },
  {
    id: 'demo_desert_door',
    daysAgo: 11,
    hour: 5,
    visualSeed: 'demo-desert-04',
    primaryCategory: 'adventure',
    title: 'A Door Standing in the Desert',
    summary: 'I walked a long way to a door with no building around it.',
    transcript:
      'There was a single wooden door standing upright in flat desert, no walls, no house. I walked toward it for what felt like hours. When I got there I could see around it, so there was obviously nothing on the other side, but I still opened it instead of walking past.',
    symbolKey: 'doors',
    symbolLabel: 'Door',
    emoji: '🚪',
    interpretation:
      'A door with nothing behind it could reflect a threshold that matters because of the choosing rather than the outcome. Opening it anyway might connect with wanting to be the kind of person who opens things.',
    reflectionQuestion: 'Did you want to go through, and what was on the other side?',
    themes: ['thresholds', 'solitude'],
    moods: ['curious', 'calm'],
  },
  {
    id: 'demo_kitchen_grandmother',
    daysAgo: 2,
    hour: 6,
    visualSeed: 'demo-kitchen-05',
    primaryCategory: 'relationships',
    title: 'My Grandmother’s Kitchen, Rearranged',
    summary: 'I sat in my grandmother’s kitchen and the cupboards were in the wrong places.',
    transcript:
      'I was in my grandmother’s kitchen and she was making tea, talking the way she used to. Everything was right except the cupboards were on the wrong walls, and I kept opening the wrong one. She did not seem to mind that I could not find anything. I woke up before the tea was done.',
    symbolKey: 'houses',
    symbolLabel: 'Kitchen',
    emoji: '🏡',
    interpretation:
      'A familiar kitchen with the cupboards moved could reflect memory doing its usual work of keeping the feeling and losing the layout. Her not minding might connect with a kind of permission, and waking before the tea may simply be where the night ended.',
    reflectionQuestion: 'Which room did you spend the most time in?',
    themes: ['family', 'memory', 'home'],
    moods: ['nostalgic', 'tender'],
  },
  {
    id: 'demo_crowded_party',
    daysAgo: 8,
    hour: 7,
    visualSeed: 'demo-party-06',
    primaryCategory: 'relationships',
    title: 'Everyone I Know in One Room',
    summary: 'People from every part of my life were at one party and all knew each other.',
    transcript:
      'There was a party where my cousins and my coworkers and people from high school were all there, and they all already knew each other, which was somehow the strangest part. I kept trying to introduce people who did not need introducing. I was glad to see everyone but I never finished a conversation.',
    symbolKey: 'crowd',
    symbolLabel: 'A crowded room',
    emoji: '🫂',
    interpretation:
      'Separate parts of life gathered in one room could reflect how much work it takes to keep them separate while awake. Not finishing a conversation might connect with attention spread thin rather than with anything going wrong.',
    reflectionQuestion: 'Who did you most want to reach, and what stopped you?',
    themes: ['friendship', 'family', 'belonging'],
    moods: ['joyful', 'anxious'],
  },
  {
    id: 'demo_phone_call',
    daysAgo: 16,
    hour: 4,
    visualSeed: 'demo-call-07',
    primaryCategory: 'relationships',
    title: 'The Call I Could Almost Hear',
    summary: 'Someone I missed called me and the line was too quiet to hear.',
    transcript:
      'My phone rang and it was someone I have not spoken to in a long time. I could tell they were talking but the line was so quiet I could only hear the shape of it. I kept saying I could not hear them and asking them to say it again, and they kept patiently saying it again.',
    symbolKey: 'telephone',
    symbolLabel: 'A quiet phone line',
    emoji: '📞',
    interpretation:
      'A call you cannot quite hear could reflect something unfinished with that person, or just how much you would like to hear from them. Their patience in repeating it might connect with the version of them you carry rather than with anything they said.',
    reflectionQuestion: 'If you had heard it clearly, what would you want it to have been?',
    themes: ['distance', 'memory'],
    moods: ['wistful', 'lonely'],
  },
  {
    id: 'demo_exam_unstudied',
    daysAgo: 4,
    hour: 6,
    visualSeed: 'demo-exam-08',
    primaryCategory: 'school-work',
    title: 'The Exam for a Class I Never Took',
    summary: 'I sat an exam for a course I had never attended and answered anyway.',
    transcript:
      'I was in a lecture hall taking a final for a class I had definitely never registered for. The questions were in a subject I did not recognize but I kept writing answers that felt plausible. Nobody asked me to leave. At the end I handed it in and felt oddly proud of it.',
    symbolKey: 'school',
    symbolLabel: 'Exam',
    emoji: '🏫',
    interpretation:
      'An exam for a class you never took could reflect being measured on something you did not choose. Writing plausible answers anyway might connect with trusting improvisation, and the pride at the end may connect with that trust more than with the grade.',
    reflectionQuestion: 'Where in waking life do you feel you are being graded?',
    themes: ['school', 'pressure', 'improvising'],
    moods: ['anxious', 'powerful'],
  },
  {
    id: 'demo_endless_meeting',
    daysAgo: 9,
    hour: 7,
    visualSeed: 'demo-meeting-09',
    primaryCategory: 'school-work',
    title: 'A Meeting That Kept Adding People',
    summary: 'A meeting I was leading kept growing and I lost the agenda.',
    transcript:
      'I was running a meeting and every time I looked up there were more people in the room, including people who had nothing to do with the project. My notes kept reorganizing themselves. Someone asked a reasonable question and I realised I had no idea what we had decided.',
    symbolKey: 'work',
    symbolLabel: 'A growing meeting',
    emoji: '🗒️',
    interpretation:
      'A room that keeps adding people could reflect responsibility that grew faster than the plan for it. Notes rearranging themselves might connect with the feeling of holding too many threads rather than with any actual failure.',
    reflectionQuestion: 'What would it have taken to feel prepared in that room?',
    themes: ['work', 'responsibility'],
    moods: ['tense', 'confused'],
  },
  {
    id: 'demo_late_shift',
    daysAgo: 21,
    hour: 5,
    visualSeed: 'demo-shift-10',
    primaryCategory: 'school-work',
    title: 'Closing a Shop That Was Never Mine',
    summary: 'I closed up a small shop at night, carefully, and it was not my shop.',
    transcript:
      'I was closing a small shop late at night, counting the till and turning off the window lights in a particular order. It was clearly not a shop I have ever worked at, but I knew the routine perfectly. It was calm and I did not want to rush it.',
    symbolKey: 'ritual',
    symbolLabel: 'A closing routine',
    emoji: '🔒',
    interpretation:
      'Knowing a routine that was never yours could reflect comfort in order itself. Not wanting to rush might connect with wanting a part of the day that has a clear end.',
    reflectionQuestion: 'Which routine in your waking life feels like that?',
    themes: ['work', 'ritual'],
    moods: ['calm', 'peaceful'],
  },
  {
    id: 'demo_fox_in_snow',
    daysAgo: 5,
    hour: 8,
    visualSeed: 'demo-fox-11',
    primaryCategory: 'nature-animals',
    title: 'A Fox That Waited for Me',
    summary: 'A fox stopped in the snow and waited until I followed it.',
    transcript:
      'There was a fox at the edge of a snowy field. It looked right at me and then walked a few steps and stopped, and looked back, clearly waiting. I followed it to a hedge and then it was just a fox again and went under the hedge without me.',
    symbolKey: 'animals',
    symbolLabel: 'Fox',
    emoji: '🦊',
    interpretation:
      'An animal that waits for you could reflect something you felt invited toward. The fox becoming ordinary again at the hedge might connect with how an invitation can run out before the destination, and what the fox means here probably depends on what foxes mean to you.',
    reflectionQuestion: 'What does this animal mean to you personally?',
    themes: ['animals', 'nature', 'following'],
    moods: ['curious', 'awe'],
  },
  {
    id: 'demo_storm_porch',
    daysAgo: 13,
    hour: 6,
    visualSeed: 'demo-storm-12',
    primaryCategory: 'nature-animals',
    title: 'Watching a Storm From a Dry Porch',
    summary: 'I watched a huge storm from a porch and stayed completely dry.',
    transcript:
      'A really enormous storm was moving across a valley and I was on a wooden porch watching it, and none of the rain reached me. I remember being aware that it was dangerous and also that I was fine. I stayed until it passed.',
    symbolKey: 'weather',
    symbolLabel: 'Storm',
    emoji: '⛈️',
    interpretation:
      'Watching a storm from shelter could reflect something large happening at a distance you can tolerate. Staying until it passed might connect with a wish to witness something difficult without being inside it.',
    reflectionQuestion: 'What felt dangerous, and what kept you dry?',
    themes: ['nature', 'weather', 'safety'],
    moods: ['calm', 'awe'],
  },
  {
    id: 'demo_rooftop_flight',
    daysAgo: 7,
    hour: 5,
    visualSeed: 'demo-flight-13',
    primaryCategory: 'flying-falling',
    title: 'Flying By Pushing Off Rooftops',
    summary: 'I flew over a city by pushing off rooftops, and it took effort.',
    transcript:
      'I could fly but only by pushing off things, so I was going across a city rooftop by rooftop. It worked but it was tiring, and I kept losing height between buildings and having to find something to push off. Near the end I got better at it.',
    symbolKey: 'flying',
    symbolLabel: 'Flying',
    emoji: '🦅',
    interpretation:
      'Flight that needs something to push off could reflect freedom that still depends on footholds. Losing height between buildings might connect with effort that has to be renewed, and getting better at it near the end may connect with a sense of learning something.',
    reflectionQuestion: 'Were you steering, or being carried?',
    themes: ['flying', 'effort', 'skill'],
    moods: ['free', 'hopeful'],
  },
  {
    id: 'demo_stair_step',
    daysAgo: 18,
    hour: 3,
    visualSeed: 'demo-stair-14',
    primaryCategory: 'flying-falling',
    title: 'The Step That Was Not There',
    summary: 'I missed a stair in the dark and woke up as I fell.',
    transcript:
      'I was walking down a staircase in the dark, counting the steps, and then one of them was not there. I only fell for a second before I woke up with that jolt. Nothing bad actually happened.',
    symbolKey: 'falling',
    symbolLabel: 'Falling',
    emoji: '🪶',
    interpretation:
      'A missing step could reflect a moment where footing felt uncertain. Waking at the jolt is an extremely common sensation at the edge of sleep and does not need to mean anything alarming.',
    reflectionQuestion: 'What happened just before you started to fall?',
    themes: ['falling', 'startle'],
    moods: ['uneasy'],
  },
  {
    id: 'demo_lantern_riddle',
    daysAgo: 14,
    hour: 4,
    visualSeed: 'demo-lantern-15',
    primaryCategory: 'mystery',
    title: 'A Lantern With Writing Inside',
    summary: 'I held a lantern with words inside the glass I could not read.',
    transcript:
      'Someone handed me a paper lantern and there was writing on the inside of it, lit up from behind. I could see the letters clearly but I could not read them, not because they were a language I do not know but because they kept being the wrong shape. I did not want to put it down.',
    symbolKey: 'lantern',
    symbolLabel: 'Lantern',
    emoji: '🏮',
    interpretation:
      'Letters you can see but not read could reflect a question you can feel the shape of without having words for it yet. Not wanting to put the lantern down might connect with valuing the question itself.',
    reflectionQuestion: 'What is the first thing this image reminds you of?',
    themes: ['mystery', 'language'],
    moods: ['curious', 'wistful'],
  },
  {
    id: 'demo_laundry_light',
    daysAgo: 10,
    hour: 7,
    visualSeed: 'demo-laundry-16',
    primaryCategory: 'everyday-life',
    title: 'Folding Laundry in Very Good Light',
    summary: 'I folded laundry in a sunlit room and it was the whole dream.',
    transcript:
      'The entire dream was folding warm laundry in a room with really good afternoon light. There was no story. I remember thinking, inside the dream, that this was nice and that I should remember it.',
    symbolKey: 'home',
    symbolLabel: 'Afternoon light',
    emoji: '☕',
    interpretation:
      'An ordinary task in good light could reflect rest rather than meaning. Noticing it inside the dream might connect with wanting more moments that do not need to be about anything.',
    reflectionQuestion: 'When did you last have an afternoon like that awake?',
    themes: ['home', 'rest'],
    moods: ['peaceful', 'tender'],
  },
];

/**
 * Builds the demo records. Dates are generated relative to `referenceDate` so
 * the samples always read as recent; everything else is fixed, including each
 * `visualSeed`, so a sample card's artwork never changes.
 *
 * @param {Date|number} [referenceDate]
 */
export function buildDemoDreams(referenceDate = Date.now()) {
  const reference = referenceDate instanceof Date ? referenceDate.getTime() : referenceDate;

  return FIXTURES.map((fixture) => {
    const date = new Date(reference - fixture.daysAgo * MS_PER_DAY);
    date.setHours(fixture.hour, 12, 0, 0);
    const createdAt = date.toISOString();

    return {
      id: fixture.id,
      createdAt,
      updatedAt: createdAt,
      originalTranscript: fixture.transcript,
      transcript: fixture.transcript,
      title: fixture.title,
      summary: fixture.summary,
      symbolKey: fixture.symbolKey,
      symbolLabel: fixture.symbolLabel,
      emoji: fixture.emoji,
      interpretation: fixture.interpretation,
      reflectionQuestion: fixture.reflectionQuestion,
      primaryCategory: fixture.primaryCategory,
      themes: fixture.themes,
      moods: fixture.moods,
      visualSeed: fixture.visualSeed,
      analysisStatus: 'generated',
      analysisModel: DEMO_ANALYSIS_MODEL,
      isDemo: true,
    };
  });
}

export const DEMO_DREAM_COUNT = FIXTURES.length;

export function demoCountsByCategory() {
  const counts = {};
  FIXTURES.forEach((fixture) => {
    counts[fixture.primaryCategory] = (counts[fixture.primaryCategory] || 0) + 1;
  });
  return counts;
}

/** Only used by the first-run path to stamp when seeding happened. */
export function seedStamp() {
  return `${SEED_FIXTURE_VERSION}@${nowIso()}`;
}

export default buildDemoDreams;
