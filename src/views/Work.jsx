import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Folder,
  ListTodo,
  User,
  Search,
  X,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { jarvis } from "../lib/jarvis.js";
import SkillShortcuts from "../components/shared/SkillShortcuts.jsx";
import QuickNoteForm from "../components/shared/QuickNoteForm.jsx";
import SkillRunResult from "../components/skills/SkillRunResult.jsx";

const COLUMNS = [
  { kind: "project", title: "Projects", Icon: Folder,  tone: "text-jarvis-blue"  },
  { kind: "task",    title: "Tasks",    Icon: ListTodo, tone: "text-jarvis-amber" },
  { kind: "person",  title: "People",   Icon: User,     tone: "text-jarvis-cyan"  },
];

const SHORTCUTS = ["meeting_prep", "doc_summarize", "daily_recap", "weekly_review"];

// Some shortcuts need inputs before running. Define a minimal schema per known skill.
const SKILL_INPUT_SCHEMAS = {
  meeting_prep:  [{ name: "topic", label: "Meeting topic", required: true, type: "string" }],
  doc_summarize: [{ name: "text",  label: "Document text", required: true, type: "textarea" }],
  daily_recap:   [],
  weekly_review: [],
};

function Column({ column, nodes, filter }) {
  const Icon = column.Icon;
  const q = (filter ?? "").trim().toLowerCase();
  const filtered = q
    ? nodes.filter((n) => {
        const l = (n.label ?? "").toLowerCase();
        const b = (n.body ?? "").toLowerCase();
        return l.includes(q) || b.includes(q);
      })
    : nodes;

  return (
    <div className="glass p-4 min-h-[240px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={14} className={column.tone} />
          <span className="label">{column.title}</span>
        </div>
        <span className="text-[10px] text-jarvis-muted tabular-nums">
          {filtered.length}/{nodes.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
        {nodes.length === 0 ? (
          <div className="text-[11px] text-jarvis-muted italic">Nothing yet</div>
        ) : filtered.length === 0 ? (
          <div className="text-[11px] text-jarvis-muted italic">No matches</div>
        ) : (
          filtered.map((n) => {
            const body = (n.body ?? "").trim();
            const snippet = body.length > 100 ? `${body.slice(0, 100)}…` : body;
            return (
              <div
                key={n.id}
                className="rounded-xl bg-jarvis-panel/30 border border-jarvis-border px-3 py-2"
                title={n.label}
              >
                <div className="text-[12px] text-jarvis-ink font-semibold truncate">
                  {n.label}
                </div>
                {snippet && (
                  <div className="text-[10px] text-jarvis-body mt-0.5 leading-snug truncate">
                    {snippet}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SkillRunModal({ open, skillName, onClose, onRun, running, result, error }) {
  const schema = SKILL_INPUT_SCHEMAS[skillName] ?? [];
  const [values, setValues] = useState({});

  useEffect(() => {
    if (open) setValues({});
  }, [open, skillName]);

  if (!open) return null;

  const canSubmit = schema.every((f) => !f.required || String(values[f.name] ?? "").trim().length > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onRun(values);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-6">
      <form onSubmit={submit} className="glass w-full max-w-xl p-6 relative max-h-[85vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-jarvis-muted hover:text-jarvis-ink hover:bg-white/5"
        >
          <X size={16} />
        </button>
        <div className="label text-jarvis-cyan mb-1">Run skill</div>
        <h2 className="text-lg font-semibold text-jarvis-ink mb-4 font-mono">{skillName}</h2>

        {schema.length === 0 && !result && !error && !running && (
          <div className="text-[12px] text-jarvis-body mb-4">
            This skill takes no inputs. Click Run to execute.
          </div>
        )}

        {schema.map((f) => (
          <div key={f.name} className="mb-4">
            <label className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted font-semibold">
              {f.label}{f.required && " *"}
            </label>
            {f.type === "textarea" ? (
              <textarea
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                rows={6}
                className="mt-1 w-full bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-cyan/50 outline-none resize-none"
              />
            ) : (
              <input
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="mt-1 w-full bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-cyan/50 outline-none"
              />
            )}
          </div>
        ))}

        {running && (
          <div className="flex items-center gap-2 text-[12px] text-jarvis-body mb-4">
            <Loader2 size={13} className="animate-spin text-jarvis-cyan" />
            Executing {skillName}…
          </div>
        )}

        {error && !running && (
          <div className="mb-4 rounded-xl border border-jarvis-red/30 bg-jarvis-red/5 p-3 text-[12px] text-jarvis-red">
            {error}
          </div>
        )}

        {result && !running && (
          <div className="mb-4">
            <div className="label mb-2">Result</div>
            <SkillRunResult run={result} />
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-jarvis-body hover:text-jarvis-ink hover:bg-white/5 transition"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={running || !canSubmit}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-cyan/10 text-jarvis-cyan border border-jarvis-cyan/30 shadow-glow-cyan hover:bg-jarvis-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {running && <Loader2 size={13} className="animate-spin" />}
            Run
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Work() {
  const [byKind, setByKind] = useState({ project: [], task: [], person: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");

  const [modalSkill, setModalSkill] = useState(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projects, tasks, people] = await Promise.all([
        jarvis.memoryList("project").catch(() => []),
        jarvis.memoryList("task").catch(() => []),
        jarvis.memoryList("person").catch(() => []),
      ]);
      setByKind({
        project: Array.isArray(projects) ? projects : [],
        task:    Array.isArray(tasks)    ? tasks    : [],
        person:  Array.isArray(people)   ? people   : [],
      });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const totalCount = useMemo(
    () => byKind.project.length + byKind.task.length + byKind.person.length,
    [byKind]
  );

  const handleSave = async ({ kind, label, body, trust }) => {
    await jarvis.memoryRemember({ kind, label, body, trust });
    await refresh();
  };

  const openShortcut = (name) => {
    setModalSkill(name);
    setRunResult(null);
    setRunError(null);
    // Skills with no inputs auto-run immediately.
    const schema = SKILL_INPUT_SCHEMAS[name] ?? [];
    if (schema.length === 0) {
      runSkill(name, {});
    }
    return Promise.resolve();
  };

  const runSkill = async (name, inputs) => {
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const res = await jarvis.runSkill(name, inputs ?? {});
      setRunResult(res);
    } catch (e) {
      setRunError(e?.message ?? "Run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-jarvis-cyan/10 border border-jarvis-cyan/20 grid place-items-center">
            <Briefcase size={16} className="text-jarvis-cyan" />
          </div>
          <div>
            <div className="label text-jarvis-cyan">Work</div>
            <div className="text-[12px] text-jarvis-body">
              Projects, tasks, and people · {totalCount} items
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-panel/40 text-jarvis-body border border-jarvis-border hover:text-jarvis-ink hover:bg-white/5 transition disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter across projects, tasks, people…"
              className="w-full bg-jarvis-panel/40 border border-jarvis-border rounded-xl pl-9 pr-3 py-2 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-cyan/50 outline-none"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-jarvis-red/30 bg-jarvis-red/5 p-4 text-[12px] text-jarvis-red">
              Couldn't load memory. Is the daemon running?
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              <Column
                key={col.kind}
                column={col}
                nodes={byKind[col.kind] ?? []}
                filter={filter}
              />
            ))}
          </div>

          <div className="glass p-5">
            <div className="label text-jarvis-cyan mb-3">Skill shortcuts</div>
            <SkillShortcuts skills={SHORTCUTS} onRun={openShortcut} />
          </div>

          <QuickNoteForm
            kinds={["project", "task", "person"]}
            onSave={handleSave}
            title="Add work item"
            placeholder="e.g. Ship v2 launch"
            bodyPlaceholder="Optional notes"
          />
        </div>
      </div>

      <SkillRunModal
        open={modalSkill != null}
        skillName={modalSkill}
        onClose={() => { setModalSkill(null); setRunResult(null); setRunError(null); }}
        onRun={(inputs) => runSkill(modalSkill, inputs)}
        running={running}
        result={runResult}
        error={runError}
      />
    </div>
  );
}
