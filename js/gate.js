(function () {
  "use strict";
  var HASH = "f0386e01f84a7497997e263eecdc60140455d1d7d875176610493df33038dd55";
  var STORE = "efb-gate-v1";
  var scriptEl = document.currentScript;
  var scripts = ((scriptEl && scriptEl.getAttribute("data-scripts")) || "")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var moduleSrc = (scriptEl && scriptEl.getAttribute("data-module")) || "";

  function storedOk() {
    try {
      return localStorage.getItem(STORE) === HASH || sessionStorage.getItem(STORE) === HASH;
    } catch (e) {
      return false;
    }
  }

  function remember(keep) {
    try {
      if (keep) localStorage.setItem(STORE, HASH);
      else sessionStorage.setItem(STORE, HASH);
    } catch (e) {}
  }

  function sha256hex(str) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  function loadPageScripts() {
    scripts.forEach(function (src) {
      var s = document.createElement("script");
      s.src = src;
      document.body.appendChild(s);
    });
    if (moduleSrc) {
      var m = document.createElement("script");
      m.type = "module";
      m.src = moduleSrc;
      document.body.appendChild(m);
    }
  }

  function openApp() {
    document.documentElement.classList.add("efb-open");
    var gate = document.getElementById("efb-gate");
    if (gate) gate.remove();
    loadPageScripts();
  }

  function showGate() {
    var wrap = document.createElement("div");
    wrap.id = "efb-gate";
    wrap.innerHTML =
      '<style>' +
      'html{background:#0b1220}' +
      'html:not(.efb-open) body{margin:0;background:#0b1220}' +
      'html:not(.efb-open) body>*:not(#efb-gate){display:none!important}' +
      '#efb-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b1220;color:#e8eefc}' +
      '#efb-gate .card{width:100%;max-width:360px;background:#182338;border:1px solid #2a3a55;border-radius:16px;padding:22px 20px}' +
      '#efb-gate h1{margin:0 0 8px;font-size:20px}' +
      '#efb-gate p{margin:0 0 16px;font-size:14px;line-height:1.5;color:#9db0d0}' +
      '#efb-gate input[type=password],#efb-gate input[type=text]{width:100%;box-sizing:border-box;font-size:16px;' +
      'padding:12px 14px;border-radius:10px;border:1px solid #3a4d6e;background:#0f1726;color:#e8eefc;margin-bottom:12px}' +
      '#efb-gate label{display:flex;align-items:center;gap:8px;font-size:13px;color:#9db0d0;margin-bottom:16px}' +
      '#efb-gate button{width:100%;padding:12px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-size:16px;font-weight:650}' +
      '#efb-gate .err{color:#fca5a5;font-size:13px;min-height:18px;margin:0 0 10px}' +
      '</style>' +
      '<form class="card" autocomplete="current-password">' +
      '<h1>个人学习页</h1>' +
      '<p>请输入访问口令后进入。仅供个人入职学习使用。</p>' +
      '<div class="err" id="efb-gate-err"></div>' +
      '<input id="efb-gate-input" type="password" inputmode="text" autocapitalize="off" autocomplete="current-password" placeholder="访问口令" />' +
      '<label><input id="efb-gate-keep" type="checkbox" checked /> 在这台设备记住，下次不用再输入</label>' +
      '<button type="submit">进入</button>' +
      '</form>';
    if (document.body) document.body.appendChild(wrap);
    else document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(wrap); });

    wrap.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("efb-gate-input");
      var err = document.getElementById("efb-gate-err");
      var keep = document.getElementById("efb-gate-keep");
      var code = (input && input.value || "").trim();
      err.textContent = "";
      if (!code) {
        err.textContent = "请输入口令";
        return;
      }
      sha256hex(code).then(function (h) {
        if (h !== HASH) {
          err.textContent = "口令不对，请再试一次";
          if (input) input.select();
          return;
        }
        remember(keep ? keep.checked : true);
        openApp();
      }).catch(function () {
        err.textContent = "这台浏览器暂不支持校验，请换 Safari 或 Chrome 再试";
      });
    });
    setTimeout(function () {
      var input = document.getElementById("efb-gate-input");
      if (input) input.focus();
    }, 80);
  }

  if (storedOk()) {
    document.documentElement.classList.add("efb-open");
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadPageScripts);
    } else {
      loadPageScripts();
    }
  } else {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showGate);
    } else {
      showGate();
    }
  }
})();
