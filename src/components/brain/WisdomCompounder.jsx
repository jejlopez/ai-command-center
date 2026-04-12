import { Layers } from "lucide-react";

export default function WisdomCompounder({ decisions = [], mistakes = [] }) {
  const compounded = decisions.filter((d) => d.outcome && d.lesson).length;
  const prevented = mistakes.filter((m) => m.prevented_next).length;

  return (
    <div className="surface p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-jarvis-success/10 border border-jarvis-success/20 grid place-items-center">
          <Layers size={15} className="text-jarvis-success" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Wisdom Compounder</div>
          <div className="text-xs text-jarvis-muted">ROI of your Brain page</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-jarvis-success/5 border border-jarvis-success/20 p-3 text-center">
          <div className="text-2xl font-bold text-jarvis-success tabular-nums">{compounded}</div>
          <div className="text-[10px] text-jarvis-muted mt-0.5">Insights compounding</div>
        </div>
        <div className="rounded-xl bg-jarvis-success/5 border border-jarvis-success/20 p-3 text-center">
          <div className="text-2xl font-bold text-jarvis-success tabular-nums">{prevented}</div>
          <div className="text-[10px] text-jarvis-muted mt-0.5">Mistakes not repeated</div>
        </div>
      </div>

      {compounded === 0 && prevented === 0 && (
        <p className="text-[11px] text-jarvis-muted text-center">
          Log decisions and mistakes — your wisdom compounds here.
        </p>
      )}
    </div>
  );
}
