import { useEffect, useRef } from "react";

export default function RootsLoader() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const ctx = el.getContext("2d");
    if (!ctx) return undefined;

    const W = 300;
    const H = 200;
    el.width = W;
    el.height = H;

    const roots = [
      [
        { x: 150, y: 100 },
        { x: 136, y: 122 },
        { x: 118, y: 148 },
        { x: 92, y: 182 },
      ],
      [
        { x: 150, y: 100 },
        { x: 158, y: 118 },
        { x: 172, y: 142 },
        { x: 188, y: 172 },
      ],
      [
        { x: 150, y: 100 },
        { x: 148, y: 128 },
        { x: 142, y: 156 },
        { x: 128, y: 190 },
      ],
      [
        { x: 150, y: 100 },
        { x: 154, y: 112 },
        { x: 168, y: 128 },
        { x: 198, y: 152 },
      ],
      [
        { x: 150, y: 100 },
        { x: 140, y: 108 },
        { x: 124, y: 124 },
        { x: 108, y: 156 },
      ],
      [
        { x: 150, y: 100 },
        { x: 162, y: 108 },
        { x: 182, y: 124 },
        { x: 212, y: 158 },
      ],
    ];

    let progress = 0;
    let direction = 1;
    let frame = 0;
    let animId = 0;
    let stopped = false;

    function drawCubic(pts, t) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      const steps = Math.floor(t * 40);
      for (let s = 1; s <= steps; s += 1) {
        const u = s / 40;
        const mt = 1 - u;
        const x =
          mt * mt * mt * pts[0].x +
          3 * mt * mt * u * pts[1].x +
          3 * mt * u * u * pts[2].x +
          u * u * u * pts[3].x;
        const y =
          mt * mt * mt * pts[0].y +
          3 * mt * mt * u * pts[1].y +
          3 * mt * u * u * pts[2].y +
          u * u * u * pts[3].y;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#2D6A2F";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    function drawSeedling(f) {
      const angle = Math.sin(f * 0.04) * 0.07;
      ctx.save();
      ctx.translate(150, 98);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -26);
      ctx.strokeStyle = "#2D6A2F";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.fillStyle = "#2D6A2F";
      ctx.beginPath();
      ctx.ellipse(-9, -33, 10, 5.5, -0.63, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(9, -33, 10, 5.5, 0.63, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function animate() {
      if (stopped) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(139, 105, 20, 0.12)";
      ctx.fillRect(0, 100, W, 100);
      ctx.beginPath();
      ctx.moveTo(0, 100);
      ctx.lineTo(W, 100);
      ctx.strokeStyle = "#7A6A45";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      progress += direction * 0.006;
      if (progress >= 1) {
        progress = 1;
        direction = -1;
      }
      if (progress <= 0) {
        progress = 0;
        direction = 1;
      }
      roots.forEach((pts, i) => {
        const delay = i * 0.12;
        const t = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
        if (t > 0) drawCubic(pts, t);
      });
      drawSeedling(frame);
      frame += 1;
      animId = requestAnimationFrame(animate);
    }

    animate();
    return () => {
      stopped = true;
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", margin: "0 auto", borderRadius: "8px" }}
    />
  );
}
