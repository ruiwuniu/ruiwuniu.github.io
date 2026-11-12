/* A decorative, slowly morphing network. No tracking or pointer interception. */
const root = document.documentElement;
const canvas = document.getElementById('network-background');
const toggle = document.getElementById('motion-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let preference = null;
try { preference = localStorage.getItem('network-motion'); } catch { /* Private browsing. */ }
let motion = preference === 'on' || (preference !== 'off' && !reducedMotion.matches);
let refresh = () => {};
function applyMotion() {
  root.dataset.motion = motion ? 'on' : 'off';
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(motion));
    toggle.setAttribute('aria-label', motion ? 'Pause background and cursor animation' : 'Enable background and cursor animation');
    toggle.textContent = motion ? 'Motion: on' : 'Motion: off';
  }
  refresh();
}
if (toggle) toggle.addEventListener('click', () => {
  motion = !motion;
  preference = motion ? 'on' : 'off';
  try { localStorage.setItem('network-motion', preference); } catch { /* Optional preference. */ }
  applyMotion();
});
reducedMotion.addEventListener('change', () => {
  if (preference !== 'on' && preference !== 'off') {
    motion = !reducedMotion.matches;
    applyMotion();
  }
});
applyMotion();

async function startNetwork() {
  if (!canvas) return;
  // Pinned Three.js release; failure leaves the existing CSS grid intact.
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 30);
  camera.position.z = 7.5;
  const group = new THREE.Group();
  scene.add(group);
  const count = window.innerWidth < 640 ? 64 : 112;
  const points = new Float32Array(count * 3);
  const edgePositions = new Float32Array(count * 4 * 6);
  const edgeColors = new Float32Array(count * 4 * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage));
  const pointMaterial = new THREE.PointsMaterial({ color: 0x39d460, size: 0.026, transparent: true, opacity: 0.52, depthWrite: false });
  group.add(new THREE.Points(geometry, pointMaterial));
  const linesGeometry = new THREE.BufferGeometry();
  linesGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3).setUsage(THREE.DynamicDrawUsage));
  linesGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3).setUsage(THREE.DynamicDrawUsage));
  const lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.26, depthWrite: false });
  group.add(new THREE.LineSegments(linesGeometry, lineMaterial));
  const baseColor = new THREE.Color();
  const forms = Array.from({ length: 3 }, () => new Float32Array(count * 3));
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const y = 1 - 2 * (i + 0.5) / count;
    const radius = Math.sqrt(1 - y * y);
    forms[0].set([2.3 * radius * Math.cos(angle), 2.3 * y, 2.3 * radius * Math.sin(angle)], i * 3);
    const ring = i * 2.399963;
    const around = i * Math.PI * 2 / count;
    forms[1].set([(1.85 + 0.72 * Math.cos(ring)) * Math.cos(around), 0.72 * Math.sin(ring), (1.85 + 0.72 * Math.cos(ring)) * Math.sin(around)], i * 3);
    const cluster = i % 4;
    forms[2].set([1.4 * Math.cos(cluster * Math.PI / 2) + radius * Math.cos(angle), 1.5 * y, 1.4 * Math.sin(cluster * Math.PI / 2) + radius * Math.sin(angle)], i * 3);
  }
  let elapsed = 0;
  let frame = 0;
  let last = 0;
  let available = true;
  function render() {
    const stage = elapsed / 22;
    const from = Math.floor(stage) % forms.length;
    const to = (from + 1) % forms.length;
    const mix = (1 - Math.cos((stage % 1) * Math.PI)) / 2;
    for (let i = 0; i < points.length; i++) points[i] = forms[from][i] * (1 - mix) + forms[to][i] * mix + Math.sin(elapsed * 0.24 + i * 1.73) * 0.07;
    geometry.attributes.position.needsUpdate = true;
    let edge = 0;
    const limit = 1.35;
    for (let i = 0; i < count; i++) {
      let neighbours = 0;
      for (let j = i + 1; j < count && neighbours < 4; j++) {
        const distance = Math.hypot(points[i * 3] - points[j * 3], points[i * 3 + 1] - points[j * 3 + 1], points[i * 3 + 2] - points[j * 3 + 2]);
        if (distance >= limit) continue;
        const strength = Math.max(0, 1 - distance / limit);
        for (let end = 0; end < 2; end++) {
          const node = end ? j : i;
          for (let axis = 0; axis < 3; axis++) edgePositions[edge * 6 + end * 3 + axis] = points[node * 3 + axis];
          edgeColors[edge * 6 + end * 3] = baseColor.r * strength;
          edgeColors[edge * 6 + end * 3 + 1] = baseColor.g * strength;
          edgeColors[edge * 6 + end * 3 + 2] = baseColor.b * strength;
        }
        neighbours++;
        edge++;
      }
    }
    linesGeometry.setDrawRange(0, edge * 2);
    linesGeometry.attributes.position.needsUpdate = true;
    linesGeometry.attributes.color.needsUpdate = true;
    group.rotation.set(0.25 + Math.sin(elapsed * 0.06) * 0.18, elapsed * 0.035, Math.sin(elapsed * 0.04) * 0.12);
    renderer.render(scene, camera);
  }
  function tick(now) {
    if (!motion || document.hidden || !available) { frame = 0; last = 0; return; }
    frame = requestAnimationFrame(tick);
    if (last && now - last < 1000 / 30) return;
    if (last) elapsed += Math.min((now - last) / 1000, 0.1);
    last = now;
    render();
  }
  refresh = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (!available || document.hidden) return;
    render();
    if (motion) frame = requestAnimationFrame(tick);
  };
  function resize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.position.z = camera.aspect < 0.8 ? 10 : 7.5;
    camera.updateProjectionMatrix();
    refresh();
  }
  function theme() {
    const dark = root.dataset.theme === 'dark';
    baseColor.set(dark ? 0x39d460 : 0x1a7a2e);
    pointMaterial.color.copy(baseColor);
    lineMaterial.opacity = dark ? 0.3 : 0.21;
    pointMaterial.opacity = dark ? 0.48 : 0.33;
    refresh();
  }
  const observer = new MutationObserver(theme);
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', refresh);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    available = false;
    cancelAnimationFrame(frame);
    canvas.style.visibility = 'hidden';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    available = true;
    canvas.style.visibility = '';
    resize();
  });
  theme();
  resize();
}
startNetwork().catch(() => {
  if (canvas) canvas.hidden = true;
  // The page, motion control and CSS cursor continue working without WebGL/CDN.
});
