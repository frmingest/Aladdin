/** The backend's own Night Watch sentences (`night_watch.py`), each with the numbers that must survive. Test data only. */
export const WATCH_LINE_SAMPLES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["The watch has never walked the walls: the nightly tripwire check has not run. Start the PC worker; it runs the check once a day.", []],
  ["The watch last reported 52 hours ago, which is longer than a night. The worker may be off, so nothing below is fresh.", ["52 hours"]],
  ["The watch walked the walls 3 hours ago.", ["3 hours"]],
  ["7 more tripwires fired overnight.", ["7 more tripwires"]],
  ["4 earlier tripwire(s) are still firing on 2 tower(s).", ["4 earlier tripwires", "2 towers"]],
  ["5 more change(s) between the last two stored frames.", ["5 more changes"]],
  ["3 new report(s) landed overnight: Subsea 7 S.A ×80, Vend.", ["3 ravens", "Subsea 7 S.A ×80, Vend"]],
  ["No fortress frame has been stored yet, so the dispatch cannot say what changed. The worker stores one a day.", []],
  ["One fortress frame is stored; changes show from the second one.", []],
  ["Nothing fired, nothing is firing, and nothing changed overnight.", []],
  ["2 tripwire(s) fired overnight.", ["2 tripwires"]],
  ["3 tripwire(s) are firing.", ["3 tripwires"]],
  ["The watch has not reported in, so quiet cannot be claimed.", []],
  ["A quiet night: nothing is firing.", []],
  ["between the two newest stored frames, up to 2026-11-08", ["2026-11-08"]],
];
