import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
import {
  Wand2,
  RefreshCcw,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  CalendarClock,
  Zap,
  Hand,
} from "lucide-react";
import { useSkills } from "../hooks/useJarvis.js";
import { jarvis } from "../lib/jarvis.js";
import SkillRunResult, { StatusPill, formatDuration, formatCost } from "../components/skills/SkillRunResult.jsx";

function TriggerChip({ trigger }) {
  if (trigger.kind === "manual") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-[0.14em] font-semibold bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/30">
        <Hand size={10} /> Manual
      </span>
    );
  }
  if (trigger.kind === "cron") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-[0.14em] font-semibold bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/30" title={trigger.expr}>
        <CalendarClock size={10} /> {trigger.expr}
      </span>
    );
  }
  if (trigger.kind === "event") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-[0.14em] font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30">
        <Zap size={10} /> {trigger.event}
      </span>
    );
  }
  return null;
}

function ScopeChip({ scope }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-jarvis-surface/60 text-jarvis-body border border-jarvis-border">
      {scope}
    </span>
  );
}

function SkillListRow({ skill, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-3 rounded-xl transition border",
        active
          ? "bg-jarvis-primary/10 border-jarvis-primary/30 text-jarvis-primary "
          : "bg-jarvis-surface/20 border-jarvis-border text-jarvis-body hover:text-jarvis-ink hover:bg-white/5",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-semibold truncate ${active ? "text-jarvis-primary" : "text-jarvis-ink"}`}>
            {skill.title || skill.name}
          </div>
          <div className="text-[11px] text-jarvis-muted font-mono truncate">{skill.name}</div>
          {skill.description && (
            <div className="text-[11px] text-jarvis-body mt-1 line-clamp-2">{skill.description}</div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {(skill.triggers ?? []).map((t, i) => (
          <TriggerChip key={i} trigger={t} />
        ))}
      </div>
    </button>
  );
}

function RecentRunRow({ run }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-jarvis-surface/30 border border-jarvis-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition text-left"
      >
        {open ? <ChevronDown size={12} className="text-jarvis-muted" /> : <ChevronRight size={12} className="text-jarvis-muted" />}
        <StatusPill status={run.status} />
        <div className="text-[11px] text-jarvis-body tabular-nums">
          {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-jarvis-muted tabular-nums">
          <span>{formatDuration(run.durationMs)}</span>
          <span>{formatCost(run.costUsd)}</span>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-jarvis-border">
          <SkillRunResult run={run} />
        </div>
      )}
    </div>
  );
}

function WorkflowsSection({ workflows }) {
  const grouped = useMemo(() => {
    const out = { cron: [], event: [], manual: [] };
    for (const w of workflows ?? []) {
      const kind = w?.trigger?.kind ?? "manual";
      if (out[kind]) out[kind].push(w);
      else out.manual.push(w);
    }
    return out;
  }, [workflows]);

  const Section = ({ title, Icon, tone, items, emptyLabel }) => (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={tone} />
        <span className="label">{title}</span>
        <span className="text-[10px] text-jarvis-muted">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <div className="text-[11px] text-jarvis-muted italic">{emptyLabel}</div>
        )}
        {items.map((w, i) => (
          <div
            key={`${w.skill}-${i}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-jarvis-surface/30 border border-jarvis-border px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-[13px] text-jarvis-ink font-medium truncate">{w.skill}</div>
              <div className="text-[11px] text-jarvis-muted font-mono">
                {w.trigger?.kind === "cron" && w.trigger.expr}
                {w.trigger?.kind === "event" && w.trigger.event}
                {w.trigger?.kind === "manual" && "manual"}
              </div>
            </div>
            {w.nextRun && (
              <div className="flex items-center gap-1.5 text-[11px] text-jarvis-primary tabular-nums">
                <Clock size={11} />
                {new Date(w.nextRun).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="surfacep-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock size={14} className="text-jarvis-primary" />
        <h3 className="text-[14px] font-semibold text-jarvis-ink">Workflows</h3>
        <span className="text-[11px] text-jarvis-muted">{(workflows ?? []).length} active</span>
      </div>
      <div className="space-y-5">
        <Section
          title="Scheduled (cron)"
          Icon={CalendarClock}
          tone="text-jarvis-primary"
          items={grouped.cron}
          emptyLabel="No cron-scheduled skills."
        />
        <Section
          title="Event-triggered"
          Icon={Zap}
          tone="text-jarvis-purple"
          items={grouped.event}
          emptyLabel="No event-triggered skills."
        />
      </div>
    </div>
  );
}

export default function Skills() {
  const { skills, workflows, loading, error, refresh, run } = useSkills();
  const [selectedName, setSelectedName] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [skillRuns, setSkillRuns] = useState([]);
  const [latestRun, setLatestRun] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);

  // Auto-select first skill once loaded.
  useEffect(() => {
    if (!selectedName && skills.length > 0) {
      setSelectedName(skills[0].name);
    }
  }, [skills, selectedName]);

  // Fetch per-skill detail + runs on selection change.
  useEffect(() => {
    if (!selectedName) {
      setSelectedDetail(null);
      setSkillRuns([]);
      setLatestRun(null);
      return;
    }
    let cancelled = false;
    setLatestRun(null);
    setRunError(null);

    Promise.all([
      jarvis.getSkill(selectedName).catch(() => null),
      jarvis.listSkillRuns(selectedName, 20).catch(() => []),
    ]).then(([detail, runs]) => {
      if (cancelled) return;
      setSelectedDetail(detail ?? skills.find((s) => s.name === selectedName) ?? null);
      setSkillRuns(Array.isArray(runs) ? runs : []);
    });

    return () => { cancelled = true; };
  }, [selectedName, skills]);

  const refreshSkillRuns = async () => {
    if (!selectedName) return;
    try {
      const runs = await jarvis.listSkillRuns(selectedName, 20);
      setSkillRuns(Array.isArray(runs) ? runs : []);
    } catch {}
  };

  const handleRunNow = async () => {
    if (!selectedName || running) return;
    setRunning(true);
    setRunError(null);
    setLatestRun(null);
    try {
      const result = await run(selectedName, {});
      setLatestRun(result);
      await refreshSkillRuns();
    } catch (e) {
      setRunError(e?.message ?? "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const detail = selectedDetail ?? skills.find((s) => s.name === selectedName) ?? null;

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="h-full w-full flex flex-col min-h-0">
      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-jarvis-primary/10 border border-jarvis-primary/20 grid place-items-center">
            <Wand2 size={16} className="text-jarvis-primary" />
          </div>
          <div>
            <div className="label text-jarvis-primary">Skills</div>
            <div className="text-[12px] text-jarvis-body">
              Registry · {skills.length} skill{skills.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-lg text-[10px] uppercase tracking-[0.14em] font-semibold bg-jarvis-surface/40 text-jarvis-body border border-jarvis-border">
            {skills.length} total
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-surface/40 text-jarvis-body border border-jarvis-border hover:text-jarvis-ink hover:bg-white/5 transition disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Refresh
          </button>
        </div>
      </motion.div>

      <motion.div variants={stagger.item} className="flex-1 min-h-0 flex">
        {/* Left rail */}
        <div className="w-80 shrink-0 border-r border-jarvis-border bg-jarvis-surface/20 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {loading && (
              <div className="p-4 text-[11px] text-jarvis-muted flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Loading skills…
              </div>
            )}
            {!loading && error && (
              <div className="p-4 text-[11px] text-jarvis-danger">Skill registry unreachable</div>
            )}
            {!loading && !error && skills.length === 0 && (
              <div className="p-4 text-[11px] text-jarvis-muted italic">No skills registered yet.</div>
            )}
            {skills.map((s) => (
              <SkillListRow
                key={s.name}
                skill={s}
                active={s.name === selectedName}
                onClick={() => setSelectedName(s.name)}
              />
            ))}
          </div>
        </div>

        {/* Right area */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-6 py-5 space-y-5 pb-10">
            {!detail && !loading && (
              <div className="surfacep-6 text-jarvis-muted text-sm">
                Select a skill on the left to inspect its manifest and run it.
              </div>
            )}

            {detail && (
              <>
                {/* Manifest */}
                <div className="surfacep-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="label text-jarvis-primary">Manifest</div>
                      <h2 className="text-xl font-semibold text-jarvis-ink leading-tight mt-0.5">
                        {detail.title || detail.name}
                      </h2>
                      <div className="text-[11px] text-jarvis-muted font-mono mt-0.5">{detail.name}</div>
                      {detail.description && (
                        <div className="text-[13px] text-jarvis-body mt-3 whitespace-pre-wrap leading-relaxed">
                          {detail.description}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleRunNow}
                      disabled={running}
                      className={[
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition border shrink-0",
                        running
                          ? "bg-jarvis-primary/5 text-jarvis-primary/60 border-jarvis-primary/20 cursor-not-allowed"
                          : "bg-jarvis-primary/15 text-jarvis-primary border-jarvis-primary/40  hover:bg-jarvis-primary/25",
                      ].join(" ")}
                    >
                      {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {running ? "Running…" : "Run now"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-5 mt-5 pt-5 border-t border-jarvis-border">
                    <div>
                      <div className="label mb-1.5">Version</div>
                      <div className="text-[12px] text-jarvis-body font-mono">{detail.version ?? "—"}</div>
                    </div>
                    <div>
                      <div className="label mb-1.5">Author</div>
                      <div className="text-[12px] text-jarvis-body">{detail.author ?? "—"}</div>
                    </div>
                    <div>
                      <div className="label mb-1.5">Router hint</div>
                      <div className="text-[12px] text-jarvis-body font-mono">{detail.routerHint ?? "—"}</div>
                    </div>
                    <div>
                      <div className="label mb-1.5">Triggers</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(detail.triggers ?? []).length === 0 && (
                          <span className="text-[11px] text-jarvis-muted italic">None</span>
                        )}
                        {(detail.triggers ?? []).map((t, i) => <TriggerChip key={i} trigger={t} />)}
                      </div>
                    </div>
                  </div>

                  {(detail.scopes ?? []).length > 0 && (
                    <div className="mt-5 pt-5 border-t border-jarvis-border">
                      <div className="label mb-2">Scopes</div>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.scopes.map((s) => <ScopeChip key={s} scope={s} />)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Run result */}
                {(running || latestRun || runError) && (
                  <div className="space-y-2">
                    <div className="label">Latest run</div>
                    {running && !latestRun && (
                      <div className="surfacep-5 flex items-center gap-3 text-jarvis-body text-sm">
                        <Loader2 size={16} className="animate-spin text-jarvis-primary" />
                        Executing {detail.name}…
                      </div>
                    )}
                    {runError && !running && (
                      <div className="surfacep-5 border-jarvis-danger/30">
                        <div className="text-jarvis-danger text-sm font-semibold">Run failed</div>
                        <div className="text-jarvis-body text-xs mt-1">{runError}</div>
                      </div>
                    )}
                    {latestRun && <SkillRunResult run={latestRun} />}
                  </div>
                )}

                {/* Recent runs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="label">Recent runs</div>
                    <span className="text-[10px] text-jarvis-muted">{skillRuns.length}</span>
                  </div>
                  <div className="space-y-2">
                    {skillRuns.length === 0 && (
                      <div className="surfacep-4 text-[12px] text-jarvis-muted italic">No runs yet for this skill.</div>
                    )}
                    {skillRuns.map((r) => <RecentRunRow key={r.id} run={r} />)}
                  </div>
                </div>
              </>
            )}

            {/* Workflows */}
            <WorkflowsSection workflows={workflows} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
