import { useEffect, useRef } from "react";
import { QUALITY_PARTICLE_COUNTS, qualityDprCap, useQualityTier, qualityTierController } from "./qualityTier";

type Particle = { x: number; y: number; radius: number; alpha: number; speed: number; drift: number };

function createParticles(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.5 + Math.random() * 1.5,
    alpha: 0.12 + Math.random() * 0.3,
    speed: 0.04 + Math.random() * 0.12,
    drift: (Math.random() - 0.5) * 0.08,
  }));
}

/** Shared, pointer-transparent ambient canvas. It never owns game state. */
export function AmbientArena() {
  const tier = useQualityTier();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    let animationFrame = 0;
    let running = true;
    let previous = performance.now();
    let particles: Particle[] = [];
    const resize = () => {
      const dpr = qualityDprCap(tier);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticles(QUALITY_PARTICLE_COUNTS[tier], window.innerWidth, window.innerHeight);
    };
    const render = (now: number) => {
      const delta = Math.min(50, now - previous); previous = now;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (document.visibilityState === "visible" && document.documentElement.dataset.reducedMotion !== "true") {
        context.fillStyle = "rgba(68, 231, 255, 0.42)";
        for (const particle of particles) {
          particle.y -= particle.speed * delta;
          particle.x += particle.drift * delta;
          if (particle.y < -4) particle.y = window.innerHeight + 4;
          if (particle.x < -4) particle.x = window.innerWidth + 4;
          if (particle.x > window.innerWidth + 4) particle.x = -4;
          context.globalAlpha = particle.alpha;
          context.beginPath(); context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2); context.fill();
        }
        context.globalAlpha = 1;
      }
      qualityTierController.reportFrame(delta);
      if (running) animationFrame = window.requestAnimationFrame(render);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        running = false;
        window.cancelAnimationFrame(animationFrame);
        qualityTierController.resetFrameMonitor();
        return;
      }
      if (!running) {
        running = true;
        previous = performance.now();
        qualityTierController.resetFrameMonitor();
        animationFrame = window.requestAnimationFrame(render);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);
    animationFrame = window.requestAnimationFrame(render);
    return () => { running = false; window.cancelAnimationFrame(animationFrame); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [tier]);

  return <div className="ambient-arena" aria-hidden="true"><div className="ambient-aurora ambient-aurora-one" /><div className="ambient-aurora ambient-aurora-two" /><div className="ambient-grid" /><div className="ambient-scanline" /><canvas ref={canvasRef} className="ambient-particles" /></div>;
}
