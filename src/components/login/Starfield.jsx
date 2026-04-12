// 5000-star deep space — pure black, crystal clear, glossy.

import { useRef, useEffect } from "react";

export default function Starfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    let animId;
    let mouse = { x: 0.5, y: 0.5 };

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
    });

    const w = window.innerWidth;
    const h = window.innerHeight;

    // 8000 stars — 4 layers
    const stars = [];
    // Layer 1: 5000 dust — barely visible, ultra tiny
    for (let i = 0; i < 5000; i++) {
      stars.push({
        x: Math.random() * w * 1.3 - w * 0.15,
        y: Math.random() * h * 1.3 - h * 0.15,
        r: Math.random() * 0.6 + 0.2,
        twinkle: 0.3 + Math.random() * 2.5,
        phase: Math.random() * 6.28,
        base: 0.15 + Math.random() * 0.35,
        parallax: 0.003 + Math.random() * 0.005,
        cr: 255, cg: 255, cb: 255,
      });
    }
    // Layer 2: 1800 medium
    for (let i = 0; i < 1800; i++) {
      const tint = Math.random();
      let cr = 255, cg = 255, cb = 255;
      if (tint > 0.92) { cr = 180; cg = 210; cb = 255; } // blue-white
      else if (tint > 0.85) { cr = 255; cg = 230; cb = 180; } // warm
      else if (tint > 0.8) { cr = 140; cg = 255; cb = 240; } // cyan hint

      stars.push({
        x: Math.random() * w * 1.2 - w * 0.1,
        y: Math.random() * h * 1.2 - h * 0.1,
        r: Math.random() * 1.0 + 0.4,
        twinkle: 0.8 + Math.random() * 3,
        phase: Math.random() * 6.28,
        base: 0.35 + Math.random() * 0.45,
        parallax: 0.008 + Math.random() * 0.012,
        cr, cg, cb,
      });
    }
    // Layer 3: 300 bright
    for (let i = 0; i < 300; i++) {
      const tint = Math.random();
      let cr = 255, cg = 255, cb = 255;
      if (tint > 0.7) { cr = 93; cg = 232; cb = 255; } // cyan

      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.8,
        twinkle: 1.5 + Math.random() * 4,
        phase: Math.random() * 6.28,
        base: 0.6 + Math.random() * 0.4,
        parallax: 0.02 + Math.random() * 0.02,
        cr, cg, cb,
      });
    }

    // Layer 4: 400 cyan/blue dots — spread across entire page
    for (let i = 0; i < 400; i++) {
      stars.push({
        x: Math.random() * w * 1.1 - w * 0.05,
        y: Math.random() * h * 1.1 - h * 0.05,
        r: Math.random() * 2.0 + 1.0,
        twinkle: 0.6 + Math.random() * 2,
        phase: Math.random() * 6.28,
        base: 0.25 + Math.random() * 0.35,
        parallax: 0.015 + Math.random() * 0.025,
        cr: Math.random() > 0.4 ? 0 : 50,
        cg: Math.random() > 0.4 ? 200 + Math.floor(Math.random() * 55) : 150 + Math.floor(Math.random() * 80),
        cb: 255,
      });
    }

    const ctx = canvas.getContext("2d");
    let t = 0;

    const draw = () => {
      t += 0.008;
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      const mx = (mouse.x - 0.5) * 2;
      const my = (mouse.y - 0.5) * 2;

      for (const s of stars) {
        const tw = Math.sin(t * s.twinkle + s.phase) * 0.5 + 0.5;
        const alpha = s.base * (0.4 + tw * 0.6);

        const px = (s.x - mx * s.parallax * w) * dpr;
        const py = (s.y - my * s.parallax * h) * dpr;
        const r = s.r * dpr;

        ctx.beginPath();
        ctx.arc(px, py, r, 0, 6.28);
        ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${alpha})`;
        ctx.fill();

        // Cross-spike on brightest stars
        if (s.r > 1.5 && alpha > 0.7) {
          ctx.globalAlpha = alpha * 0.15;
          ctx.strokeStyle = `rgb(${s.cr},${s.cg},${s.cb})`;
          ctx.lineWidth = 0.5 * dpr;
          ctx.beginPath();
          ctx.moveTo(px - r * 4, py);
          ctx.lineTo(px + r * 4, py);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px, py - r * 4);
          ctx.lineTo(px, py + r * 4);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
}
