/* B737NG Cockpit procedure trainer — immersive + flat fallback */
(function () {
  const STORAGE = "efb-cockpit-progress-v1";
  const state = {
    data: null,
    mode: "home", // home | guide | explore
    scenarioId: null,
    stepIndex: 0,
    panel: "overhead",
    controlState: {},
    progress: loadProgress(),
    view: "immersive", // immersive | flat
    scene: null,
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) return { completed: {}, lastScenario: null };
      const p = JSON.parse(raw);
      return {
        completed: p.completed && typeof p.completed === "object" ? p.completed : {},
        lastScenario: p.lastScenario || null,
      };
    } catch {
      return { completed: {}, lastScenario: null };
    }
  }
  function saveProgress() {
    localStorage.setItem(STORAGE, JSON.stringify(state.progress));
  }

  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function controlById(id) {
    return (state.data.controls || []).find((c) => c.id === id);
  }
  function scenarioById(id) {
    return (state.data.scenarios || []).find((s) => s.id === id);
  }

  function setPanel(name) {
    state.panel = name;
    $all("#panel-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.panel === name));
    $all("[data-panel-view]").forEach((v) => v.classList.toggle("active", v.dataset.panelView === name));
  }

  function applyControlVisual(id, value) {
    if (value != null) state.controlState[id] = value;
    const el = $(`.hot[data-id="${id}"]`);
    if (!el) return;
    const valEl = $("[data-val]", el);
    const v = state.controlState[id];
    if (valEl && v != null) valEl.textContent = v;
    if (v === "ON" || v === "NAV" || v === "ARM" || v === "ARMED" || v === "IDLE" || v === "GRD" || v === "AUTO" || v === "亮" || v === "GUARDED" || v === "护盖") {
      el.classList.add("lit");
    }
    if (state.scene) state.scene.setLit(id, true);
  }

  function clearHighlights() {
    $all(".hot").forEach((el) => {
      el.classList.remove("target", "done-ok", "wrong-flash");
    });
  }

  function highlightTarget(id) {
    clearHighlights();
    const el = $(`.hot[data-id="${id}"]`);
    if (el) el.classList.add("target");
    const sc = scenarioById(state.scenarioId);
    const done = [];
    if (sc) {
      for (let i = 0; i < state.stepIndex; i++) {
        const t = sc.steps[i].target;
        done.push(t);
        const prev = $(`.hot[data-id="${t}"]`);
        if (prev && !prev.classList.contains("target")) prev.classList.add("done-ok");
      }
    }
    if (state.scene) {
      state.scene.setMode(state.mode === "explore" ? "explore" : "guide");
      state.scene.setDone(done);
      state.scene.setTarget(id);
    }
  }

  function showHome() {
    state.mode = "home";
    state.scenarioId = null;
    $("#view-home").classList.remove("hidden");
    $("#view-sim").classList.add("hidden");
    $("#view-sim").style.display = "none";
    $all("#mode-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === "home"));
    $("#hdr-title").textContent = "驾驶舱练习";
    renderScenarioList();
  }

  function renderScenarioList() {
    const box = $("#scenario-list");
    const completed = state.progress.completed || {};
    box.innerHTML = state.data.scenarios.map((s) => {
      const done = !!completed[s.id];
      return `<div class="card scenario-card" tabindex="0" data-sid="${escapeHtml(s.id)}">
        <h3>${escapeHtml(s.title)} ${done ? '<span style="color:#22c55e">✓</span>' : ""}</h3>
        <div class="meta">${escapeHtml(s.subtitle)}</div>
        <div class="meta" style="margin-top:6px"><span class="steps-n">${s.steps.length}</span> 步 · ${escapeHtml(s.fcom)}</div>
        <div class="btn-row" style="margin-top:10px">
          <button type="button" class="btn" data-start="${escapeHtml(s.id)}">开始引导</button>
        </div>
      </div>`;
    }).join("");
    $all("[data-start]", box).forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        startGuide(btn.dataset.start);
      };
    });
  }

  function enterSimChrome(title) {
    $("#view-home").classList.add("hidden");
    $("#view-sim").classList.remove("hidden");
    $("#view-sim").style.display = "flex";
    $("#hdr-title").textContent = title;
    // layout then mount / resize WebGL
    requestAnimationFrame(() => {
      ensureScene();
      requestAnimationFrame(() => ensureScene());
    });
  }

  function startGuide(scenarioId) {
    const sc = scenarioById(scenarioId);
    if (!sc) return;
    state.mode = "guide";
    state.scenarioId = scenarioId;
    state.stepIndex = 0;
    state.controlState = {};
    enterSimChrome(sc.title);
    $all("#mode-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === "guide"));
    $("#ck-stage").classList.add("guide-dim");
    setPanel(sc.startPanel || "overhead");
    if (state.scene) {
      state.scene.setMode("guide");
      const snap = sc.startPanel === "pedestal" ? "pedestal"
        : sc.startPanel === "glareshield" || sc.startPanel === "main" ? "forward"
        : "overhead";
      state.scene.lookSnap(snap);
    }
    renderCoachStep();
    $("#coach-feedback").textContent = "";
    $("#coach-feedback").className = "feedback";
  }

  function startExplore() {
    state.mode = "explore";
    state.scenarioId = null;
    enterSimChrome("自由探索");
    $all("#mode-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === "explore"));
    $("#ck-stage").classList.remove("guide-dim");
    clearHighlights();
    setPanel("overhead");
    if (state.scene) {
      state.scene.setMode("explore");
      state.scene.setTarget(null);
      state.scene.setDone([]);
      state.scene.lookSnap("forward");
    }
    $("#coach-progress").textContent = "自由探索 · 拖动环视，点发光控件";
    $("#coach-bar").style.width = "0%";
    $("#coach-title").textContent = "点任意部件";
    $("#coach-ref").textContent = "系统/NP 提示";
    $("#coach-action").textContent = "拖动画面环视顶板 / MCP / 中央台；点青色热点查看说明。";
    $("#coach-explain").textContent = "不强制顺序。运行以公司现行 FCOM/EFB 为准。";
    $("#coach-feedback").textContent = "";
    $("#coach-feedback").className = "feedback";
  }

  function renderCoachStep() {
    const sc = scenarioById(state.scenarioId);
    if (!sc) return;
    const total = sc.steps.length;
    const i = state.stepIndex;
    if (i >= total) {
      $("#coach-progress").textContent = `完成 ${total}/${total}`;
      $("#coach-bar").style.width = "100%";
      $("#coach-title").textContent = "场景完成";
      $("#coach-ref").textContent = sc.fcom;
      $("#coach-action").textContent = "很好！请再对照现行 FCOM/EFB 复习原文。";
      $("#coach-explain").textContent = (sc.skipped && sc.skipped.length)
        ? ("本场景省略：" + sc.skipped.slice(0, 3).join("；") + "…")
        : "";
      $("#coach-feedback").textContent = "进度已保存在本机。";
      $("#coach-feedback").className = "feedback ok";
      clearHighlights();
      if (state.scene) {
        state.scene.setTarget(null);
        state.scene.setDone(sc.steps.map((s) => s.target));
      }
      state.progress.completed[sc.id] = { at: Date.now(), steps: total };
      state.progress.lastScenario = sc.id;
      saveProgress();
      return;
    }
    const step = sc.steps[i];
    const ctl = controlById(step.target);
    $("#coach-progress").textContent = `步骤 ${i + 1}/${total} · ${sc.title}`;
    $("#coach-bar").style.width = `${Math.round((i / total) * 100)}%`;
    $("#coach-title").textContent = ctl ? ctl.name : step.target;
    $("#coach-ref").textContent = step.ref || sc.fcom;
    $("#coach-action").textContent = step.action;
    $("#coach-explain").textContent = step.explain || "";
    if (step.panel) setPanel(step.panel);
    highlightTarget(step.target);
  }

  function onHotTap(id) {
    const ctl = controlById(id);
    if (state.mode === "explore") {
      $("#coach-title").textContent = ctl ? ctl.name : id;
      $("#coach-ref").textContent = ctl ? (ctl.zone || "面板") : "—";
      $("#coach-action").textContent = ctl ? ctl.name : id;
      $("#coach-explain").textContent = ctl ? ctl.note : "（目录中无此控件说明）";
      $("#coach-feedback").textContent = "";
      clearHighlights();
      const el = $(`.hot[data-id="${id}"]`);
      if (el) el.classList.add("target");
      if (state.scene) {
        state.scene.setMode("explore");
        state.scene.setTarget(id);
      }
      return;
    }
    if (state.mode !== "guide" || !state.scenarioId) return;
    const sc = scenarioById(state.scenarioId);
    if (!sc || state.stepIndex >= sc.steps.length) return;
    const step = sc.steps[state.stepIndex];
    const fb = $("#coach-feedback");
    if (id === step.target) {
      if (step.setState) {
        Object.keys(step.setState).forEach((k) => applyControlVisual(k, step.setState[k]));
      }
      fb.textContent = "正确。";
      fb.className = "feedback ok";
      state.stepIndex += 1;
      setTimeout(() => {
        fb.textContent = "";
        renderCoachStep();
      }, 450);
    } else {
      const want = controlById(step.target);
      fb.textContent = `还不是这一步。请找：${want ? want.name : step.target}（可点「看向目标」）。`;
      fb.className = "feedback bad";
      const wrong = $(`.hot[data-id="${id}"]`);
      if (wrong) {
        wrong.classList.add("wrong-flash");
        setTimeout(() => wrong.classList.remove("wrong-flash"), 400);
      }
    }
  }

  function bindHotspots() {
    $all(".hot[data-id]").forEach((el) => {
      el.addEventListener("click", () => onHotTap(el.dataset.id));
    });
  }

  function setViewMode(view) {
    state.view = view;
    const immersive = view === "immersive";
    document.body.classList.toggle("view-immersive", immersive);
    document.body.classList.toggle("view-flat", !immersive);
    $("#btn-view-immersive")?.classList.toggle("active", immersive);
    $("#btn-view-flat")?.classList.toggle("active", !immersive);
    const canvasHost = $("#immersive-host");
    const flat = $("#flat-panels");
    if (canvasHost) canvasHost.classList.toggle("hidden", !immersive);
    if (flat) flat.classList.toggle("hidden", immersive);
    $("#look-bar")?.classList.toggle("hidden", !immersive);
    if (immersive) ensureScene();
  }

  function ensureScene() {
    if (state.view !== "immersive") return;
    const host = $("#immersive-host");
    if (!host) return;
    // Wait until sim layout is visible so canvas gets real size
    const sim = $("#view-sim");
    if (sim && (sim.style.display === "none" || sim.classList.contains("hidden"))) return;

    if (state.scene) {
      requestAnimationFrame(() => {
        state.scene._resize?.();
        requestAnimationFrame(() => state.scene._resize?.());
      });
      return;
    }
    const api = window.__COCKPIT_SCENE__;
    if (!api || !api.ready) {
      fallbackFlat("三维引擎未加载成功（请检查网络后刷新）。已切换平面面板，仍可点选练习。");
      return;
    }
    if (!api.detectWebGL()) {
      fallbackFlat("本机不支持 WebGL，已切换平面面板。");
      return;
    }
    try {
      state.scene = new api.CockpitScene(host, {
        onSelect: (id) => onHotTap(id),
      });
      if (state.data) state.scene.applyControlPositions(state.data.controls);
      renderCredits(state.scene.getCredits());
      requestAnimationFrame(() => {
        state.scene._resize?.();
        requestAnimationFrame(() => state.scene._resize?.());
      });
      setTimeout(() => renderCredits(state.scene.getCredits()), 2500);
    } catch (err) {
      console.error(err);
      fallbackFlat("沉浸场景启动失败，已切换平面面板。");
    }
  }

  function fallbackFlat(msg) {
    setViewMode("flat");
    const fb = $("#coach-feedback");
    if (fb && msg) {
      fb.textContent = msg;
      fb.className = "feedback";
    }
  }

  function renderCredits(list) {
    const el = $("#tex-credits");
    if (!el) return;
    if (!list || !list.length) {
      el.innerHTML = "面板贴图：程序化材质（Wikimedia 照片加载中或不可用）";
      return;
    }
    el.innerHTML = "贴图致谢（已改尺寸/透明度用于学习示意）：" + list.map((c) =>
      ` <a href="${escapeHtml(c.page)}" target="_blank" rel="noopener">${escapeHtml(c.credit)}</a>`
    ).join("；");
  }

  function bindChrome() {
    $all("#mode-tabs button").forEach((b) => {
      b.onclick = () => {
        const m = b.dataset.mode;
        if (m === "home") showHome();
        else if (m === "explore") startExplore();
        else if (m === "guide") {
          if (state.scenarioId) {
            state.mode = "guide";
            $all("#mode-tabs button").forEach((x) => x.classList.toggle("active", x.dataset.mode === "guide"));
            $("#ck-stage").classList.add("guide-dim");
            if (state.scene) state.scene.setMode("guide");
            renderCoachStep();
          } else {
            showHome();
          }
        }
      };
    });
    $all("#panel-tabs button").forEach((b) => {
      b.onclick = () => setPanel(b.dataset.panel);
    });
    $("#btn-explore").onclick = () => startExplore();
    $("#btn-exit-scenario").onclick = () => showHome();
    $("#btn-hint").onclick = () => {
      if (state.mode === "guide" && state.scenarioId) {
        const sc = scenarioById(state.scenarioId);
        const step = sc && sc.steps[state.stepIndex];
        if (step) {
          if (step.panel) setPanel(step.panel);
          highlightTarget(step.target);
          $("#coach-feedback").textContent = state.view === "immersive"
            ? "已转向目标；青色脉冲热点即下一步。"
            : "已切换到目标所在面板，黄色闪烁处即下一步。";
          $("#coach-feedback").className = "feedback ok";
        }
      } else if (state.mode === "explore") {
        $("#coach-feedback").textContent = "自由探索：拖动环视，点热点即可。";
        $("#coach-feedback").className = "feedback";
      }
    };

    $("#btn-view-immersive")?.addEventListener("click", () => setViewMode("immersive"));
    $("#btn-view-flat")?.addEventListener("click", () => setViewMode("flat"));

    $all("[data-look]").forEach((b) => {
      b.onclick = () => {
        if (state.scene) state.scene.lookSnap(b.dataset.look);
      };
    });

    $("#btn-gyro")?.addEventListener("click", async () => {
      if (!state.scene) return;
      const ok = await state.scene.enableGyro(true);
      $("#coach-feedback").textContent = ok
        ? "陀螺仪已开启（再拖动画面会暂时关闭）。"
        : "无法开启陀螺仪（需 HTTPS 且浏览器允许运动权限）。";
      $("#coach-feedback").className = ok ? "feedback ok" : "feedback bad";
    });
  }

  async function init() {
    const res = await fetch("./data/cockpit-scenarios.json?v=7", { cache: "no-cache" });
    if (!res.ok) throw new Error("场景数据 HTTP " + res.status);
    state.data = await res.json();
    bindHotspots();
    bindChrome();

    // Wait for scene module (local three vendor; allow slower phones)
    const waitScene = () => new Promise((resolve) => {
      if (window.__COCKPIT_SCENE__?.ready) return resolve(true);
      let n = 0;
      const t = setInterval(() => {
        n++;
        if (window.__COCKPIT_SCENE__?.ready) {
          clearInterval(t);
          resolve(true);
        } else if (n > 100) {
          clearInterval(t);
          resolve(false);
        }
      }, 50);
    });
    const sceneReady = await waitScene();

    const canGL = sceneReady && window.__COCKPIT_SCENE__?.detectWebGL?.();
    // Prefer immersive only when engine is ready; else flat with a clear reason
    if (canGL) setViewMode("immersive");
    else {
      setViewMode("flat");
      if (!sceneReady) {
        console.warn("cockpit-scene module not ready");
      }
    }

    showHome();
  }

  window.__EFB_COCKPIT__ = { state, startGuide, startExplore, onHotTap };

  init().catch((err) => {
    document.body.innerHTML = `<div style="padding:24px;color:#fca5a5">驾驶舱练习加载失败：${escapeHtml(err.message)}<p style="color:#94a3b8;font-size:.85rem">个人学习辅助，运行以公司现行 FCOM/EFB 为准。</p></div>`;
  });
})();
