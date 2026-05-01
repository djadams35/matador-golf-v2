export const drills = [
  // ─── RANGE — WARMUP ──────────────────────────────────────────────────────────
  {
    id: 'hitting-bombs',
    name: 'Hitting BOMBS',
    category: 'warmup',
    scoringType: 'rating',
    passThreshold: 3.5,
    objective: 'Pick a precise target in the distance, send it freely. Go through your routine on each shot.',
    description:
      'Choose a precise target such as the top of a tree, a building, or a pole. Reach back and hit a bomb. This is a driver warm-up card — imagine you are on a downwind par 5, no penalty areas. Tee it up, let it fly, stretch it out.',
    advice: 'Go through your routine on each shot. Stay loose.',
    trackingNote: 'Rate each ball\'s contact quality 1–5. Log average.',
  },
  {
    id: 'cold-brew',
    name: 'Cold Brew',
    category: 'warmup',
    scoringType: 'percent',
    passThreshold: 60,
    objective: 'Simulate your opening tee shot first half, then pick a new target each shot second half.',
    description:
      'For the first half of the card, imagine your opening tee shot — hit it down the fairway. For the last half, choose a new target with each shot and hit to that target. This drill is to be done first to simulate going straight to the first tee.',
    advice: 'Suggested "good enough" is 30 yards right and left of your target (60 yards total window). Take a deep breath before each shot. Relax and send it.',
    trackingNote: 'Record total balls hit and number "good enough."',
  },

  // ─── RANGE — WEDGES ──────────────────────────────────────────────────────────
  {
    id: 'long-is-dead',
    name: 'Long is Dead',
    category: 'wedges',
    scoringType: 'percent',
    passThreshold: 60,
    objective: 'Sand wedge to a back pin — you can miss short but never long.',
    description:
      'Choose your sand wedge and a comfortable target. If there is a green, hit to that. If not, imagine you are hitting into a back pin. Hit to the green and pin without going over. Repeat the card until allotted time is complete.',
    advice:
      'This is a time to learn your risk tolerance and wedge discipline. Going after the back pin could lead to an easy birdie, or bogey if you go long. Get comfortable playing aggressively smart to a back pin. Suggested "good enough" range: 6 paces short of the pin.',
    trackingNote: 'Record total balls hit, total balls long, total balls "good enough" (within 6 paces).',
  },
  {
    id: 'lil-jon',
    name: 'Lil Jon',
    category: 'wedges',
    scoringType: 'fraction',
    passThreshold: 6,
    totalTarget: 9,
    objective: 'Three targets at 30, 60, and 90 yards — 3 balls to each with the same club.',
    description:
      'Choose three targets, one at 30 yards, one at 60 yards, and one at 90 yards. Using the same club, hit 3 balls to the first target, 3 balls to the second, 3 balls to the third. Repeat until allotted time is complete.',
    advice: 'This is a blend between a creative and execution card — a chance to learn to hit three distance-controlled trajectories.',
    trackingNote: 'Record balls within 10 yards of each target out of 9 total.',
  },
  {
    id: '100-meter-dash',
    name: '100 Meter Dash',
    category: 'wedges',
    scoringType: 'percent',
    passThreshold: 50,
    objective: 'Target at approximately 110 yards with your most comfortable wedge — reset after each shot, don\'t rush.',
    description:
      'Choose a target approximately 100 meters (110 yards) away. Select the wedge you are most comfortable with at this yardage. Hit to the target until allotted time is complete.',
    advice: 'Despite the "dash" title, do not rush through the card. Reset after each shot. Suggested comfortable range: approximately 20 ft from target.',
    trackingNote: 'Record balls landing within 20 ft of target vs total hit.',
  },
  {
    id: 'step-up-step-down',
    name: 'Step-Up, Step-Down',
    category: 'wedges',
    scoringType: 'percent',
    passThreshold: 60,
    objective: 'Four targets at 65, 75, 85, and 95 yards — same club, sequence up then back down.',
    description:
      'Pick 4 targets at 65, 75, 85, and 95 yards. Hit the same club sequencing from shortest to longest, then back to shortest. Repeat until allotted time is complete.',
    advice: 'This is a judgement-free practice card. The goal is to see the shot and hit the yardage. No single shot is important. Find your feels. Reset after each shot.',
    trackingNote: 'Record balls within 10 yards of intended target vs total.',
  },

  // ─── RANGE — IRONS ───────────────────────────────────────────────────────────
  {
    id: 'dim-tuncan',
    name: 'Dim Tuncan',
    category: 'irons',
    scoringType: 'rating',
    passThreshold: 3.5,
    objective: '6-iron stock shot to a specific target — focus on technique and alignment.',
    description:
      'Choose your 6-iron. Choose an appropriate target and hit your stock shot. Repeat the card until allotted time is complete.',
    advice: 'FUNDAMENTALS. This is an opportunity to work on building elements like technique, alignment, and playing a stock shot to a specific target.',
    trackingNote: 'Rate contact quality 1–5 on each shot. Log average.',
  },
  {
    id: 'chippy-little-8',
    name: 'Chippy Little 8',
    category: 'irons',
    scoringType: 'percent',
    passThreshold: 55,
    objective: '8-iron flighted 10 yards short of your stock yardage — controlled, under-the-wind shot.',
    description:
      'Choose your 8-iron and a target 10 yards short of your stock yardage. Using a controlled swing, hit a flighted 8-iron to the target.',
    advice: 'A go-to shot for windy conditions or when you need to control spin on an approach. Experiment with different stance and grip setups to hit that chippy shot under the wind.',
    trackingNote: 'Record balls that hold the target zone vs total hit.',
  },
  {
    id: 'boot-camp',
    name: 'Boot Camp',
    category: 'irons',
    scoringType: 'rating',
    passThreshold: 3.5,
    objective: 'Favorite mid-iron to an appropriate target — pure technique work, nothing else.',
    description: 'Choose your favorite mid-iron. Choose an appropriate target. Swing your swing.',
    advice: 'This is your opportunity to work on your technique and only your technique.',
    trackingNote: 'Rate contact and shape on each shot 1–5. Log average.',
  },
  {
    id: 'flushing-it',
    name: 'Flushing It',
    category: 'irons',
    scoringType: 'rating',
    passThreshold: 3.5,
    objective: '8-iron stock shot to target — consistent contact, repeatable trajectory and shape.',
    description: 'Choose your 8-iron and an appropriate target for your stock shot. Nothing else to consider.',
    advice: 'This is a contact card. Concentrate on making consistent contact and producing a repeatable trajectory and shape. A chance to work on technique and a swing feel.',
    trackingNote: 'Rate contact 1–5 each shot. Log average.',
  },

  // ─── RANGE — DRIVER ──────────────────────────────────────────────────────────
  {
    id: 'wimbledon',
    name: 'Wimbledon',
    category: 'driver',
    scoringType: 'percent',
    passThreshold: 50,
    objective: 'Two targets 40 yds apart — fade the ball to start inside the left target and land in the corridor.',
    description:
      'Choose two targets in the distance 40 yards apart. Start a ball inside the left target that fades and ends between the two targets. Hit 1 "Best Drive", hit 4 "Second Serve Drives". The "Second Serve" goal is to hit the corridor. Send the "Best Drive". Repeat until allotted time is complete.',
    advice: 'This is a corridor card. Start it inside the corridor, end it inside the corridor. Nothing else matters. Use your routine on every shot.',
    trackingNote: 'Record corridor hits vs total balls hit.',
  },
  {
    id: 'fairway-finder',
    name: 'Fairway Finder',
    category: 'driver',
    scoringType: 'percent',
    passThreshold: 55,
    objective: 'Two targets 40 yds apart — visualize penalty areas on both sides and hit driver down the runway.',
    description:
      'Choose two targets 40 yards apart. Visualize a significant penalty area on both sides of your runway. Hit driver down the runway until allotted time is complete.',
    advice: 'Practice concentrating on a precise landing target and ensuring proper alignment. Visualize the penalty that gives you the most anxiety (e.g. white stakes). Go through your routine on each shot.',
    trackingNote: 'Record total shots and number that landed in the runway.',
  },
  {
    id: 'the-alternator',
    name: 'The Alternator',
    category: 'driver',
    scoringType: 'percent',
    passThreshold: 55,
    objective: '40-yd corridor — first 3 balls imagine a left-side hazard, next 3 balls imagine a right-side hazard.',
    description:
      'Choose two targets 40 yards apart. On the first 3 balls, imagine a hazard down the left side. On the next 3 balls, imagine a hazard down the right side. Repeat until allotted time is complete.',
    advice: 'On each shot, see the fairway and hit it down the fairway. Imagine significant room on the opposite side of the hazard — you can miss there. Use your routine on every shot.',
    trackingNote: 'Record corridor hits vs total.',
  },
  {
    id: 'the-chez',
    name: 'The Chez',
    category: 'driver',
    scoringType: 'percent',
    passThreshold: 60,
    objective: 'Two targets 30 yds apart — aggressive swing down the corridor, concentrate on landing target.',
    description:
      'Choose two targets 30 yards apart. Imagine a fairway between them. Send an aggressive swing down the corridor.',
    advice: 'Practice concentrating on a precise landing target. Chez Reavie combines distance with accuracy — be like Chez.',
    trackingNote: 'Record total shots and number landing in the runway.',
  },

  // ─── SHORT GAME — CHIPPING ───────────────────────────────────────────────────
  {
    id: 'ol-trusty',
    name: "Ol' Trusty",
    category: 'chipping',
    scoringType: 'percent',
    passThreshold: 50,
    objective: 'One straight-forward 40-ft up-and-down — chip to make, focus on contact.',
    description:
      'Choose one spot that provides a straightforward up-and-down from 40 feet, mostly green. Focus on contact and chip to make. Repeat until allotted time is complete.',
    advice: 'Imagine you need this up-and-down to extend the match or keep a hot round going. Try to predict and repeat the chip trajectory.',
    trackingNote: 'Record total chips, chips holed, chips ending inside 2 long paces.',
  },
  {
    id: 'the-gimme',
    name: 'The Gimme',
    category: 'chipping',
    scoringType: 'percent',
    passThreshold: 40,
    objective: 'Two targets of different length, most-lofted wedge — alternate between targets, chip to gimme range.',
    description:
      'Choose a spot that provides chips to two targets of different length. Both shots should be straightforward — you should expect to get up-and-down. Use your most lofted wedge. Alternate each shot from target A to target B until allotted time is complete.',
    advice: 'Chip to each target with the same wedge. Suggested comfortable gimme range: 1 pace.',
    trackingNote: 'Record total shots and number that yielded a gimme (within 1 pace).',
  },
  {
    id: 'lewis-and-clark',
    name: 'Lewis and Clark',
    category: 'chipping',
    scoringType: 'fraction',
    passThreshold: 3,
    totalTarget: 5,
    objective: 'Bump and run to one pin with four different clubs — 3-wood, hybrid/4-iron, 8-iron, PW. 5 balls each.',
    description:
      'Choose one pin and a spot you can comfortably hit a bump and run. Hit 5 bump and runs with each of these clubs: 3-wood, hybrid or 4-iron, 8-iron, PW. Repeat until allotted time is complete.',
    advice: 'Choke down and use a putting-like stroke. The heel of the club might be slightly off the ground. Concentrate on delivering a consistent strike.',
    trackingNote: 'Record how many balls were hit inside 2 paces with each club (log each club separately). Score your best club performance.',
  },
  {
    id: 'aircraft-carrier',
    name: 'Aircraft Carrier',
    category: 'chipping',
    scoringType: 'percent',
    passThreshold: 50,
    objective: 'Two pins — one with limited green, one with ample green. Play high and soft to each, alternate.',
    description:
      'Choose one spot and two pins. One pin should have limited green to work with, the other ample green. Play a high and soft shot to each pin. Alternate between pins until allotted time is complete.',
    advice: 'This is a landing spot drill. One pin lets the green cut line dictate your landing spot, while the other forces you to identify a specific spot on the green. Suggested "good enough": inside 3 paces.',
    trackingNote: 'Record total shots and number that are "good enough" (within 3 paces).',
  },
  {
    id: 'short-game-magic',
    name: 'Short Game Magic',
    category: 'chipping',
    scoringType: 'count',
    passThreshold: 20,
    objective: 'Two targets — chip to A until 3 land within 2 paces, then chip to B until 3 land within 2 paces.',
    description:
      'Choose a spot with chips to two targets of different length. Chip to target A until you hit three to a comfortable putting range (1–2 paces), then chip to target B until you hit three to a comfortable putting range. Repeat until allotted time or completion.',
    advice: 'Use the same wedge to each target. Suggested comfortable putting range: 1–2 paces.',
    trackingNote: 'Record total number of chips. Target: complete both in ≤ 20 chips.',
  },
  {
    id: '5-on-5',
    name: '5 on 5',
    category: 'chipping',
    scoringType: 'level',
    passThreshold: null,
    objective: 'Level 1 — chip 5 in a row within 2 paces from ≤5 paces. Level 2 — chip 5 in a row within 3 paces from ≤10 paces.',
    description:
      'Choose a pin no more than 5 paces away. Chip until you\'ve hit 5 in a row within 2 paces. If you pass Level 1, choose a different pin no more than 10 paces away and chip until you\'ve hit 5 in a row within 3 paces.',
    advice: 'This card is meant to push you. Success is passing Level 1. Expertise is passing Level 2.',
    trackingNote: 'Pass Level 1 / Pass Level 2 / Fail.',
  },
  {
    id: 'the-wizard',
    name: 'The Wizard',
    category: 'chipping',
    scoringType: 'rating',
    passThreshold: null,
    objective: 'Short-sided pin 5–7 paces away — cycle through bump and run, stock shot, and high flop.',
    description:
      'Choose a pin that is short-sided and roughly 5–7 paces away. Using your highest-lofted wedge, hit a bump and run, then a stock shot, then a high flop. Repeat until allotted time is complete.',
    advice: 'This card is meant to be difficult. By putting yourself in challenging positions in practice, you will be prepared to face them on the course with ease. Develop confidence as you succeed.',
    trackingNote: 'Self-rate creativity and execution 1–5. Log average. No pass threshold — observation only.',
  },

  // ─── SHORT GAME — PUTTING ────────────────────────────────────────────────────
  {
    id: 'the-duke-lonald',
    name: 'The Duke Lonald',
    category: 'putting',
    scoringType: 'putt_distribution',
    passThreshold: 0,
    objective: '3 balls to a 30–40 ft target, hole out the third ball. Speed drill — each putt should end in a comfortable range.',
    description:
      'Drop 3 golf balls. Choose 1 target 30–40 ft away. Putt all three, then finish out the third ball. Repeat with a different target each round until allotted time is complete.',
    advice: 'Monitor the ending position of your balls to identify trends and adjust. This is a speed drill — each putt should end in a comfortable finish range.',
    trackingNote: 'Record 1-putts, 2-putts, and 3+ putts on the third ball.',
  },
  {
    id: 'the-longboard',
    name: 'The Longboard',
    category: 'putting',
    scoringType: 'count',
    passThreshold: 15,
    objective: '10-ft slightly uphill putt — make 10 total, finish with 2 in a row.',
    description:
      'Choose a cup with a slightly uphill or flat straight 10-ft putt. Putt to make. Make 10 putts total. After making 10, make 2 in a row to end the session.',
    advice: 'This is a making drill. This distance is your chance to cash in and take advantage of a solid wedge shot.',
    trackingNote: 'Record total putts taken before completing the card.',
  },
  {
    id: 'the-deep-end',
    name: 'The Deep End',
    category: 'putting',
    scoringType: 'count',
    passThreshold: 20,
    objective: 'Two ball markers at 10 ft above and below the hole — make 10 putts moving between markers.',
    description:
      'Choose a cup. Place two ball markers 10 ft below and above the hole. Putt to make, moving to the other marker after each make. Attempt to make 10 putts before time is complete.',
    advice: 'This is a making drill. Do not rush.',
    trackingNote: 'Record total putts taken. Target: complete in 20 or fewer.',
  },
  {
    id: 'social-distancing',
    name: 'Social Distancing',
    category: 'putting',
    scoringType: 'count',
    passThreshold: 10,
    objective: "4 balls at 6 ft (12, 3, 6, 9 o'clock positions) — make 5 consecutive putts.",
    description:
      "Place 4 balls 6 ft from a hole at 12, 3, 6, and 9 o'clock. Putt to make. After making 4 consecutively, place 1 ball at one of the spots and putt to make. Continue until you make 5 consecutive putts or time runs out.",
    advice: 'This is a closing drill. Simulate needing to hole these putts for a win. Execute your routine on each putt.',
    trackingNote: 'Putts taken to complete 5 consecutive. Pass: complete in ≤ 10 putts.',
  },
  {
    id: 'mount-vernon',
    name: 'Mount Vernon',
    category: 'putting',
    scoringType: 'rating',
    passThreshold: 3.5,
    objective: 'Ball on a coin, 6-ft putt — head-down technique drill.',
    description:
      'Place a quarter 6 feet from a small hole (or normal hole). Tee a ball up on the quarter. Hit putts to the hole.',
    advice: 'Ensure you keep your head still and down through the entire putting stroke. Keep the head down until you hear the ball drop.',
    trackingNote: 'Self-rate stroke quality 1–5. Log average. Pass: avg ≥ 3.5.',
  },
  {
    id: 'the-pacer',
    name: 'The Pacer',
    category: 'putting',
    scoringType: 'percent',
    passThreshold: 60,
    objective: '3 balls to a 20–25 ft target, hole out the worst ball. Speed drill — monitor where balls finish.',
    description:
      'Drop 3 golf balls. Choose 1 target 20–25 ft away. Putt to the target. Finish out your worst ball. Repeat with a different target each round until allotted time is complete.',
    advice: 'Monitor ending position of balls to identify trends and adjust. Each putt should end in a comfortable finish range.',
    trackingNote: 'Record total balls putted and number finishing between 1 ft short and 3 ft long (or holed).',
  },
  {
    id: 'the-chastain',
    name: 'The Chastain',
    category: 'putting',
    scoringType: 'fraction',
    passThreshold: 5,
    totalTarget: 6,
    objective: '3 downhill + 3 uphill 24-ft putts — none should end short of the hole.',
    description:
      'Choose a cup that allows a slightly uphill 24-ft putt and a slightly downhill 24-ft putt. Place markers at each spot. Hit 3 downhill putts ensuring none end short. Hit 3 uphill putts ensuring none end short. Repeat until allotted time is complete.',
    advice: 'This is a speed drill. Find the speed that gets you past the cup but still in a comfortable range.',
    trackingNote: 'Record putts that finished past the hole out of 6.',
  },
  {
    id: 'the-joe-king',
    name: 'The Joe King',
    category: 'putting',
    scoringType: 'putt_distribution',
    passThreshold: 0,
    objective: 'Longest corner-to-corner putt on the green — 3 balls, hole out the last one.',
    description:
      'Find the longest corner-to-corner putt on your putting green. Putt 3 balls from that corner to the farthest hole. Putt out the last ball.',
    advice: 'This is both a pace and make drill. On the first 3 putts, focus on your pace — then putt to hole on your second putt.',
    trackingNote: 'Record 1-putts, 2-putts, and 3-putts or more.',
  },
  {
    id: 'the-half-moon',
    name: 'The Half Moon',
    category: 'putting',
    scoringType: 'count',
    passThreshold: 12,
    objective: "7 balls in a half-moon at 3 paces on a downhill putt — make each once, then make the last one twice in a row.",
    description:
      "Choose a significantly downhill putt. Place 7 balls at 3 paces away at 9, 10, 11, 12, 1, 2, and 3 o'clock forming a half moon (12 o'clock directly above the hole). Putt to make, moving to the next marker after each make. Card is done after making each putt once and the last putt twice in a row.",
    advice: 'This is a making drill. Cash in on your solid wedge shots.',
    trackingNote: 'Record total putts taken before completing the card. Pass: ≤ 12.',
  },
  {
    id: 'the-horseshoe',
    name: 'The Horseshoe',
    category: 'putting',
    scoringType: 'count',
    passThreshold: 10,
    objective: "5 balls in a horseshoe at 1.5 paces on a downhill putt — make 4 in a row, then 2 in a row from the final spot.",
    description:
      "Choose a significantly downhill putt. Place 5 balls at 1.5 paces away at 10, 11, 12, 1, and 2 o'clock with 12 o'clock directly above the hole. Make 4 in a row (10 o'clock to 1 o'clock) — if you miss, return to 10 o'clock. After making 4 in a row, putt from 2 o'clock until you make 2 in a row.",
    advice: 'This is a making drill.',
    trackingNote: 'Record total putts taken before completing the card. Pass: ≤ 10.',
  },
];

export const monthPlans = {
  1: {
    name: 'Tempo & Contact',
    warmupDrillId: 'hitting-bombs',
    wedgeDrillId: 'long-is-dead',
    ironDrillId: 'dim-tuncan',
    driverDrillId: 'wimbledon',
  },
  2: {
    name: 'Ball Striking & Commitment',
    warmupDrillId: 'cold-brew',
    wedgeDrillId: 'lil-jon',
    ironDrillId: 'chippy-little-8',
    driverDrillId: 'fairway-finder',
  },
  3: {
    name: 'Shaping & Scoring',
    warmupDrillId: 'hitting-bombs',
    wedgeDrillId: '100-meter-dash',
    ironDrillId: 'boot-camp',
    driverDrillId: 'the-alternator',
  },
  4: {
    name: 'On-Course Simulation',
    warmupDrillId: 'cold-brew',
    wedgeDrillId: 'step-up-step-down',
    ironDrillId: 'flushing-it',
    driverDrillId: 'the-chez',
  },
};

export const defaultHabitCategories = [
  { id: 'strength', name: 'Strength training', goal: 3 },
  { id: 'flexibility', name: 'Flexibility', goal: 1 },
  { id: 'mobility', name: 'Mobility', goal: 1 },
  { id: 'range', name: 'Driving range', goal: 1 },
  { id: 'short_game', name: 'Short game', goal: 1 },
];

export function getDrillById(id) {
  return drills.find(d => d.id === id) || null;
}

export function getDrillsByCategory(category) {
  return drills.filter(d => d.category === category);
}

export function isDrillPass(drill, score) {
  if (!drill || !score || drill.passThreshold === null || drill.passThreshold === undefined) return null;
  switch (drill.scoringType) {
    case 'rating':
      return typeof score.value === 'number' && score.value >= drill.passThreshold;
    case 'percent':
      return typeof score.total === 'number' && score.total > 0 &&
        (score.made / score.total * 100) >= drill.passThreshold;
    case 'fraction':
      return typeof score.made === 'number' && score.made >= drill.passThreshold;
    case 'count':
      return typeof score.value === 'number' && score.value <= drill.passThreshold;
    case 'level':
      return score.level === 'pass1' || score.level === 'pass2';
    case 'putt_distribution':
      return typeof score.three === 'number' && score.three === 0;
    default:
      return null;
  }
}

export function scoreSummary(drill, score) {
  if (!drill || !score) return '—';
  switch (drill.scoringType) {
    case 'rating':
      return score.value != null ? `${score.value} avg` : '—';
    case 'percent': {
      if (score.total == null || score.total === 0) return '—';
      const pct = Math.round(score.made / score.total * 100);
      return `${score.made}/${score.total} (${pct}%)`;
    }
    case 'fraction':
      return score.made != null && score.total != null ? `${score.made}/${score.total}` : '—';
    case 'count':
      return score.value != null ? String(score.value) : '—';
    case 'level':
      if (score.level === 'pass2') return 'Pass L2';
      if (score.level === 'pass1') return 'Pass L1';
      if (score.level === 'fail') return 'Fail';
      return '—';
    case 'putt_distribution':
      if (score.one == null) return '—';
      return `1-putts: ${score.one}, 2-putts: ${score.two}, 3+: ${score.three}`;
    default:
      return '—';
  }
}

export function getPassBadgeText(drill) {
  if (!drill) return '';
  if (drill.passThreshold === null || drill.passThreshold === undefined) return 'No threshold';
  switch (drill.scoringType) {
    case 'rating': return `Pass ≥ ${drill.passThreshold}`;
    case 'percent': return `Pass ≥ ${drill.passThreshold}%`;
    case 'fraction':
      return drill.totalTarget
        ? `Pass ≥ ${drill.passThreshold}/${drill.totalTarget}`
        : `Pass ≥ ${drill.passThreshold} made`;
    case 'count': return `Pass ≤ ${drill.passThreshold}`;
    case 'level': return 'Pass L1 or L2';
    case 'putt_distribution': return 'Pass: 0 three-putts';
    default: return '';
  }
}

export function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function getWeekStart(referenceDate) {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
