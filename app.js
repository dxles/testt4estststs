/* dxles.eu — vanilla JS, no build step.
   GSAP + ScrollTrigger are loaded globally in index.html.
   three.js is dynamically imported as an ES module from CDN inside initSphere()
   so a failed/slow CDN never breaks the rest of the site. */

/* ================================ CONFIG ================================ */
const CONFIG = {
  isMobile: matchMedia('(max-width: 800px)').matches,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  fine: matchMedia('(pointer: fine)').matches,
};

/* ================================== DOM =================================== */
const DOM = {
  loader: document.getElementById('loader'),
  loaderBar: document.querySelector('.loader-bar-fill'),
  canvas: document.getElementById('webgl'),
  nav: document.getElementById('nav'),
  cursorRing: document.querySelector('.cursor-ring'),
  cursorDot: document.querySelector('.cursor-dot'),
  progressFill: document.querySelector('.progress-fill'),
  progressIdx: document.querySelectorAll('.progress-index'),
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ================================= LOADER ================================== */
function initLoader() {
  if (!DOM.loader) return;
  if (CONFIG.reduced || !window.gsap) { DOM.loader.style.display = 'none'; return; }
  gsap.timeline({ defaults: { ease: 'power4.inOut' } })
    .to(DOM.loaderBar, { width: '100%', duration: 1.0 })
    .to(DOM.loader, { yPercent: -100, duration: 0.85 }, '-=0.1')
    .set(DOM.loader, { display: 'none' });
}

/* ================================= CURSOR =================================== */
function initCursor() {
  if (!CONFIG.fine || CONFIG.reduced || !DOM.cursorRing) return;
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;

  addEventListener('mousemove', (e) => {
    x = e.clientX; y = e.clientY;
    DOM.cursorDot.style.transform = `translate3d(${x}px,${y}px,0)`;
  });

  (function loop() {
    rx += (x - rx) * 0.16;
    ry += (y - ry) * 0.16;
    DOM.cursorRing.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    requestAnimationFrame(loop);
  })();

  document.querySelectorAll('a, button, .project').forEach((el) => {
    el.addEventListener('mouseenter', () => DOM.cursorRing.classList.add('is-hover'));
    el.addEventListener('mouseleave', () => DOM.cursorRing.classList.remove('is-hover'));
  });
}

/* ============================ NAV SMOOTH SCROLL ============================
   Replaces the removed CSS `scroll-behavior:smooth` (which fought
   ScrollTrigger's continuous scrub math on every wheel event). This only
   fires on discrete nav-link clicks, so it doesn't conflict with pinning. */
function initNavSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = id ? document.getElementById(id) : document.body;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ============================ MAGNETIC INTERACTIONS ============================ */
function initMagneticElements() {
  if (!CONFIG.fine || CONFIG.reduced || !window.gsap) return;
  document.querySelectorAll('.magnetic').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const mx = clamp((e.clientX - r.left - r.width / 2) * 0.3, -10, 10);
      const my = clamp((e.clientY - r.top - r.height / 2) * 0.3, -10, 10);
      gsap.to(el, { x: mx, y: my, duration: 0.4, ease: 'power3.out' });
    });
    el.addEventListener('mouseleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,0.4)' });
    });
  });
}

/* =========================== THREE.JS SPHERE (GLOBAL) ===========================
   One wireframe sphere + particle shell, fixed behind everything.
   Its Y rotation is bound to GLOBAL page scroll progress: at the absolute
   bottom of the page it has completed exactly one full 360° turn. */
async function initSphere() {
  if (!DOM.canvas || !window.WebGLRenderingContext) return;
  let THREE;
  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js');
  } catch (err) {
    console.warn('[dxles] three.js CDN failed, trying local vendor copy.', err);
    try {
      THREE = await import('./vendor/three.module.js');
    } catch (err2) {
      console.warn('[dxles] three.js could not be loaded, hiding WebGL layer.', err2);
      DOM.canvas.remove();
      return;
    }
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
  camera.position.z = 9;

  const renderer = new THREE.WebGLRenderer({ canvas: DOM.canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const setPR = () => renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.isMobile ? 1.3 : 1.7));
  setPR();
  renderer.setSize(innerWidth, innerHeight);

  const group = new THREE.Group();
  group.position.x = CONFIG.isMobile ? 0 : 1.4;
  scene.add(group);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.1, CONFIG.isMobile ? 1 : 2),
    new THREE.MeshBasicMaterial({ color: 0xd8ff3e, wireframe: true, transparent: true, opacity: 0.14 })
  );
  group.add(wire);

  const count = CONFIG.isMobile ? 420 : 1100;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 2.3 + Math.random() * 2.4;
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(b) * Math.cos(a);
    positions[i * 3 + 1] = r * Math.cos(b);
    positions[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
  }
  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(pointsGeo, new THREE.PointsMaterial({
    color: 0xd8ff3e, size: 0.014, transparent: true, opacity: 0.45,
  }));
  group.add(points);

  // Scroll-driven rotation target: 0 → 2π across the whole page.
  let targetRot = 0, rot = 0;
  if (!CONFIG.reduced && window.gsap && window.ScrollTrigger) {
    ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => { targetRot = self.progress * Math.PI * 2; },
    });
  }

  // Subtle mouse parallax on desktop.
  let mx = 0, my = 0, tx = 0, ty = 0;
  if (CONFIG.fine && !CONFIG.reduced) {
    addEventListener('mousemove', (e) => {
      tx = (e.clientX / innerWidth - 0.5) * 0.6;
      ty = (e.clientY / innerHeight - 0.5) * 0.4;
    });
  }

  const animate = () => {
    // Critically-damped chase; converges exactly to the scroll target at rest.
    rot += (targetRot - rot) * 0.12;
    mx += (tx - mx) * 0.04;
    my += (ty - my) * 0.04;

    group.rotation.y = rot;
    group.rotation.x = my * 0.3;
    group.position.y = -my * 0.4;
    group.position.x = (CONFIG.isMobile ? 0 : 1.4) + mx * 0.5;
    points.rotation.y = -rot * 0.35;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  if (CONFIG.reduced) {
    renderer.render(scene, camera); // single static frame
  } else {
    animate();
  }

  addEventListener('resize', debounce(() => {
    CONFIG.isMobile = matchMedia('(max-width: 800px)').matches;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    setPR();
    renderer.setSize(innerWidth, innerHeight);
    if (CONFIG.reduced) renderer.render(scene, camera);
  }, 150));
}

/* ============================ SCROLL CHOREOGRAPHY ============================
   The 13-step pinned sequence. Runs the same for every visitor, phone or
   desktop, regardless of the OS-level "reduce motion" flag — prefers-reduced-
   motion still trims the loader intro, custom cursor and WebGL sphere loop
   above (and the CSS fallback still applies for anyone whose browser blocks
   JS animation entirely), but the core scroll story always plays. */
function initScrollChoreography() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Nav state + progress rail (motion-independent, safe for everyone)
  ScrollTrigger.create({
    start: 'top -80', end: 99999,
    onUpdate: (self) => DOM.nav && DOM.nav.classList.toggle('is-scrolled', self.scroll() > 80),
  });
  if (DOM.progressFill) {
    gsap.to(DOM.progressFill, {
      height: '100%', ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true },
    });
  }
  ['work', 'systems', 'about', 'lab', 'contact'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el, start: 'top center', end: 'bottom center',
      onEnter: () => setActiveIndex(i), onEnterBack: () => setActiveIndex(i),
    });
  });

  /* ---------- STEP 1 · HERO: "dxles" bleeds off-screen, scales into place ---------- */
  const heroName = document.getElementById('hero-name');
  gsap.timeline({
    scrollTrigger: { trigger: '#hero', start: 'top top', end: '+=130%', scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true },
  })
    .fromTo(heroName,
      { scale: () => (CONFIG.isMobile ? 3.6 : 6), yPercent: 10 },
      { scale: 1, yPercent: 0, ease: 'power2.inOut', duration: 1 })
    .fromTo('.hero-top, .hero-bottom',
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, '-=0.35')
    .to({}, { duration: 0.5 }); // hold the settled hero before handing off to Works

  /* ---------- STEPS 2–4 · WORKS: pinned slide-in from left, previous blurs ---------- */
  const projects = gsap.utils.toArray('.project');
  if (projects.length) {
    const workTl = gsap.timeline({
      scrollTrigger: {
        trigger: '#work', start: 'top top',
        end: `+=${projects.length * 95 + 60}%`, scrub: 1, pin: true,
        anticipatePin: 1, invalidateOnRefresh: true,
      },
    });
    workTl.fromTo('#work .section-head', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5 }, 0);
    projects.forEach((item, i) => {
      const at = i * 1.1 + 0.4;
      workTl.fromTo(item,
        { x: () => -innerWidth * 0.75, opacity: 0 },
        { x: 0, opacity: 1, duration: 1, ease: 'power3.out' }, at);
      if (i > 0) {
        workTl.to(projects[i - 1], { filter: 'blur(9px)', opacity: 0.28, duration: 0.8, ease: 'power2.out' }, at);
      }
    });
    // All works displayed together in full clarity before the Toolkit.
    workTl.to(projects, { filter: 'blur(0px)', opacity: 1, duration: 0.8, ease: 'power2.out' }, projects.length * 1.1 + 0.5);
  }

  /* ---------- STEPS 5–8 · TOOLKIT: pinned focus rotation (Languages → Systems → Interests) ---------- */
  const cols = gsap.utils.toArray('.systems-col');
  if (cols.length) {
    gsap.set(cols, { filter: 'blur(14px)', opacity: 0.18 });
    const sysTl = gsap.timeline({
      scrollTrigger: { trigger: '#systems', start: 'top top', end: '+=340%', scrub: 1, pin: true, anticipatePin: 1 },
    });
    sysTl.fromTo('#systems .section-head', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5 }, 0);
    cols.forEach((col, i) => {
      const focusAt = i * 1.25 + 0.5;
      sysTl.to(col, { filter: 'blur(0px)', opacity: 1, duration: 0.9, ease: 'power2.out' }, focusAt);
      sysTl.to(col, { filter: 'blur(14px)', opacity: 0.18, duration: 0.9, ease: 'power2.in' }, focusAt + 1.0);
    });
  }

  /* ---------- STEPS 9–11 · ABOUT: pinned sequential bio reveal, all visible at end ---------- */
  const blocks = gsap.utils.toArray('.about-block');
  if (blocks.length) {
    gsap.set(blocks, { opacity: 0, y: 42 });
    const aboutTl = gsap.timeline({
      scrollTrigger: { trigger: '#about', start: 'top top', end: '+=280%', scrub: 1, pin: true, anticipatePin: 1 },
    });
    aboutTl.fromTo('#about .section-head', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5 }, 0);
    blocks.forEach((b, i) => {
      aboutTl.to(b, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }, i * 0.95 + 0.4);
    });
  }

  /* ---------- STEP 12 · LAB: synchronized zoom-in, capped at scale 1 ---------- */
  const labItems = gsap.utils.toArray('.lab-item');
  if (labItems.length) {
    gsap.fromTo(labItems,
      { scale: 0.84, opacity: 0.25 },
      {
        scale: 1, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: '.lab-list', start: 'top 88%', end: 'top 34%', scrub: true },
      });
  }

  /* ---------- STEP 13 · CONTACT: gentle settle-in ---------- */
  gsap.fromTo('.contact-title, .contact-email, .contact-links',
    { opacity: 0, y: 30 },
    {
      opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: '#contact', start: 'top 78%', toggleActions: 'play none none reverse' },
    });

  requestAnimationFrame(() => ScrollTrigger.refresh());
}

function setActiveIndex(i) {
  DOM.progressIdx.forEach((el) => el.classList.toggle('is-active', Number(el.dataset.index) === i));
}

/* ==================================== INIT ==================================== */
// CDN is primary (per project rules); if jsdelivr is unreachable we fall back
// to the local vendor/ copies so animations never silently die.
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function boot() {
  try {
    if (!window.gsap) await loadScript('vendor/gsap.min.js');
    if (!window.ScrollTrigger) await loadScript('vendor/ScrollTrigger.min.js');
  } catch (err) {
    console.warn('[dxles] GSAP unavailable — serving static, fully readable page.', err);
  }
  // Even without GSAP the page stays readable: hidden/blurred states are only
  // applied inside the animation functions, which guard on window.gsap.
  initLoader();
  initCursor();
  initNavSmoothScroll();
  initMagneticElements();
  initSphere();

  // ScrollTrigger computes every pin's start/end (and the spacer height that
  // reserves scroll distance for it) from the page's layout AT THE MOMENT
  // pin:true is set up. If web fonts (Instrument Serif etc.) haven't swapped
  // in yet, those measurements are taken against fallback-font heights and
  // end up wrong — which is exactly what lets two consecutive pinned
  // sections (e.g. Work → Toolkit) briefly both be "pinned" at once: the
  // later one in the DOM paints on top, and the page keeps visibly
  // scrolling instead of holding still during the pin. Wait for fonts AND
  // full page load before creating any pin, so the very first measurement
  // is already correct — no later correction/jump needed.
  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  const windowLoaded = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((resolve) => addEventListener('load', resolve, { once: true }));
  await Promise.all([fontsReady, windowLoaded]);

  initScrollChoreography();
}

boot();

addEventListener('resize', debounce(() => {
  CONFIG.isMobile = matchMedia('(max-width: 800px)').matches;
}, 150));
