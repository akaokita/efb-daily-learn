(() => {
  const IMG_W = 1800;
  const state = {
    data: null,
    phaseIdx: 0,
    stepIdx: 0,
    done: new Set(),
    scale: 1,
    tx: 0,
    ty: 0,
    imgH: 1,
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

  function applyTransform() {
    world.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
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
    // prefer readable zoom on mobile
    const targetScale = Math.min(2.6, Math.max(state.scale, Math.min(vw / (h.w * IMG_W * 4.5), vh / (h.h * state.imgH * 5.5), 2.4)));
    state.scale = soft ? state.scale : targetScale;
    state.tx = vw / 2 - cx * state.scale;
    state.ty = vh * 0.38 - cy * state.scale;
    clampPan();
    applyTransform();
  }

  function renderHotspots() {
    const { step } = current();
    const map = new Map(state.data.hotspots.map((h) => [h.id, h]));
    layer.innerHTML = "";
    layer.style.width = IMG_W + "px";
    layer.style.height = state.imgH + "px";
    for (const h of state.data.hotspots) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "hotspot";
      el.dataset.id = h.id;
      el.setAttribute("aria-label", h.label);
      el.style.left = h.x * IMG_W + "px";
      el.style.top = h.y * state.imgH + "px";
      el.style.width = h.w * IMG_W + "px";
      el.style.height = h.h * state.imgH + "px";
      if (state.done.has(h.id)) el.classList.add("done");
      if (step && step.hotspot === h.id) el.classList.add("current");
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onHotspotTap(h.id, el);
      });
      layer.appendChild(el);
    }
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
    $("coach-hint").textContent = "提示：" + (step.hint || "点按高亮区域");
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
    if (focus !== false) focusHotspot(h);
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
    if (id === step.hotspot) {
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
    viewport.setPointerCapture(e.pointerId);
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
      state.scale = Math.min(3.2, Math.max(0.35, state.scale * factor));
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
    state.scale = Math.min(3.2, Math.max(0.35, state.scale * factor));
    state.tx = mx - wx * state.scale;
    state.ty = my - wy * state.scale;
    clampPan();
    applyTransform();
  }, { passive: false });

  $("zoom-in").onclick = () => { state.scale = Math.min(3.2, state.scale * 1.2); clampPan(); applyTransform(); };
  $("zoom-out").onclick = () => { state.scale = Math.max(0.35, state.scale / 1.2); clampPan(); applyTransform(); };
  $("zoom-reset").onclick = () => { fit(); const { step } = current(); focusHotspot(state.data.hotspots.find(h => h.id === step.hotspot)); };
  $("focus-target").onclick = () => { const { step } = current(); focusHotspot(state.data.hotspots.find(h => h.id === step.hotspot)); };
  $("btn-prev").onclick = goPrev;
  $("btn-skip").onclick = skip;
  $("btn-next-phase").onclick = nextPhase;
  $("btn-phases").onclick = () => { $("phase-drawer").hidden = false; };
  $("drawer-close").onclick = () => { $("phase-drawer").hidden = true; };
  $("phase-drawer").addEventListener("click", (e) => { if (e.target.id === "phase-drawer") $("phase-drawer").hidden = true; });

  function fit() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    state.scale = Math.min(vw / IMG_W, vh / state.imgH) * 0.98;
    state.tx = (vw - IMG_W * state.scale) / 2;
    state.ty = 0;
    applyTransform();
  }

  async function boot() {
    const res = await fetch("./data/sop-flow.json?v=10");
    state.data = await res.json();
    const dataUrl = window.COCKPIT_IMAGE_DATA_URL;
    const assetUrl = (state.data.image || "./assets/cockpit-company.jpg") + "?v=10";
    img.src = dataUrl || assetUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => {
        if (dataUrl && !String(img.src || "").startsWith("data:")) { img.src = dataUrl; return; }
        if (!dataUrl && img.src !== assetUrl) { img.src = assetUrl; return; }
        reject(new Error("cockpit image failed"));
      };
    });
    state.imgH = img.naturalHeight;
    img.style.width = IMG_W + "px";
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
    navigator.serviceWorker.register("./sw.js?v=10").catch(() => {});
  }
})();
