import { useState } from 'react';

const SECTIONS = [
  {
    id: 'workflow',
    icon: 'bi-calendar-week',
    title: 'Weekly Workflow (start here)',
    body: (
      <>
        <p>The typical week as an admin looks like this:</p>
        <ol>
          <li><b>Play happens</b> and scores get entered in <i>Golf League Guru</i> (the external scoring app where handicaps live).</li>
          <li>Export the round from Golf League Guru → <b>Reports → Round Scores → Export CSV</b>.</li>
          <li>In this app go to <b>Admin → Upload Round</b>, drop in the CSV. The week number auto-fills.</li>
          <li>Resolve any prompts: <b>subs</b>, <b>no-shows</b>, and <b>tied-handicap pairings</b> (covered below).</li>
          <li>Click <b>Save Round</b>. The app calculates match play, skins, weekly low net, and updates every leaderboard automatically.</li>
        </ol>
        <p className="text-muted small mb-0">Everything downstream (standings, leaderboards, degens) is generated from the rounds you upload — there is nothing else to enter by hand.</p>
      </>
    ),
  },
  {
    id: 'upload',
    icon: 'bi-cloud-upload',
    title: 'Uploading a Round',
    body: (
      <>
        <p>Upload pulls a Golf League Guru <b>Round Scores</b> CSV and turns it into match results, skins, and stats.</p>
        <ul>
          <li><b>Week #</b> — auto-filled from the most recent upload + 1. Always editable; it advances automatically after each save.</li>
          <li><b>Round Date</b> — the date the round was actually played (used on Match Results).</li>
          <li><b>Validation</b> — the app flags suspicious data on parse: handicaps out of range, hole scores of 0 or above 15, or fewer than 2 players. These are warnings, not blocks.</li>
          <li><b>Duplicate guard</b> — if a file with the same name was already uploaded, you'll be warned to avoid a double-entry.</li>
        </ul>
        <p className="mb-0">A week needs a <b>Week #</b> for match play to be calculated (it has to know which scheduled matchups to score).</p>
      </>
    ),
  },
  {
    id: 'subs',
    icon: 'bi-arrow-left-right',
    title: 'Subs',
    body: (
      <>
        <p>A <b>sub</b> is someone who plays in place of an absent regular. When the CSV contains a player who isn't on any team roster, the upload asks who they're subbing for.</p>
        <ul>
          <li>Pick the regular player they replaced. Once chosen, that player is removed from the other sub dropdowns so you can't assign them twice.</li>
          <li>The sub's <b>team is auto-derived</b> from the player they replaced, so match play scores correctly.</li>
          <li>Their score also stands in for the absent player in <b>Weekly Low Net</b> (Degens).</li>
        </ul>
        <p className="mb-0">All sub activity is logged on the <b>Subs</b> tab: who subbed, what week, who they replaced, their handicap that round, who they played, and the result — plus "Needs a Sub Most" (which regulars miss the most) and "Total Times Subbed."</p>
      </>
    ),
  },
  {
    id: 'noshow',
    icon: 'bi-person-x',
    title: 'No-Shows',
    body: (
      <>
        <p>A <b>no-show</b> is a rostered player who didn't play <i>and</i> had no sub. The upload auto-detects these (a roster player missing from the CSV with no sub) and lets you confirm.</p>
        <p>When you mark a no-show:</p>
        <ul>
          <li>The no-show <b>forfeits their individual match</b> (the opponent wins that point).</li>
          <li>Their team <b>forfeits the Team Net point</b> (they can't post two valid scores).</li>
          <li>Their <b>teammate still plays one live match</b> — you pick which opponent they face.</li>
        </ul>
        <p className="mb-0"><b>Important:</b> if a team is short a player and you <i>don't</i> mark a no-show (or assign a sub), the app cannot score that matchup and will skip it silently — those 3 points go missing. Always resolve a short-handed team before saving.</p>
      </>
    ),
  },
  {
    id: 'tied',
    icon: 'bi-shuffle',
    title: 'Tied-Handicap Pairings',
    body: (
      <>
        <p>In each matchup the lower-handicap players face each other (the <b>Low</b> match) and the higher-handicap players face each other (the <b>High</b> match). The app sorts each team by handicap automatically.</p>
        <p className="mb-0">If a team's two players have the <b>same handicap</b>, the app can't tell who is "Low" vs "High," so it asks you to set the pairing for that matchup before saving.</p>
      </>
    ),
  },
  {
    id: 'matchplay',
    icon: 'bi-trophy',
    title: 'Match Play & Scoring',
    body: (
      <>
        <p>Each weekly matchup is 2-v-2 and worth <b>3 points</b>:</p>
        <ul>
          <li><b>Low HC match</b> — the two lower-handicap players, head-to-head — 1 point</li>
          <li><b>High HC match</b> — the two higher-handicap players, head-to-head — 1 point</li>
          <li><b>Team Net</b> — combined net score of both players; lower total wins — 1 point</li>
        </ul>
        <p>Head-to-head matches use the <b>handicap-difference method</b>: only the difference between the two players' handicaps is applied, and the higher-handicap player receives that many strokes on the hardest holes. Each hole goes to the lower net score; whoever wins more holes wins the match.</p>
        <p className="mb-0"><b>Ties:</b> a tied hole is halved; a tied match or tied team net splits the point <b>0.5 each</b>. A win is 1, a loss is 0.</p>
      </>
    ),
  },
  {
    id: 'handicaps',
    icon: 'bi-sliders',
    title: 'Handicaps',
    body: (
      <>
        <p><b>Handicaps are calculated in Golf League Guru, not in this app.</b> This app simply reads each player's handicap from the uploaded CSV and uses it for match play and skins.</p>
        <p>For reference, the league's Golf League Guru settings compute a 9-hole handicap as:</p>
        <ul>
          <li>Average of the player's <b>best 8 of their 10 most recent rounds</b> (the 2 highest are dropped),</li>
          <li>with each hole <b>capped at net double bogey</b>,</li>
          <li>as <b>(avg score − avg par) × 100%</b>.</li>
        </ul>
        <p className="mb-0">If a handicap looks wrong, it's corrected in Golf League Guru and flows in on the next upload. The app's stats pages show a <b>Handicap Tracker</b> so you can watch how each player's number trends over the season.</p>
      </>
    ),
  },
  {
    id: 'skins',
    icon: 'bi-cash-coin',
    title: 'Skins (Degens)',
    body: (
      <>
        <p>Skins is a side game across the whole field each week. On every hole, the player with the <b>lowest unique net score</b> wins the skin; if two or more tie for low, no one wins it and it effectively carries.</p>
        <ul>
          <li>Net per hole uses each player's strokes received on that hole (based on hole difficulty / stroke index).</li>
          <li>The Degens section has a <b>handicap-percentage toggle</b> — Full (100%), 75%, 50%, 25% — and shows a season leaderboard for each option. Lower percentages give high-handicap players fewer strokes.</li>
        </ul>
        <p className="mb-0">Who's <b>in</b> the skins pool (and who has paid) is managed on the <b>Degens</b> admin tab.</p>
      </>
    ),
  },
  {
    id: 'degens',
    icon: 'bi-dice-5',
    title: 'Weekly Low Net & Managing Degens',
    body: (
      <>
        <p><b>Weekly Low Net</b> is a degens game tracking the lowest net score each week, with a season leaderboard.</p>
        <ul>
          <li>If a regular degen was absent and a sub played for them, the sub's score is used in their place that week (labeled "Sub for …").</li>
          <li>The <b>Degens</b> admin tab is where you set who is participating and track who has <b>paid</b> (unpaid players are highlighted).</li>
        </ul>
        <p className="mb-0">Skins and Weekly Low Net are independent of the league standings — they're the "for fun / for money" side games.</p>
      </>
    ),
  },
  {
    id: 'standings',
    icon: 'bi-list-ol',
    title: 'Standings',
    body: (
      <>
        <p>The <b>League → Standings</b> page ranks teams by total points earned across all matches (3 available per matchup). Ties split 0.5 each, so half-points are normal.</p>
        <p className="mb-0">Standings are a pure sum of match results — every team's total is exactly the points from the matchups they've played. If a number ever looks off, it almost always traces to a <b>missing or unscored match</b> (e.g., a short-handed team where a no-show wasn't marked).</p>
      </>
    ),
  },
  {
    id: 'leaderboards',
    icon: 'bi-bar-chart',
    title: 'Player Leaderboards & Stats',
    body: (
      <>
        <p>The <b>League → Leaderboards</b> page is all derived from uploaded scores. It includes:</p>
        <ul>
          <li><b>Net / Gross toggle</b> — best single round, season average, and eagles / birdies / pars counts.</li>
          <li><b>Power Rankings</b> — a blended rating over the last 3 weeks (scoring + match points), with a week-over-week position-change arrow.</li>
          <li><b>Handicap Tracker</b> — how each player's handicap has moved over the season.</li>
          <li><b>Strength of Schedule</b> — how the opponents you faced actually played versus their handicap in your matchups (higher = you caught opponents on hot weeks). Click a name for the opponent-by-opponent breakdown.</li>
          <li><b>Total Match Points Won</b> — season individual head-to-head points for every league member.</li>
        </ul>
        <p className="mb-0">Click any underlined score to open a hole-by-hole detail for that round.</p>
      </>
    ),
  },
  {
    id: 'schedule',
    icon: 'bi-calendar3',
    title: 'Schedule & Rainouts',
    body: (
      <>
        <p>Import the full-season schedule from Golf League Guru's matches CSV (import teams first). Each week lists its matchups; you can also add or override a single matchup manually.</p>
        <p><b>Rainouts:</b></p>
        <ul>
          <li><b>Mark Rainout</b> on a week, then set a reschedule date (or mark it "not rescheduling").</li>
          <li><b>Move &amp; Renumber</b> (on a rescheduled week) moves that week to its new date and re-numbers every week in date order — earlier weeks keep their numbers, later weeks shift to close the gap. The rescheduled matchups land where their new date falls (usually the end of the season).</li>
        </ul>
        <p className="mb-0">Played rounds keep their data through a renumber, so it's safe to reschedule after the season has started.</p>
      </>
    ),
  },
  {
    id: 'teamsplayers',
    icon: 'bi-people',
    title: 'Teams, Players & Round Log',
    body: (
      <>
        <ul>
          <li><b>Teams</b> — create teams and assign each one its two regular players.</li>
          <li><b>Players</b> — the master roster of everyone in the league.</li>
          <li><b>Round Log</b> — every uploaded round, with inline edit and delete. Deleting a round removes its match results, skins, and net totals. There is no way to <i>add</i> a skipped match from here — if a matchup was missed, re-upload that week (or fix it directly in the database).</li>
        </ul>
        <p className="mb-0 text-muted small">Tip: keep team rosters current — subs and no-shows are detected by comparing the CSV against each team's roster.</p>
      </>
    ),
  },
  {
    id: 'settings',
    icon: 'bi-shield-lock',
    title: 'Login, Settings & Security',
    body: (
      <>
        <ul>
          <li><b>Login</b> uses Supabase Auth (email + password). Admin accounts are created/removed in the Supabase dashboard, not in the app.</li>
          <li><b>Change Password</b> is on the <b>Settings</b> tab.</li>
          <li><b>Auto-logout</b> — you're signed out after 4 hours of inactivity for security.</li>
          <li>All public pages are read-only; only a logged-in admin can write data (enforced at the database level).</li>
        </ul>
        <p className="mb-0">If you get logged out unexpectedly, it's the inactivity timeout — just log back in.</p>
      </>
    ),
  },
  {
    id: 'practice',
    icon: 'bi-golf',
    title: 'Practice Tracker (optional)',
    body: (
      <>
        <p>The <b>Practice</b> area is a personal training tracker, separate from league play: weekly habit goals (strength, flexibility/mobility, range, short game, cardio), monthly range/short-game drill plans, and a log of range and short-game sessions.</p>
        <p className="mb-0">The <b>Practice</b> admin tab configures the habit categories &amp; goals and the monthly drill plans. It does not affect league standings.</p>
      </>
    ),
  },
];

export default function AdminGuide() {
  const [open, setOpen] = useState({ workflow: true });
  const toggle = (id) => setOpen(o => ({ ...o, [id]: !o[id] }));
  const allOpen = SECTIONS.every(s => open[s.id]);
  const setAll = (v) => setOpen(v ? Object.fromEntries(SECTIONS.map(s => [s.id, true])) : {});

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="fw-bold mb-0"><i className="bi bi-book me-2 text-matador-red"></i>Admin Guide</h5>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => setAll(!allOpen)}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <p className="text-muted small mb-3">
        A reference for how every part of the league site works. Click a section to expand it.
        Scores flow in from Golf League Guru via the weekly upload; everything else — match play, standings,
        skins, leaderboards — is generated automatically from those uploads.
      </p>

      {SECTIONS.map(s => {
        const isOpen = !!open[s.id];
        return (
          <div className="card border-0 shadow-sm mb-2" key={s.id}>
            <button
              className="btn text-start w-100 d-flex justify-content-between align-items-center px-3 py-3"
              onClick={() => toggle(s.id)}
              style={{ color: 'inherit' }}
            >
              <span className="fw-semibold">
                <i className={`bi ${s.icon} me-2 text-matador-red`}></i>{s.title}
              </span>
              <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'} text-muted`}></i>
            </button>
            {isOpen && (
              <div className="card-body pt-0 px-3 pb-3" style={{ fontSize: '0.92rem', lineHeight: 1.55 }}>
                <hr className="mt-0" />
                {s.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
