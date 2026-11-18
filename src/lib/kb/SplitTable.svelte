<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import type { Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { mistagged, splitTicket, type Problem } from '#lib/kb/split';

  // `issues` maps each problem to the ticket filed for it: { parser: { label, href }, … }.
  let { ticket, issues }: { ticket: number; issues: Partial<Record<Problem, { label: string; href: string }>> } = $props();

  const split = $derived(splitTicket(reports as Report[], tenantOf, notes.oneDayMove, ticket));
  const dupes = $derived(split.rows - split.merged.length);
  const placed = $derived(split.groups.filter((g) => g.problem !== 'unplaced'));
  const channels = (c: Record<string, number>) =>
    Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .map(([ch, n]) => `${ch} ×${n}`)
      .join(' · ');
</script>

<p class="sum">
  <strong>{split.merged.length}</strong> reports in #{ticket}
  {#if dupes}(<strong>{split.rows}</strong> rows in the export; {dupes} were the same report twice){/if} ·
  <strong>{placed.length}</strong>
  {placed.length === 1 ? 'problem' : 'problems'}
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>channels</th><th>tenants</th><th>seen</th><th>ticket</th></tr>
  </thead>
  <tbody>
    {#each split.groups as g (g.problem)}
      {@const issue = g.problem === 'unplaced' ? undefined : issues[g.problem]}
      <tr class:open={!issue}>
        <td><code>{g.problem}</code></td>
        <td>{g.reports.length}</td>
        <td class="small">{channels(g.channels)}</td>
        <td class="small" title={g.tenants.join(', ')}>{g.tenants.length}</td>
        <td class="small">{g.firstSeen} → {g.lastSeen}</td>
        <td>{#if issue}<a href={issue.href}>{issue.label}</a>{:else}no ticket yet{/if}</td>
      </tr>
    {/each}
  </tbody>
</table>

{#each split.groups as g (g.problem)}
  {#each Object.entries(g.alsoIn) as [filed, n] (filed)}
    <p class="note">The {n} <code>{g.problem}</code> reports also count under <code>{filed}</code>, where the desk files them by tenant.</p>
  {/each}
{/each}

{#each placed as g (g.problem)}
  {@const off = mistagged(g)}
  {#if off}
    <p class="note">{off} of the <code>{g.problem}</code> reports carry a different intake tag.</p>
  {/if}
{/each}

<style>
  .sum { font-size: 1.1rem; }
  .small { color: var(--muted); font-size: 0.85em; }
  .note { color: var(--muted); font-size: 0.85em; }
  .open td { background: var(--warn-bg); }
  .open td:last-child { color: var(--warn); font-weight: 600; }
</style>
