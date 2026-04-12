import { JarvisHalo } from "../components/JarvisHalo.jsx";

export default function ComingSoon({ title, description, icon: Icon }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-10">
      <div className="glass p-10 max-w-xl w-full relative overflow-hidden text-center">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-jarvis-grid [background-size:24px_24px]" />
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 opacity-25 pointer-events-none">
          <JarvisHalo size={180} />
        </div>
        <div className="relative flex flex-col items-center gap-4 pt-10">
          {Icon && (
            <div className="w-14 h-14 rounded-2xl bg-jarvis-primary/10 border border-jarvis-primary/30 grid place-items-center">
              <Icon size={24} className="text-jarvis-primary" strokeWidth={1.8} />
            </div>
          )}
          <div className="label text-jarvis-primary">Surface</div>
          <h1 className="text-2xl font-semibold text-jarvis-ink tracking-wide">{title}</h1>
          <p className="text-jarvis-body text-sm leading-relaxed max-w-sm">{description}</p>
          <span className="chip mt-2 text-jarvis-amber border-jarvis-amber/30 bg-jarvis-amber/5">
            In planning — M2.x
          </span>
        </div>
      </div>
    </div>
  );
}
