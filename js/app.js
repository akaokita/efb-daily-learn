/* B737 EFB Daily Learn App */
(function () {
  const STORAGE_KEY = "efb-learn-progress-v1";
  const state = {
    data: null,
    view: "today",
    lessonId: null,
    mode: "read", // read | quiz | result
    quizIndex: 0,
    answers: [],
    progress: loadProgress(),
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      const base = defaultProgress();
      const merged = Object.assign(base, parsed && typeof parsed === "object" ? parsed : {});
      if (!merged.completed || typeof merged.completed !== "object" || Array.isArray(merged.completed)) {
        merged.completed = {};
      }
      if (!Array.isArray(merged.wrong)) merged.wrong = [];
      if (!merged.studyDates || typeof merged.studyDates !== "object") merged.studyDates = {};
      return merged;
    } catch {
      return defaultProgress();
    }
  }
  function defaultProgress() {
    return {
      completed: {}, // id -> {score, total, at}
      wrong: [], // {lessonId, qIndex, at}
      streak: 0,
      lastStudyDate: null, // YYYY-MM-DD local
      studyDates: {},
    };
  }
  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function touchStreak() {
    const t = todayStr();
    const p = state.progress;
    if (p.lastStudyDate === t) return;
    if (p.lastStudyDate === yesterdayStr()) p.streak = (p.streak || 0) + 1;
    else p.streak = 1;
    p.lastStudyDate = t;
    p.studyDates[t] = true;
    saveProgress();
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

  // Minimal markdown: headings, lists, tables, blockquotes, bold, inline code, paragraphs
  function renderMarkdown(md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let i = 0;
    let inUl = false, inOl = false, inTable = false, tableRows = [];

    function closeLists() {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (inOl) { html += "</ol>"; inOl = false; }
    }
    function closeTable() {
      if (!inTable) return;
      let body = "";
      tableRows.forEach((row, idx) => {
        const parts = row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        if (idx === 1 && parts.every((p) => /^:?-+:?$/.test(p))) return; // separator
        const tag = idx === 0 ? "th" : "td";
        body += "<tr>" + parts.map((p) => `<${tag}>${inline(p)}</${tag}>`).join("") + "</tr>";
      });
      html += `<table>${body}</table>`;
      inTable = false;
      tableRows = [];
    }
    function inline(t) {
      return escapeHtml(t)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    }

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith("|")) {
        closeLists();
        inTable = true;
        tableRows.push(line);
        i++;
        continue;
      } else if (inTable) {
        closeTable();
      }

      if (/^##\s+/.test(line)) {
        closeLists();
        html += `<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`;
      } else if (/^###\s+/.test(line)) {
        closeLists();
        html += `<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`;
      } else if (/^>\s?/.test(line)) {
        closeLists();
        html += `<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`;
      } else if (/^[-*]\s+/.test(line)) {
        if (inOl) { html += "</ol>"; inOl = false; }
        if (!inUl) { html += "<ul>"; inUl = true; }
        html += `<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`;
      } else if (/^\d+\.\s+/.test(line)) {
        if (inUl) { html += "</ul>"; inUl = false; }
        if (!inOl) { html += "<ol>"; inOl = true; }
        html += `<li>${inline(line.replace(/^\d+\.\s+/, ""))}</li>`;
      } else if (line.trim() === "") {
        closeLists();
      } else {
        closeLists();
        html += `<p>${inline(line)}</p>`;
      }
      i++;
    }
    closeLists();
    closeTable();
    return html;
  }

  function lessons() { return state.data.lessons; }
  function getLesson(id) { return lessons().find((l) => l.id === id); }

  function nextLessonId() {
    for (const l of lessons()) {
      if (!state.progress.completed[l.id]) return l.id;
    }
    return lessons()[0].id;
  }

  function completedCount() {
    return Object.keys(state.progress.completed).length;
  }

  function setView(name) {
    state.view = name;
    $all(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === name));
    $all(".bottom-nav button").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
    try {
      if (name === "today") renderToday();
      if (name === "courses") renderCourses();
      if (name === "review") renderReview();
      if (name === "me") renderMe();
    } catch (err) {
      const el = document.querySelector(`.view[data-view="${name}"]`) || $("#view-today");
      if (el) {
        el.innerHTML = `<div class="card" style="color:#fca5a5">页面渲染失败：${escapeHtml(err && err.message || String(err))}。请无痕窗口打开或清除本站数据后重试。</div>`;
      }
      console.error(err);
    }
    window.scrollTo(0, 0);
  }

  function openLesson(id, mode = "read") {
    state.lessonId = id;
    state.mode = mode;
    state.quizIndex = 0;
    state.answers = [];
    setView("lesson");
    try {
      renderLesson();
    } catch (err) {
      const el = $("#view-lesson");
      if (el) {
        el.innerHTML = `<div class="card" style="color:#fca5a5">课程渲染失败：${escapeHtml(err && err.message || String(err))}<div class="btn-row" style="margin-top:12px"><button class="btn" id="btn-back-err">返回今日</button></div></div>`;
        const b = $("#btn-back-err");
        if (b) b.onclick = () => setView("today");
      }
      console.error(err);
    }
  }

  function renderToday() {
    const el = $("#view-today");
    const total = lessons().length;
    const done = completedCount();
    const pct = Math.round((done / total) * 100);
    const nid = nextLessonId();
    const next = getLesson(nid);
    const streak = state.progress.streak || 0;
    const studiedToday = state.progress.lastStudyDate === todayStr();

    el.innerHTML = `
      <div class="disclaimer">${escapeHtml(state.data.disclaimer)}</div>
      <div class="card">
        <div class="row space">
          <div>
            <h2 style="margin:0">今日学习</h2>
            <div class="muted">${studiedToday ? "今天已打卡" : "今天还没学，打开下一节即可打卡"}</div>
          </div>
          <span class="chip"><span class="flame">🔥</span> 连续 ${streak} 天</span>
        </div>
        <div class="stat-grid">
          <div class="stat"><div class="n">${done}</div><div class="l">已学</div></div>
          <div class="stat"><div class="n">${total - done}</div><div class="l">未学</div></div>
          <div class="stat"><div class="n">${pct}%</div><div class="l">总进度</div></div>
        </div>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <div class="muted">每日目标约 8–15 分钟 · 共 ${total} 节微课</div>
      </div>
      <div class="card">
        <div class="badge mod">${escapeHtml(next.module)}</div>
        <h2 style="margin-top:8px">${escapeHtml(next.title)}</h2>
        <div class="muted">预计 ${next.minutes} 分钟 · 第 ${next.id} 节</div>
        <div class="btn-row">
          <button class="btn" id="btn-start-today">开始学习</button>
          <button class="btn secondary" id="btn-quiz-today">直接测验</button>
        </div>
      </div>
      <div class="card">
        <h2>驾驶舱练习</h2>
        <div class="muted">B737NG 示意面板 · 按 FCOM 正常程序引导点击</div>
        <div class="btn-row">
          <a class="btn" href="./cockpit.html" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none">打开沉浸驾驶舱</a>
        </div>
      </div>
      <div class="card">
        <h2>手册地图</h2>
        <div class="muted">点进课程模块 A，或看下面五本手册角色。</div>
        <ul style="margin:10px 0 0;padding-left:1.1em;font-size:.9rem">
          ${state.data.manuals.map((m) => `<li><strong>${escapeHtml(m.id)}</strong> — ${escapeHtml(m.role)}</li>`).join("")}
        </ul>
      </div>
    `;
    $("#btn-start-today").onclick = () => openLesson(nid, "read");
    $("#btn-quiz-today").onclick = () => openLesson(nid, "quiz");
  }

  function renderCourses() {
    const el = $("#view-courses");
    let html = `<div class="card"><h2>全部课程</h2><div class="muted">共 ${lessons().length} 节 · 按科学顺序编排</div></div>
      <div class="card"><h2>驾驶舱练习</h2><div class="muted">沉浸内舱 · 拖动环视 · FCOM NP 引导</div><div class="btn-row"><a class="btn secondary" href="./cockpit.html" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none">打开驾驶舱</a></div></div>`;
    let lastMod = null;
    for (const l of lessons()) {
      if (l.module !== lastMod) {
        lastMod = l.module;
        html += `<div class="module-title">${escapeHtml(l.module)}</div>`;
      }
      const done = !!state.progress.completed[l.id];
      html += `
        <div class="lesson-item ${done ? "done" : ""}" data-id="${l.id}">
          <div class="idx">${done ? "✓" : l.id}</div>
          <div class="meta">
            <div class="title">${escapeHtml(l.title)}</div>
            <div class="info">${l.minutes} 分钟 · ${escapeHtml(l.sources.map((s) => s.manual).join("/"))}
              ${done ? '<span class="badge done">已学</span>' : '<span class="badge">未学</span>'}
            </div>
          </div>
        </div>`;
    }
    el.innerHTML = html;
    $all(".lesson-item", el).forEach((item) => {
      item.onclick = () => openLesson(item.dataset.id, "read");
    });
  }

  function renderLesson() {
    const el = $("#view-lesson");
    const l = getLesson(state.lessonId);
    if (!l) { el.innerHTML = `<div class="empty">课程不存在</div>`; return; }

    if (state.mode === "quiz") {
      renderQuiz(el, l);
      return;
    }
    if (state.mode === "result") {
      renderResult(el, l);
      return;
    }

    const sources = l.sources.map((s) =>
      `<li><strong>${escapeHtml(s.manual)}</strong> ${escapeHtml(s.ref)}（${escapeHtml(s.pages)}）</li>`
    ).join("");

    el.innerHTML = `
      <div class="card">
        <div class="row space">
          <button class="btn ghost" id="btn-back" style="width:auto;min-height:40px;padding:8px 12px">← 返回</button>
          <span class="badge mod">${escapeHtml(l.module)}</span>
        </div>
        <h2 style="margin-top:12px">${escapeHtml(l.title)}</h2>
        <div class="muted">预计 ${l.minutes} 分钟 · 来源见文末</div>
      </div>
      <div class="card markdown">${renderMarkdown(l.body)}</div>
      <div class="source-box"><strong>来源引用</strong><ul>${sources}</ul></div>
      <div class="btn-row" style="margin:16px 0 8px">
        <button class="btn" id="btn-to-quiz">学完 · 开始测验（${l.quiz.length} 题）</button>
        <button class="btn secondary" id="btn-mark-read">仅标记已读（不测）</button>
      </div>
    `;
    $("#btn-back").onclick = () => setView("courses");
    $("#btn-to-quiz").onclick = () => { state.mode = "quiz"; state.quizIndex = 0; state.answers = []; renderLesson(); };
    $("#btn-mark-read").onclick = () => {
      touchStreak();
      if (!state.progress.completed[l.id]) {
        state.progress.completed[l.id] = { score: 0, total: 0, at: Date.now(), readOnly: true };
        saveProgress();
      }
      setView("today");
    };
  }

  function renderQuiz(el, l) {
    const qi = state.quizIndex;
    const q = l.quiz[qi];
    const total = l.quiz.length;
    let optionsHtml = "";
    if (q.type === "tf") {
      optionsHtml = `
        <button class="option" data-v="true">正确 / 是</button>
        <button class="option" data-v="false">错误 / 否</button>`;
    } else {
      optionsHtml = q.options.map((opt, idx) =>
        `<button class="option" data-v="${idx}">${escapeHtml(opt)}</button>`
      ).join("");
    }

    el.innerHTML = `
      <div class="card">
        <div class="quiz-progress">测验 ${qi + 1} / ${total} · ${escapeHtml(l.title)}</div>
        <div class="progress"><span style="width:${((qi) / total) * 100}%"></span></div>
        <div class="quiz-q">${escapeHtml(q.q)}</div>
        <div id="opts">${optionsHtml}</div>
        <div id="explain" hidden class="explain"></div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn" id="btn-next" disabled>下一题</button>
        </div>
      </div>
    `;

    let locked = false;
    $all("#opts .option", el).forEach((btn) => {
      btn.onclick = () => {
        if (locked) return;
        locked = true;
        let chosen;
        let correct;
        if (q.type === "tf") {
          chosen = btn.dataset.v === "true";
          correct = !!q.answer;
        } else {
          chosen = Number(btn.dataset.v);
          correct = q.answer;
        }
        const ok = chosen === correct;
        state.answers.push({ ok, chosen, qIndex: qi });
        if (!ok) {
          state.progress.wrong.push({ lessonId: l.id, qIndex: qi, at: Date.now(), q: q.q, explain: q.explain });
          // keep last 100
          if (state.progress.wrong.length > 100) state.progress.wrong = state.progress.wrong.slice(-100);
          saveProgress();
        }
        $all("#opts .option", el).forEach((b) => {
          b.disabled = true;
          let v = q.type === "tf" ? (b.dataset.v === "true") : Number(b.dataset.v);
          if (v === correct) b.classList.add("correct");
          if (b === btn && !ok) b.classList.add("wrong");
          if (b === btn) b.classList.add("selected");
        });
        const ex = $("#explain", el);
        ex.hidden = false;
        ex.innerHTML = `<strong>${ok ? "✓ 正确" : "✗ 不正确"}</strong><br>${escapeHtml(q.explain)}`;
        $("#btn-next").disabled = false;
      };
    });

    $("#btn-next").onclick = () => {
      if (qi + 1 >= total) {
        finishQuiz(l);
      } else {
        state.quizIndex++;
        renderLesson();
      }
    };
  }

  function finishQuiz(l) {
    const score = state.answers.filter((a) => a.ok).length;
    const total = l.quiz.length;
    touchStreak();
    state.progress.completed[l.id] = { score, total, at: Date.now() };
    saveProgress();
    state.mode = "result";
    renderLesson();
  }

  function renderResult(el, l) {
    const c = state.progress.completed[l.id];
    const score = c ? c.score : 0;
    const total = c ? c.total : l.quiz.length;
    const pct = total ? Math.round((score / total) * 100) : 0;
    const nextId = (() => {
      const idx = lessons().findIndex((x) => x.id === l.id);
      return lessons()[Math.min(idx + 1, lessons().length - 1)].id;
    })();
    el.innerHTML = `
      <div class="card" style="text-align:center">
        <h2>本课完成</h2>
        <div class="stat" style="display:inline-block;min-width:140px;margin:12px 0">
          <div class="n">${score}/${total}</div>
          <div class="l">正确率 ${pct}%</div>
        </div>
        <div class="muted">连续打卡 ${state.progress.streak || 0} 天 · 已学 ${completedCount()}/${lessons().length}</div>
        <div class="btn-row" style="margin-top:18px;text-align:left">
          <button class="btn" id="btn-next-lesson">下一节</button>
          <button class="btn secondary" id="btn-retry">重测本节</button>
          <button class="btn ghost" id="btn-home">回今日</button>
        </div>
      </div>
    `;
    $("#btn-next-lesson").onclick = () => openLesson(nextId, "read");
    $("#btn-retry").onclick = () => openLesson(l.id, "quiz");
    $("#btn-home").onclick = () => setView("today");
  }

  function renderReview() {
    const el = $("#view-review");
    const wrong = [...state.progress.wrong].reverse();
    if (!wrong.length) {
      el.innerHTML = `<div class="empty">暂无错题。完成测验后，答错的题目会出现在这里。</div>`;
      return;
    }
    let html = `<div class="card"><h2>错题复习</h2><div class="muted">最近 ${wrong.length} 条（本地保存）</div></div>`;
    wrong.slice(0, 40).forEach((w, i) => {
      const lesson = getLesson(w.lessonId);
      html += `
        <div class="card">
          <div class="badge">${escapeHtml(w.lessonId)} ${lesson ? escapeHtml(lesson.title) : ""}</div>
          <div style="margin-top:8px;font-weight:600">${escapeHtml(w.q || "")}</div>
          <div class="explain" style="margin-top:10px">${escapeHtml(w.explain || "")}</div>
          <button class="btn secondary" style="margin-top:10px" data-open="${w.lessonId}">打开该课</button>
        </div>`;
    });
    html += `<div class="btn-row"><button class="btn ghost" id="btn-clear-wrong">清空错题本</button></div>`;
    el.innerHTML = html;
    $all("[data-open]", el).forEach((b) => b.onclick = () => openLesson(b.dataset.open, "read"));
    $("#btn-clear-wrong").onclick = () => {
      if (confirm("清空全部错题记录？")) {
        state.progress.wrong = [];
        saveProgress();
        renderReview();
      }
    };
  }

  function renderMe() {
    const el = $("#view-me");
    const p = state.progress;
    const dates = Object.keys(p.studyDates || {}).sort().reverse().slice(0, 14);
    el.innerHTML = `
      <div class="disclaimer">${escapeHtml(state.data.disclaimer)}</div>
      <div class="card">
        <h2>我的进度</h2>
        <div class="stat-grid">
          <div class="stat"><div class="n">${completedCount()}</div><div class="l">已完成</div></div>
          <div class="stat"><div class="n">${p.streak || 0}</div><div class="l">连续天</div></div>
          <div class="stat"><div class="n">${(p.wrong || []).length}</div><div class="l">错题</div></div>
        </div>
      </div>
      <div class="card">
        <h2>最近学习日</h2>
        <div class="muted">${dates.length ? dates.join(" · ") : "暂无"}</div>
      </div>
      <div class="card">
        <h2>驾驶舱练习</h2>
        <div class="muted">顶板 / MCP / 起动程序互动引导</div>
        <div class="btn-row">
          <a class="btn secondary" href="./cockpit.html" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none">进入驾驶舱</a>
        </div>
      </div>
      <div class="card">
        <h2>添加到主屏幕</h2>
        <div class="muted">iPhone：Safari 打开本页 → 分享 → 添加到主屏幕。<br>Android：Chrome 菜单 → 添加到主屏幕 / 安装应用。</div>
      </div>
      <div class="card">
        <h2>数据</h2>
        <div class="btn-row">
          <button class="btn secondary" id="btn-export">导出进度 JSON</button>
          <button class="btn ghost" id="btn-reset">重置全部进度</button>
        </div>
      </div>
      <div class="card muted" style="font-size:.8rem">
        版本 ${escapeHtml(state.data.version)} · 纯前端本地存储 · 不上传服务器
      </div>
    `;
    $("#btn-reset").onclick = () => {
      if (confirm("确定重置所有进度、打卡与错题？")) {
        state.progress = defaultProgress();
        saveProgress();
        renderMe();
      }
    };
    $("#btn-export").onclick = () => {
      const blob = new Blob([JSON.stringify(state.progress, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "efb-learn-progress.json";
      a.click();
    };
  }

  async function init() {
    const boot = $("#boot-status");
    if (boot) boot.textContent = "正在加载课程数据…";
    const res = await fetch("./data/lessons.json?v=6", { cache: "no-cache" });
    if (!res.ok) throw new Error("课程数据 HTTP " + res.status);
    state.data = await res.json();
    if (!state.data || !Array.isArray(state.data.lessons) || !state.data.lessons.length) {
      throw new Error("课程数据为空或格式不对");
    }
    document.title = state.data.title;
    $("#app-title").textContent = state.data.title;

    $all(".bottom-nav button").forEach((b) => {
      b.onclick = () => setView(b.dataset.nav);
    });

    // lesson view is separate nav target but not in bottom for clarity — use courses/today
    setView("today");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js?v=6").then((reg) => {
        reg.update().catch(() => {});
      }).catch(() => {});
    }
  }

  // expose for smoke tests
  window.__EFB_LEARN__ = { state, setView, openLesson, getLesson };

  init().catch((err) => {
    document.body.innerHTML = `<div style="padding:24px;color:#fca5a5">加载失败：${escapeHtml(err.message)}。请用本地服务器打开（不要直接 file://）。</div>`;
  });
})();
