/* notify.js：Toast 独立实现，无外部依赖。
 * API：Toast.success/error/warning/info(msg)
 * 说明：添加/编辑已改各版块内联表单，删除走行内两步确认，本文件不再提供弹窗。
 */
(function (global) {
'use strict';

var TYPE_COLOR = {
  success: '#34d399',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa'
};

function ensureStyle() {
  if (document.getElementById('nz-style')) return;
  var css =
    '.nz-toasts{position:fixed;top:12px;right:12px;z-index:120;display:flex;flex-direction:column;gap:8px;max-width:min(320px,86vw)}' +
    '.nz-toast{padding:10px 14px;border-radius:10px;font-size:13px;color:#f1f5f9;background:rgba(15,23,42,.96);' +
    'border:1px solid rgba(255,255,255,.12);border-left:3px solid #60a5fa;box-shadow:0 8px 24px rgba(0,0,0,.45);cursor:pointer}';
  var st = document.createElement('style');
  st.id = 'nz-style';
  st.textContent = css;
  document.head.appendChild(st);
}

/* ── Toast ── */
var toastBox = null;
function toast(msg, type, duration) {
  ensureStyle();
  if (!toastBox) {
    toastBox = document.createElement('div');
    toastBox.className = 'nz-toasts';
    document.body.appendChild(toastBox);
  }
  var el = document.createElement('div');
  el.className = 'nz-toast';
  el.style.borderLeftColor = TYPE_COLOR[type] || TYPE_COLOR.info;
  el.textContent = String(msg == null ? '' : msg);
  var timer = setTimeout(dismiss, duration == null ? 3000 : duration);
  function dismiss() {
    clearTimeout(timer);
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  el.addEventListener('click', dismiss);
  toastBox.appendChild(el);
  while (toastBox.children.length > 5) toastBox.removeChild(toastBox.firstChild);
  return { dismiss: dismiss };
}

var Toast = {
  show: function (msg, opts) {
    opts = opts || {};
    return toast(msg, opts.type || 'info', opts.duration);
  },
  success: function (m) { return toast(m, 'success'); },
  error: function (m) { return toast(m, 'error'); },
  warning: function (m) { return toast(m, 'warning'); },
  info: function (m) { return toast(m, 'info'); }
};

global.Toast = Toast;
})(window);
