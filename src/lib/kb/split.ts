// Splits a merged ticket into the problems its reports actually hold. Pages explain it; this file is what runs.
//
// causes.ts files a report by tenant and channel. That places every report on a day-first tenant
// under `parser` or `hint`, including reports whose dates did not swap at all but moved by one day.
// The desk reads those bodies and lists them in desk-notes.json (`oneDayMove`). A one-day move is a
// clock problem (a date crossing a time zone), so it gets its own group here: `clock`.
// Counting follows the desk's view (CauseTable): a report counts under the cause it is filed by, so
// the `clock` reports also count in the group they are filed in. `alsoIn` names that group.
import { causeOf, uniqueById, type Cause, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = Cause | 'clock';
export const PROBLEMS: readonly Problem[] = ['parser', 'hint', 'clock'];

export type ProblemGroup = {
  problem: Problem | 'unplaced';
  reports: Report[];
  tenants: string[];
  channels: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  // For `clock`: how many of its reports are filed (and counted) under each cause.
  alsoIn: Record<string, number>;
};

export type Split = {
  // Rows in the export, before duplicates are dropped.
  rows: number;
  // Unique reports merged into the ticket.
  merged: Report[];
  groups: ProblemGroup[];
};

export function splitTicket(
  reports: Report[],
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
  ticket: number,
): Split {
  const inTicket = reports.filter((r) => r.mergedInto === ticket);
  const merged = uniqueById(inTicket);
  const filedAs = (r: Report) => causeOf(r, tenantOf(r)) ?? 'unplaced';
  const byProblem = new Map<ProblemGroup['problem'], Report[]>();
  const add = (p: ProblemGroup['problem'], r: Report) => byProblem.set(p, [...(byProblem.get(p) ?? []), r]);
  for (const r of merged) {
    add(filedAs(r), r);
    if (oneDayMove.includes(r.id)) add('clock', r);
  }
  const order = (p: ProblemGroup['problem']) => (p === 'unplaced' ? PROBLEMS.length : PROBLEMS.indexOf(p));
  const groups = [...byProblem.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        tenants: [...new Set(rs.map((r) => r.tenant))].sort(),
        channels: rs.reduce<Record<string, number>>((n, r) => ({ ...n, [r.channel]: (n[r.channel] ?? 0) + 1 }), {}),
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
        alsoIn:
          problem === 'clock'
            ? rs.reduce<Record<string, number>>((n, r) => ({ ...n, [filedAs(r)]: (n[filedAs(r)] ?? 0) + 1 }), {})
            : {},
      };
    })
    .sort((a, b) => order(a.problem) - order(b.problem));
  return { rows: inTicket.length, merged, groups };
}

// Reports whose intake tag names a different cause than the one they are filed under.
// Only filed causes count; `clock` reports are checked in the group they are filed in.
export function mistagged(g: ProblemGroup): number {
  return g.problem === 'clock' || g.problem === 'unplaced'
    ? 0
    : g.reports.filter((r) => r.meta.intakeTag !== g.problem).length;
}
