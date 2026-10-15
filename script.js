(() => {
  const TOTAL_FRAMES = 300;
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d');

  const frames = new Array(TOTAL_FRAMES).fill(null);
  const loaded = new Array(TOTAL_FRAMES).fill(false);

  let currentProgress = 0;
  let targetProgress = 0;
  let lastDrawnIndex = -1;
  let initialized = false;

  function getFrameSrc(index) {
    const num = String(index + 1).padStart(3, '0');
    return `ezgif-frame-${num}.jpg`;
  }

  // High-performance image loader using off-thread createImageBitmap
  async function loadFrame(index) {
    if (loaded[index]) return frames[index];

    if (window.createImageBitmap) {
      try {
        const res = await fetch(getFrameSrc(index));
        if (res.ok) {
          const blob = await res.blob();
          const bmp = await createImageBitmap(blob);
          frames[index] = bmp;
          loaded[index] = true;
          if (lastDrawnIndex === -1 && index === 0) {
            renderFrame(0);
          }
          return bmp;
        }
      } catch (err) {
        // Fall back to Image
      }
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.src = getFrameSrc(index);
      img.onload = () => {
        frames[index] = img;
        loaded[index] = true;
        if (lastDrawnIndex === -1 && index === 0) {
          renderFrame(0);
        }
        resolve(img);
      };
      img.onerror = () => resolve(null);
    });
  }

  // Preloading strategy:
  // 1. Immediately load frame 0
  // 2. Rapidly load anchor keyframes (every 10th frame)
  // 3. Concurrently load all remaining frames
  async function preloadAll() {
    // 1. Frame 0
    await loadFrame(0);

    // 2. Anchor frames
    const anchors = [];
    for (let i = 10; i < TOTAL_FRAMES; i += 10) {
      anchors.push(i);
    }
    if (!anchors.includes(TOTAL_FRAMES - 1)) {
      anchors.push(TOTAL_FRAMES - 1);
    }
    await Promise.all(anchors.map(loadFrame));

    // 3. Concurrently load the rest
    const remaining = [];
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      if (!loaded[i]) remaining.push(i);
    }

    const concurrency = 8;
    let poolIndex = 0;

    async function worker() {
      while (poolIndex < remaining.length) {
        const frameIndex = remaining[poolIndex++];
        await loadFrame(frameIndex);
      }
    }

    const pool = [];
    for (let c = 0; c < concurrency; c++) {
      pool.push(worker());
    }
    await Promise.all(pool);
  }

  // Find closest available frame to prevent any blank screen during fast scrub
  function getClosestLoadedFrame(targetIndex) {
    if (loaded[targetIndex]) return { frame: frames[targetIndex], index: targetIndex };
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = targetIndex - offset;
      if (prev >= 0 && loaded[prev]) return { frame: frames[prev], index: prev };
      const next = targetIndex + offset;
      if (next < TOTAL_FRAMES && loaded[next]) return { frame: frames[next], index: next };
    }
    return null;
  }

  // Render frame maintaining exact proportions and covering the viewport
  function renderFrame(targetIndex) {
    const item = getClosestLoadedFrame(targetIndex);
    if (!item || !item.frame) return;

    const img = item.frame;
    const w = canvas.width;
    const h = canvas.height;
    const nw = img.width || 1280;
    const nh = img.height || 720;

    // Proportional cover without distortion
    const scale = Math.max(w / nw, h / nh);
    const drawW = Math.round(nw * scale);
    const drawH = Math.round(nh * scale);
    const offsetX = Math.round((w - drawW) / 2);
    const offsetY = Math.round((h - drawH) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    lastDrawnIndex = item.index;
  }

  // Update canvas dimensions based on screen resolution and device pixel ratio
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    if (lastDrawnIndex >= 0) {
      renderFrame(lastDrawnIndex);
    } else {
      renderFrame(0);
    }
  }

  // Smooth LERP animation loop synchronized with document scroll
  function tick() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    targetProgress = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;

    // Linear interpolation damping
    const diff = targetProgress - currentProgress;
    if (Math.abs(diff) > 0.00005) {
      currentProgress += diff * 0.085;
    } else {
      currentProgress = targetProgress;
    }

    const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1))));
    if (frameIndex !== lastDrawnIndex || lastDrawnIndex === -1) {
      renderFrame(frameIndex);
    }

    requestAnimationFrame(tick);
  }

  // Accordion drawer handler
  function setupAccordions() {
    const accordions = [
      { toggleId: 'toggle-honours', panelId: 'panel-honours' },
      { toggleId: 'toggle-projects', panelId: 'panel-projects' },
      { toggleId: 'toggle-experience', panelId: 'panel-experience' },
      { toggleId: 'toggle-conferences', panelId: 'panel-conferences' }
    ];

    accordions.forEach(({ toggleId, panelId }) => {
      const toggle = document.getElementById(toggleId);
      const panel = document.getElementById(panelId);
      if (toggle && panel) {
        toggle.addEventListener('click', () => {
          const isOpen = panel.classList.contains('open');
          panel.classList.toggle('open');
          toggle.classList.toggle('active');
          const icon = toggle.querySelector('.toggle-icon');
          if (icon) {
            icon.textContent = isOpen ? '+' : '×';
          }
        });
      }
    });
  }

  // Navigation, Navbar State & Interactive Features
  function setupNavigation() {
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section');
    const mobileToggle = document.getElementById('mobile-toggle');
    const navMenu = document.querySelector('.nav-menu');

    // Sticky navbar backdrop on scroll
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, { passive: true });

    // Mobile menu toggle
    if (mobileToggle && navMenu) {
      mobileToggle.addEventListener('click', () => {
        navMenu.classList.toggle('mobile-open');
      });
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          navMenu.classList.remove('mobile-open');
        });
      });
    }

    // Scroll spy for active nav link
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, { rootMargin: '-25% 0px -65% 0px' });

    sections.forEach(sec => observer.observe(sec));
  }

  function init() {
    if (initialized) return;
    initialized = true;
    resizeCanvas();
    preloadAll();
    setupAccordions();
    setupNavigation();
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resizeCanvas);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
