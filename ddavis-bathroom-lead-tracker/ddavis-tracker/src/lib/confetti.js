// Gold confetti for marking a lead Won. Respects reduced-motion settings.
let canvas, ctx, parts = [], raf

export function fireConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99'
    document.body.appendChild(canvas)
    ctx = canvas.getContext('2d')
  }
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const colors = ['#f3ab2d', '#ffbe52', '#34d399', '#f4f4f6', '#d9951c']
  for (let i = 0; i < 160; i++) {
    parts.push({
      x: window.innerWidth * (0.2 + Math.random() * 0.6), y: -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4,
      g: 0.12 + Math.random() * 0.1, s: 4 + Math.random() * 5,
      c: colors[i % colors.length], a: 1,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
    })
  }
  cancelAnimationFrame(raf)
  tick()
}

function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr; p.a -= 0.007
    ctx.save(); ctx.globalAlpha = Math.max(p.a, 0)
    ctx.translate(p.x, p.y); ctx.rotate(p.rot)
    ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6)
    ctx.restore()
  }
  parts = parts.filter(p => p.a > 0 && p.y < canvas.height + 40)
  if (parts.length) raf = requestAnimationFrame(tick)
  else ctx.clearRect(0, 0, canvas.width, canvas.height)
}
