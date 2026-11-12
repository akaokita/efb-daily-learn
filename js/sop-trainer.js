(() => {
  let IMG_W = 7812;
  const state = {
    data: null,
    phaseIdx: 0,
    stepIdx: 0,
    done: new Set(),
    scale: 1,
    tx: 0,
    ty: 0,
    imgH: 14431,
  };

  const $ = (id) => document.getElementById(id);
  const viewport = $("viewport");
  const world = $("world");
  const img = $("cockpit");
  const layer = $("hotspot-layer");
  const toastEl = $("toast");

  function roleLabel(r) {
    return ({ CA: "机长", FO: "副驾", BOTH: "机长/副驾", PF: "PF", PM: "PM" }[r] || r);
  }

  function showToast(msg, kind) {
    toastEl.hidden = false;
    toastEl.textContent = msg;
    toastEl.className = "toast" + (kind ? " " + kind : "");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toastEl.hidden = true; }, 1600);
  }

  function totalSteps() {
    return state.data.phases.reduce((n, p) => n + p.steps.length, 0);
  }

  function globalIndex() {
    let n = 0;
    for (let i = 0; i < state.phaseIdx; i++) n += state.data.phases[i].steps.length;
    return n + state.stepIdx;
  }

  function current() {
    const phase = state.data.phases[state.phaseIdx];
    const step = phase.steps[state.stepIdx];
    return { phase, step };
  }

  function fitScale() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    return Math.min(vw / IMG_W, vh / state.imgH) * 0.98;
  }

  function clampScale(s) {
    return Math.min(2.5, Math.max(fitScale(), s));
  }

  function applyTransform(immediate) {
    // Size the world in display pixels (scale=1 means 1 CSS px = 1 original px).
    // Do not CSS-scale the bitmap layer — Safari would upsample a low-res raster.
    world.style.transform = `translate(${state.tx}px, ${state.ty}px)`;
    world.style.width = (IMG_W * state.scale) + "px";
    world.style.height = (state.imgH * state.scale) + "px";
    world.style.setProperty("--px", "1px");
    sizeRing();
    if (immediate) {
      clearTimeout(tileTimer);
      updateTiles();
    } else {
      scheduleTiles();
    }
  }

  // ---- tiled hi-res rendering (overview always, tiles lazily) ----
  const tileLayer = $("tile-layer");
  let META = null;
  const tileEls = new Map();   // key -> img
  const pending = new Map();   // key -> true while loading
  const tileData = new Map();  // key -> dataURL (small LRU)
  window.__tileCb = (key, url) => {
    tileData.set(key, url);
    if (tileData.size > 60) tileData.delete(tileData.keys().next().value);
    pending.delete(key);
    const s = document.querySelector(`script[data-tile="${key}"]`); if (s) s.remove();
    scheduleTiles();
  };
  let tileTimer = 0;
  function scheduleTiles() { if (!META) return; clearTimeout(tileTimer); tileTimer = setTimeout(updateTiles, 120); }
  function pickLevel() {
    // scale=1 is 1 CSS px per original pixel, so this is device px per source px
    const dpp = state.scale * (window.devicePixelRatio || 1);
    const ovRatio = (img.naturalWidth || 2400) / IMG_W;
    if (dpp <= ovRatio * 1.15) return null;
    if (dpp > 0.9) return META.levels[1];
    return META.levels[0];
  }
  function updateTiles() {
    if (!META) return;
    const lv = pickLevel();
    const want = new Set();
    if (lv) {
      const k = (IMG_W * state.scale) / lv.w; // CSS px per level pixel
      const T = META.tile * k;
      const vw = viewport.clientWidth, vh = viewport.clientHeight;
      const x0 = -state.tx, y0 = -state.ty;
      const x1 = x0 + vw, y1 = y0 + vh;
      const c0 = Math.max(0, Math.floor(x0 / T)), c1 = Math.min(lv.cols - 1, Math.floor(x1 / T));
      const r0 = Math.max(0, Math.floor(y0 / T)), r1 = Math.min(lv.rows - 1, Math.floor(y1 / T));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const key = `${lv.z}_${c}_${r}`; want.add(key);
        if (tileEls.has(key)) continue;
        if (tileData.has(key)) {
          const t = document.createElement("img");
          t.alt = ""; t.draggable = false; t.decoding = "async";
          const tw = Math.min(META.tile, lv.w - c * META.tile);
          const th = Math.min(META.tile, lv.h - r * META.tile);
          // percent of the sized world so tiles follow width/height changes
          t.style.left = (c * META.tile / lv.w * 100) + "%";
          t.style.top = (r * META.tile / lv.h * 100) + "%";
          t.style.width = (tw / lv.w * 100) + "%";
          t.style.height = (th / lv.h * 100) + "%";
          t.src = tileData.get(key);
          tileEls.set(key, t); tileLayer.appendChild(t);
        } else if (!pending.has(key) && pending.size < 8) {
          pending.set(key, true);
          const s = document.createElement("script");
          s.dataset.tile = key; s.async = true;
          s.src = `./js/tiles/t${key}.js?v=13`;
          s.onerror = () => { pending.delete(key); s.remove(); };
          document.head.appendChild(s);
        }
      }
    }
    // drop tiles no longer needed (keeps decoded memory small on iOS); keep while new ones still loading
    const loadingWanted = [...want].some((k) => !tileEls.has(k));
    for (const [key, el] of tileEls) {
      if (want.has(key)) continue;
      if (loadingWanted && lv && key.startsWith(lv.z === 2 ? "1_" : "2_")) continue;
      el.remove(); tileEls.delete(key);
    }
    if (pending.size || loadingWanted) scheduleTiles();
  }

  function clampPan() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const w = IMG_W * state.scale;
    const h = state.imgH * state.scale;
    // allow some margin
    const minX = Math.min(0, vw - w);
    const minY = Math.min(0, vh - h);
    const maxX = Math.max(0, vw - w) === 0 ? 0 : 0;
    // if image smaller than viewport, center
    if (w <= vw) state.tx = (vw - w) / 2;
    else state.tx = Math.min(0, Math.max(minX, state.tx));
    if (h <= vh) state.ty = (vh - h) / 2;
    else state.ty = Math.min(0, Math.max(minY, state.ty));
  }

  function focusHotspot(h, soft) {
    if (!h) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const cx = (h.x + h.w / 2) * IMG_W;
    const cy = (h.y + h.h / 2) * state.imgH;
    // Fill ~28% of the viewport using the hotspot's smaller side so a tall
    // box (e.g. battery ~80px wide) still lands slightly above 1:1 (~1.2–1.4).
    const pw = h.w * IMG_W, ph = h.h * state.imgH;
    const raw = (pw <= ph) ? (vw * 0.28 / pw) : (vh * 0.28 / ph);
    const targetScale = Math.min(2.0, Math.max(fitScale(), raw));
    state.scale = soft ? state.scale : targetScale;
    state.tx = vw / 2 - cx * state.scale;
    state.ty = vh * 0.38 - cy * state.scale;
    clampPan();
    applyTransform(true); // prefetch tiles immediately
  }

  function renderHotspots() {
    const { step } = current();
    const map = new Map(state.data.hotspots.map((h) => [h.id, h]));
    layer.innerHTML = "";
    layer.style.width = "100%";
    layer.style.height = "100%";
    for (const h of state.data.hotspots) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "hotspot";
      el.dataset.id = h.id;
      el.setAttribute("aria-label", h.label);
      el.style.left = (h.x * 100) + "%";
      el.style.top = (h.y * 100) + "%";
      el.style.width = (h.w * 100) + "%";
      el.style.height = (h.h * 100) + "%";
      if (state.done.has(h.id)) el.classList.add("done");
      if (step && step.hotspot === h.id && !step.manual) el.classList.add("current");
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onHotspotTap(h.id, el);
      });
      layer.appendChild(el);
    }
    placeRing(step);
  }

  let ringEl = null, ringH = null;
  function sizeRing() {
    if (!ringEl || !ringH) return;
    const w = ringH.w * IMG_W * state.scale;
    const h = ringH.h * state.imgH * state.scale;
    const d = Math.max(Math.hypot(w, h) * 1.12 + 14, 40);
    ringEl.style.width = ringEl.style.height = d + "px";
  }
  function placeRing(step) {
    ringH = step && !step.manual ? state.data.hotspots.find((x) => x.id === step.hotspot) : null;
    if (!ringH) { if (ringEl) ringEl.remove(); ringEl = null; return; }
    ringEl = document.createElement("div");
    ringEl.className = "target-ring";
    ringEl.style.left = ((ringH.x + ringH.w / 2) * 100) + "%";
    ringEl.style.top = ((ringH.y + ringH.h / 2) * 100) + "%";
    layer.appendChild(ringEl);
    sizeRing();
  }

  function renderCoach() {
    const { phase, step } = current();
    $("phase-title").textContent = `${phase.title}（${phase.sop}）`;
    $("sop-ref").textContent = "SOP " + (step.sopRef || phase.sop);
    $("step-count").textContent = `${state.stepIdx + 1}/${phase.steps.length}`;
    $("step-meta").textContent = `总进度 ${globalIndex() + 1}/${totalSteps()}`;
    $("role-badge").textContent = roleLabel(step.role);
    $("coach-action").textContent = step.action;
    $("coach-why").textContent = step.why || phase.blurb || "";
    $("coach-hint").textContent = "提示：" + (step.hint || "点按高亮区域") + (step.manual ? "（此步无对应电门，完成后点「我已完成」）" : "");
    const nb = $("btn-next");
    const last = state.phaseIdx === state.data.phases.length - 1 && state.stepIdx === phase.steps.length - 1;
    nb.textContent = step.manual ? "我已完成" : (state.stepIdx === phase.steps.length - 1 ? (last ? "完成" : "下一阶段") : "下一步");
    nb.classList.toggle("pulse", !!step.manual);
    const pct = ((globalIndex()) / Math.max(1, totalSteps() - 1)) * 100;
    $("progress-fill").style.width = pct + "%";
    // phase list active
    [...document.querySelectorAll("#phase-list li")].forEach((li, i) => {
      li.classList.toggle("active", i === state.phaseIdx);
    });
  }

  function renderAll(focus) {
    renderHotspots();
    renderCoach();
    const { step } = current();
    const h = state.data.hotspots.find((x) => x.id === step.hotspot);
    if (focus !== false && !step.manual) focusHotspot(h);
    else if (focus !== false) { clampPan(); applyTransform(true); }
  }

  function advance() {
    const phase = state.data.phases[state.phaseIdx];
    state.done.add(phase.steps[state.stepIdx].hotspot);
    if (state.stepIdx < phase.steps.length - 1) {
      state.stepIdx += 1;
      renderAll(true);
      return;
    }
    if (state.phaseIdx < state.data.phases.length - 1) {
      showToast("本阶段完成，进入下一阶段", "good");
      state.phaseIdx += 1;
      state.stepIdx = 0;
      renderAll(true);
      return;
    }
    showToast("全部阶段已学完，请结合现行手册复习", "good");
    renderAll(false);
  }

  function onHotspotTap(id, el) {
    const { step } = current();
    if (!step) return;
    if (id === step.hotspot && !step.manual) {
      advance();
      return;
    }
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    showToast("不是当前步骤，请看黄色高亮与提示", "bad");
  }

  function goPrev() {
    if (state.stepIdx > 0) state.stepIdx -= 1;
    else if (state.phaseIdx > 0) {
      state.phaseIdx -= 1;
      state.stepIdx = state.data.phases[state.phaseIdx].steps.length - 1;
    }
    renderAll(true);
  }

  function skip() {
    advance();
  }

  function nextPhase() {
    if (state.phaseIdx < state.data.phases.length - 1) {
      state.phaseIdx += 1;
      state.stepIdx = 0;
      renderAll(true);
    } else showToast("已经是最后阶段", "bad");
  }

  function buildPhaseList() {
    const ol = $("phase-list");
    ol.innerHTML = "";
    state.data.phases.forEach((p, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<button type="button"><div class="p-title">${i + 1}. ${p.title}</div><div class="p-meta">SOP ${p.sop} · ${p.steps.length} 步</div></button>`;
      li.querySelector("button").onclick = () => {
        state.phaseIdx = i;
        state.stepIdx = 0;
        $("phase-drawer").hidden = true;
        renderAll(true);
      };
      ol.appendChild(li);
    });
  }

  // pan / pinch
  const pointers = new Map();
  let lastDist = 0;
  let panX = 0, panY = 0, originTx = 0, originTy = 0;

  function dist() {
    const arr = [...pointers.values()];
    if (arr.length < 2) return 0;
    const [a, b] = arr;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  viewport.addEventListener("pointerdown", (e) => {
    // don't capture taps that start on a hotspot / button, otherwise the click is retargeted to the viewport
    if (!(e.target.closest && e.target.closest("button"))) { try { viewport.setPointerCapture(e.pointerId); } catch (_) {} }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    viewport.classList.add("dragging");
    if (pointers.size === 1) {
      panX = e.clientX; panY = e.clientY;
      originTx = state.tx; originTy = state.ty;
    } else if (pointers.size === 2) {
      lastDist = dist();
    }
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      const dx = e.clientX - panX;
      const dy = e.clientY - panY;
      state.tx = originTx + dx;
      state.ty = originTy + dy;
      clampPan();
      applyTransform();
    } else if (pointers.size === 2) {
      const d = dist();
      if (!lastDist) lastDist = d;
      const factor = d / lastDist;
      const rect = viewport.getBoundingClientRect();
      const arr = [...pointers.values()];
      const mx = (arr[0].x + arr[1].x) / 2 - rect.left;
      const my = (arr[0].y + arr[1].y) / 2 - rect.top;
      const wx = (mx - state.tx) / state.scale;
      const wy = (my - state.ty) / state.scale;
      state.scale = clampScale(state.scale * factor);
      state.tx = mx - wx * state.scale;
      state.ty = my - wy * state.scale;
      lastDist = d;
      clampPan();
      applyTransform();
    }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastDist = 0;
    if (pointers.size === 0) viewport.classList.remove("dragging");
    if (pointers.size === 1) {
      const only = [...pointers.values()][0];
      panX = only.x; panY = only.y;
      originTx = state.tx; originTy = state.ty;
    }
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - state.tx) / state.scale;
    const wy = (my - state.ty) / state.scale;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    state.scale = clampScale(state.scale * factor);
    state.tx = mx - wx * state.scale;
    state.ty = my - wy * state.scale;
    clampPan();
    applyTransform();
  }, { passive: false });

  $("zoom-in").onclick = () => { state.scale = clampScale(state.scale * 1.2); clampPan(); applyTransform(); };
  $("zoom-out").onclick = () => { state.scale = clampScale(state.scale / 1.2); clampPan(); applyTransform(); };
  $("zoom-reset").onclick = () => { fit(); const { step } = current(); focusHotspot(state.data.hotspots.find(h => h.id === step.hotspot)); };
  $("focus-target").onclick = () => { const { step } = current(); focusHotspot(state.data.hotspots.find(h => h.id === step.hotspot)); };
  $("btn-prev").onclick = goPrev;
  $("btn-skip").onclick = skip;
  $("btn-next").onclick = () => advance();
  $("btn-phases").onclick = () => { $("phase-drawer").hidden = false; };
  $("drawer-close").onclick = () => { $("phase-drawer").hidden = true; };
  $("phase-drawer").addEventListener("click", (e) => { if (e.target.id === "phase-drawer") $("phase-drawer").hidden = true; });

  function fit() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    state.scale = fitScale();
    state.tx = (vw - IMG_W * state.scale) / 2;
    state.ty = 0;
    applyTransform();
  }

  async function boot() {
    const [res, mres] = await Promise.all([fetch("./data/sop-flow.json?v=13"), fetch("./js/tiles/meta.json?v=13")]);
    state.data = await res.json();
    META = await mres.json();
    IMG_W = META.w;
    state.imgH = META.h;
    // safety net: any step without a valid hotspot becomes a manual "我已完成" step
    const ids = new Set(state.data.hotspots.map((h) => h.id));
    state.data.phases.forEach((p) => p.steps.forEach((s) => { if (!s.hotspot || !ids.has(s.hotspot)) s.manual = true; }));
    img.src = window.__COCKPIT_OVERVIEW || "./assets/cockpit-company-lite.jpg?v=13";
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error("cockpit image failed")); });
    img.style.width = "100%";
    img.style.height = "100%";
    tileLayer.style.width = "100%";
    tileLayer.style.height = "100%";
    buildPhaseList();
    fit();
    // restore
    try {
      const saved = JSON.parse(localStorage.getItem("sop-trainer-v1") || "null");
      if (saved && Number.isInteger(saved.phaseIdx)) {
        state.phaseIdx = Math.min(saved.phaseIdx, state.data.phases.length - 1);
        state.stepIdx = Math.min(saved.stepIdx || 0, state.data.phases[state.phaseIdx].steps.length - 1);
        state.done = new Set(saved.done || []);
      }
    } catch (_) {}
    renderAll(true);
    window.addEventListener("beforeunload", () => {
      localStorage.setItem("sop-trainer-v1", JSON.stringify({
        phaseIdx: state.phaseIdx,
        stepIdx: state.stepIdx,
        done: [...state.done],
      }));
    });
  }

  // persist periodically
  setInterval(() => {
    if (!state.data) return;
    localStorage.setItem("sop-trainer-v1", JSON.stringify({
      phaseIdx: state.phaseIdx,
      stepIdx: state.stepIdx,
      done: [...state.done],
    }));
  }, 4000);

  boot().catch((err) => {
    $("coach-action").textContent = "加载失败：" + err.message;
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js?v=13").catch(() => {});
  }
})();
