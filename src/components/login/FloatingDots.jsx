// Floating cyan/blue dots that drift slowly across the entire screen.
// Separate from the starfield — these are larger, glowing, and moving.

import { useRef, useEffect } from "react";

export default function FloatingDots() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const w = window.innerWidth;
    const h = window.innerHeight;

    // 120 floating dots — large, glowing, drifting
    const dots = Array.from({ length: 120 }, () => {
      const isCyan = Math.random() > 0.3;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3,
        r: 1.5 + Math.random() * 3,
        cr: isCyan ? 50 + Math.floor(Math.random() * 40) : 30,
        cg: isCyan ? 210 + Math.floor(Math.random() * 45) : 140 + Math.floor(Math.random() * 60),
        cb: 255,
        baseAlpha: 0.15 + Math.random() * 0.35,
        pulseSpeed: 0.5 + Math.random() * 2,
        pulsePhase: Math.random() * Math.PI * 2,
      };
    });

    const ctx = canvas.getContext("2d");
    let t = 0;

    const draw = () => {
      t += 0.01;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const d of dots) {
        // Move
        d.x += d.vx;
        d.y += d.vy;

        // Wrap around screen edges
        if (d.x < -10) d.x = w + 10;
        if (d.x > w + 10) d.x = -10;
        if (d.y < -10) d.y = h + 10;
        if (d.y > h + 10) d.y = -10;

        // Pulse
        const pulse = Math.sin(t * d.pulseSpeed + d.pulsePhase) * 0.5 + 0.5;
        const alpha = d.baseAlpha * (0.5 + pulse * 0.5);

        const px = d.x * dpr;
        const py = d.y * dpr;
        const r = d.r * dpr;

        // Glow
        const grd = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
        grd.addColorStop(0, `rgba(${d.cr},${d.cg},${d.cb},${alpha * 0.3})`);
        grd.addColorStop(1, `rgba(${d.cr},${d.cg},${d.cb},0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(px - r * 4, py - r * 4, r * 8, r * 8);

        // Core dot
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${d.cr},${d.cg},${d.cb},${alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-[1] pointer-events-none" />;
}
