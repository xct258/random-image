/* app.js：控制台前端逻辑（五视图 + 壁纸）。
 * 依赖：notify.js（Toast）、index.php 内联注入的 window.API_BASE。
 * 约定：渲染全部输出到 index.php 预置的容器；onclick 内联函数挂全局。
 * 添加/编辑走弹窗表单（遮罩单层滚动，键盘只滚表单不改页面布局）；
 * 删除走行内两步确认（点一次变“确认删？”，3 秒内再点执行）。
'use strict';

/* ═════════ 后端接口层（地址改这里一处即可；https 页面调 http 会被浏览器拦截） ═════════ */
var BACKEND = 'http://' + location.hostname + ':8000';

/* 全局在飞请求计数：网络慢时给统一加载反馈（延迟 180ms 显示，避免快请求闪一下）。
   首屏加载（_boot）期间不显示，内容登场后才开始提示。 */
var _pending = 0, _netTimer = null, _boot = true;
function netStart() {
  _pending++;
  if (_pending === 1) {
    if (_netTimer) clearTimeout(_netTimer);
    _netTimer = setTimeout(function () { if (_pending > 0 && !_boot) document.body.classList.add('loading'); }, 180);
  }
}
function netEnd() {
  _pending = Math.max(0, _pending - 1);
  if (_pending === 0) {
    if (_netTimer) { clearTimeout(_netTimer); _netTimer = null; }
    document.body.classList.remove('loading');
  }
}

function api(path, method, body) {
  /* GET 不带 Content-Type：跨域下避免多余 OPTIONS 预检，列表加载更快 */
  var opts = { method: method || 'GET' };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  /* 只有写操作（增/改/删）才显示「加载中…」；读取列表不打断体验 */
  var track = opts.method !== 'GET';
  if (track) netStart();
  return fetch(BACKEND + path, opts).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).finally(function () { if (track) netEnd(); });
}

function $(id) { return document.getElementById(id); }

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s == null ? '' : s;
  return d.innerHTML;
}

function todayStr() {
  return new Date().toLocaleDateString('sv-SE');
}

/* 后端失败提示：2 秒内只弹一次，启动 4 路并行失败不再刷屏 */
var _failAt = 0;
function failToast() {
  var now = Date.now();
  if (now - _failAt < 2000) return;
  _failAt = now;
  Toast.error('后端连接失败');
}

/* 行内两步删除确认：第一次点变“确认删？”，3 秒内再点才执行 */
function armDelete(btn, fn) {
  if (btn.hasAttribute('data-armed')) {
    btn.removeAttribute('data-armed');
    btn.classList.remove('armed');
    btn.textContent = btn.getAttribute('data-orig') || '删除';
    fn();
    return;
  }
  if (!btn.hasAttribute('data-orig')) btn.setAttribute('data-orig', btn.textContent);
  btn.setAttribute('data-armed', '1');
  btn.classList.add('armed');
  btn.textContent = '确认删？';
  setTimeout(function () {
    if (btn.isConnected && btn.hasAttribute('data-armed')) {
      btn.removeAttribute('data-armed');
      btn.classList.remove('armed');
      btn.textContent = btn.getAttribute('data-orig') || '删除';
    }
  }, 3000);
}

/* 表单弹窗显隐与通用交互 */
function hideForm(id) {
  var el = $(id);
  el.hidden = true;
  el.style.removeProperty('--vvt');
  el.style.removeProperty('--vvh');
  closePicker();
  closeISelect();
  resetPageScroll();
  setTimeout(resetPageScroll, 200);
}
/* 打开表单弹窗：显示 → 贴合可视视口 → 置顶；桌面聚焦首字段（触屏不聚焦，避免键盘直接弹起） */
function openForm(wrapId, focusId) {
  var wrap = $(wrapId);
  closePicker();
  closeISelect();
  wrap.hidden = false;
  fitViewport(wrap);
  wrap.scrollTop = 0;
  resetPageScroll();
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var f = focusId && $(focusId);
  if (f && !coarse) setTimeout(function () {
    try { f.focus({ preventScroll: true }); } catch (_e) { f.focus(); }
    if (f.select) { try { f.select(); } catch (_e) {} }
    resetPageScroll();
  }, 30);
}
/* 必填校验失败：标红 + 聚焦 */
function markInvalid(el) {
  if (!el) return;
  el.classList.add('invalid');
  el.focus();
}
/* 表单内 Enter 保存（textarea 换行除外）、Esc 关闭 */
function wireFormKeys(wrapId, saveFn) {
  $(wrapId).addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (_pick.field) { closePicker(); e.stopPropagation(); return; } /* 日历开着先收日历 */
      if (_isel) { closeISelect(); e.stopPropagation(); return; }       /* 下拉开着先收下拉 */
      hideForm(wrapId);
      return;
    }
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); saveFn(); }
  });
}
/* 输入即清除校验红框 */
document.addEventListener('input', function (e) {
  if (e.target && e.target.classList) e.target.classList.remove('invalid');
});
/* iOS 聚焦输入时会把页面/可视视口顶走：本页不滚动，统一压回原点，位置交给弹窗自身处理 */
function resetPageScroll() {
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
}
/* 点遮罩空白 / 任意位置 Esc 关闭已打开的弹窗 */
document.addEventListener('click', function (e) {
  var t = e.target;
  if (t && t.classList && t.classList.contains('iform-wrap')) hideForm(t.id);
});
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (_pick.field) { closePicker(); return; } /* 日历优先收起，再关弹窗 */
  if (_isel) { closeISelect(); return; }       /* 下拉优先收起，再关弹窗 */
  var wraps = document.querySelectorAll('.iform-wrap');
  for (var i = 0; i < wraps.length; i++) { if (!wraps[i].hidden) hideForm(wraps[i].id); }
});

/* ═════════ 状态与缓存 ═════════ */
var DB = { reminders: [], ledger: [], servers: [], bookmarks: [] };
var FQ = { reminders: '', expenses: '', servers: '', bookmarks: '' };
var LT = {};

function matchQ(q, s) {
  return !q || String(s == null ? '' : s).toLowerCase().indexOf(q) !== -1;
}

/* 30 秒内且有缓存则直接重画，不发请求 */
function fresh(k) {
  return (Date.now() - (LT[k] || 0)) < 30000 && DB[k] && DB[k].length;
}

/* ═════════ 视图切换与标题 ═════════ */
var VIEW_MAP = { '主页': 'home', '仪表': 'dash', '待办': 'reminders', '记账': 'expenses', '监控': 'monitor', '书签': 'bookmarks' };
/* 右侧动作区按版块切换显隐；主页/仪表无动作 */
var ACTS = { '主页': '', '仪表': '', '待办': 'act-todo', '记账': 'act-exp', '监控': 'act-mon', '书签': 'act-bm' };
var SUBS = {};
var currentView = '主页';

function setSub(k, v) { if (SUBS[k] === v) return; SUBS[k] = v; syncTitle(); }

function syncTitle() {
  /* 主页是书签板：不设顶栏（body.home 切样式），只有「★ 书签」+「▦ 仪表」 */
  document.body.classList.toggle('home', currentView === '主页');
  $('view-ttl').style.display = (currentView === '主页') ? 'none' : '';
  $('view-title').textContent = currentView;
  $('view-sub').textContent = SUBS[currentView] || '';
  var show = ACTS[currentView] || '';
  for (var k in ACTS) {
    if (!ACTS.hasOwnProperty(k) || !ACTS[k]) continue;
    $(ACTS[k]).style.display = (ACTS[k] === show) ? '' : 'none';
  }
  var navBtns = document.querySelectorAll('.nav-item');
  for (var i = 0; i < navBtns.length; i++) {
    navBtns[i].classList.toggle('active', navBtns[i].getAttribute('data-view') === currentView);
  }
  /* 顶部搜索键：仅可搜索的版块显示；非搜索版块收起搜索框 */
  var scfg = SEARCH_VIEW[currentView] || null;
  $('act-search').style.display = scfg ? '' : 'none';
  if (scfg) $('search-input').placeholder = scfg.ph;
  else { $('searchbox').hidden = true; $('act-search').classList.remove('active'); }
}

/* 视图切换：display 硬切，无过渡。先挂新视图再摘旧视图，
   同一板块重复点击直接返回，避免重挂 .active 造成闪一下。 */
function goView(name) {
  if (name === currentView) return;
  var id = VIEW_MAP[name] || 'home';
  var next = $('view-' + id);
  if (next) next.classList.add('active');
  var views = document.querySelectorAll('.view');
  for (var i = 0; i < views.length; i++) { if (views[i] !== next) views[i].classList.remove('active'); }

  currentView = name;
  resetSearchFor(name); /* 切换版块收起搜索、清空过滤 */
  /* 主页只有书签；仪表汇总四路数据 */
  if (name === '主页') loadBookmarks();
  else if (name === '仪表') { loadReminders(); loadLedger(); loadServers(); loadBookmarks(); }
  else if (name === '待办') loadReminders();
  else if (name === '记账') loadLedger();
  else if (name === '监控') loadServers();
  else if (name === '书签') loadBookmarks();
  syncTitle();
}

/* ═════════ 书签 ═════════ */
var BMCOLORS = [
  ['#60a5fa', 'rgba(96,165,250,.15)'],
  ['#22d3ee', 'rgba(34,211,238,.15)'],
  ['#fbbf24', 'rgba(251,191,36,.15)'],
  ['#34d399', 'rgba(52,211,153,.15)'],
  ['#fb7185', 'rgba(251,113,133,.15)'],
  ['#a78bfa', 'rgba(167,139,250,.15)']
];
function bmColor(s) {
  var h = 0;
  s = String(s || '?');
  for (var i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return BMCOLORS[h % BMCOLORS.length];
}
/* 书签副行：只显示描述，无描述则不渲染 */
function bmSub(b) {
  var d = b.description || '';
  return d ? '<small>' + esc(d) + '</small>' : '';
}
function bmCardHtml(b, withActions) {
  var c = bmColor(b.title);
  var letter = esc(String(b.title || '?').slice(0, 1));
  return '<div class="bm-card">' +
    '<a target="_blank" rel="noopener" href="' + esc(b.url) + '" onclick="hitBookmark(' + b.id + ')">' +
    '<span class="bm-icon" style="color:' + c[0] + ';background:' + c[1] + ';border-color:' + c[0] + '55">' + letter + '</span>' +
    '<span class="bm-txt"><b>' + esc(b.title) + '</b>' + bmSub(b) + '</span></a>' +
    (withActions
      ? '<button class="bm-del" title="删除" onclick="delBookmark(this,' + b.id + ')">✕</button>' +
        '<button class="bm-edit" title="编辑" onclick="openEditBookmarkForm(' + b.id + ')">编辑</button>'
      : '') +
    '</div>';
}
function bmGridHtml(list, withActions) {
  var groups = {}, order = [], i, g;
  for (i = 0; i < list.length; i++) {
    g = (list[i].tags && list[i].tags[0]) || '未分类';
    if (!groups[g]) { groups[g] = []; order.push(g); }
    groups[g].push(list[i]);
  }
  return order.map(function (cat) {
    return '<div class="bm-cat">' + esc(cat) + '</div><div class="bm-grid">' +
      groups[cat].map(function (b) { return bmCardHtml(b, withActions); }).join('') +
      '</div>';
  }).join('');
}
function hitBookmark(id) {
  for (var i = 0; i < DB.bookmarks.length; i++) {
    if (DB.bookmarks[i].id === id) DB.bookmarks[i].visit_count = (Number(DB.bookmarks[i].visit_count) || 0) + 1;
  }
  api('/bookmarks/' + id + '/visit', 'POST').catch(function () {});
}
/* 主页：只显示书签 */
function paintHome() {
  var bm = DB.bookmarks || [];
  $('home-bookmarks').innerHTML = bm.length
    ? bmGridHtml(bm, false)
    : '<div class="empty"><i>★</i>暂无书签</div>';
}

/* 仪表：各版块简略消息（点击卡片进对应版块） */
function paintDash() {
  var unp = (DB.reminders || []).filter(function (r) { return !r.processed; });
  var late = unp.filter(function (r) {
    return r.need_remind && r.due_time && r.due_time !== NO_DATE && r.due_time < todayStr();
  }).length;
  $('dash-todo').textContent = unp.length ? unp.length + ' 项' : '全部完成';
  $('dash-todo').className = 'dash-v ' + (unp.length ? 'c-warn' : 'c-ok');
  $('dash-todo-sub').textContent = unp.length ? (late ? late + ' 项逾期' : '暂无逾期') : '';

  var list = DB.servers || [];
  var bad = list.filter(function (s) { return !s.is_success; });
  $('dash-mon').textContent = !list.length ? '无数据' : (bad.length ? bad.length + ' 异常' : '全部正常');
  $('dash-mon').className = 'dash-v ' + (!list.length ? 'muted' : (bad.length ? 'c-bad' : 'c-ok'));
  $('dash-mon-sub').textContent = list.length ? list.length + ' 个服务' : '';

  $('dash-bm').textContent = (DB.bookmarks || []).length + ' 个';
  $('dash-bm').className = 'dash-v c-blue';
  $('dash-bm-sub').textContent = '';

  /* 主页「仪表」键：有未完成待办或服务异常时显示提醒角标 */
  var dash = $('act-dash');
  if (dash) {
    var n = unp.length + bad.length;
    dash.classList.toggle('alert', n > 0);
    var badge = $('dash-badge');
    badge.hidden = (n === 0);
    badge.textContent = n > 99 ? '99+' : (n || '');
  }

  updateDashMoney();
}
function paintBookmarks(list) {
  DB.bookmarks = list;
  var f = list.filter(function (b) {
    return matchQ(FQ.bookmarks, b.title) || matchQ(FQ.bookmarks, b.url) || matchQ(FQ.bookmarks, (b.tags || []).join(' '));
  });
  $('list-bookmarks').innerHTML = f.length
    ? bmGridHtml(f, true)
    : '<div class="empty"><i>★</i>' + (list.length ? '无匹配' : '暂无书签') + '</div>';
  paintHome();
  paintDash();
}
function loadBookmarks(force) {
  if (!force && fresh('bookmarks')) { paintBookmarks(DB.bookmarks); return Promise.resolve(); }
  return api('/bookmarks').then(function (d) { LT.bookmarks = Date.now(); paintBookmarks(d); }).catch(function () {
    failToast();
    $('list-bookmarks').innerHTML = '<div class="empty"><i>★</i>加载失败</div>';
  });
}
function delBookmark(btn, id) {
  var b = null, i;
  for (i = 0; i < DB.bookmarks.length; i++) { if (DB.bookmarks[i].id === id) b = DB.bookmarks[i]; }
  if (!b) return;
  armDelete(btn, function () {
    api('/bookmarks/' + id, 'DELETE').then(function () {
      Toast.success('已删除');
      loadBookmarks(true);
    }).catch(failToast);
  });
}
/* 书签新建/编辑：书签版块内联表单 */
function openBookmarkForm() {
  if (currentView !== '书签') goView('书签');
  $('fb-id').value = '';
  $('fb-heading').textContent = '新建书签';
  $('fb-title').value = '';
  $('fb-url').value = '';
  $('fb-desc').value = '';
  $('fb-tags').value = '';
  openForm('iform-bookmarks', 'fb-title');
}
function openEditBookmarkForm(id) {
  var b = null;
  for (var i = 0; i < DB.bookmarks.length; i++) {
    if (DB.bookmarks[i].id === id) b = DB.bookmarks[i];
  }
  if (!b) return;
  if (currentView !== '书签') goView('书签');
  $('fb-id').value = b.id;
  $('fb-heading').textContent = '编辑书签';
  $('fb-title').value = b.title || '';
  $('fb-url').value = b.url || '';
  $('fb-desc').value = b.description || '';
  $('fb-tags').value = (b.tags || []).join(', ');
  openForm('iform-bookmarks', 'fb-title');
}
/* 链接没写协议时自动补：本机/内网 IP 用 http，其余 https */
function fixUrl(u) {
  u = String(u || '').trim();
  if (!u || /^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return u;
  var local = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([\/?#]|$)/i.test(u);
  return (local ? 'http://' : 'https://') + u;
}
function saveBookmarkForm() {
  var id = $('fb-id').value;
  var title = $('fb-title').value.trim();
  var url = fixUrl($('fb-url').value);
  if (!title) { markInvalid($('fb-title')); Toast.warning('标题必填'); return; }
  if (!url) { markInvalid($('fb-url')); Toast.warning('链接必填'); return; }
  var tagArr = $('fb-tags').value.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t; });
  var body = { title: title, url: url, description: $('fb-desc').value.trim() || null, tags: tagArr };
  if (id) {
    api('/bookmarks/' + id, 'PUT', body).then(function () {
      Toast.success('已保存');
      hideForm('iform-bookmarks');
      loadBookmarks(true);
    }).catch(failToast);
  } else {
    api('/bookmarks', 'POST', body).then(function () {
      Toast.success('已保存书签');
      hideForm('iform-bookmarks');
      loadBookmarks(true);
    }).catch(failToast);
  }
}

/* ═════════ 待办（数据走 /todos） ═════════ */
var CYCLE_TXT = { daily: '每天', weekly: '每周', monthly: '每月', month_start: '每月', yearly: '每年' };
var NO_DATE = '9999-12-31'; /* 后端免提醒哨兵日期，展示层直接跳过 */
function cycleTxt(r) {
  if (!r.recurring || r.cycle_mode === 'none') return '';
  if (r.cycle_mode === 'days') return '每' + (r.cycle_days || 1) + '天';
  return CYCLE_TXT[r.cycle_mode] || '循环';
}
/* 提醒日未到时不允许完成（一次性/循环同理）；无提醒日的随时可完成 */
function todoLocked(r) {
  if (r.processed || !r.need_remind) return false;
  var rd = (r.remind_time && r.remind_time !== NO_DATE) ? String(r.remind_time).slice(0, 10) : '';
  return !!rd && rd > todayStr();
}
/* 提醒是否已到：无提醒日 / 已完成 视为已到，其余按 remind_time <= 今天 */
function remindArrived(r) {
  if (r.processed || !r.need_remind) return true;
  var rd = (r.remind_time && r.remind_time !== NO_DATE) ? String(r.remind_time).slice(0, 10) : '';
  return !rd || rd <= todayStr();
}
function reminderRowHtml(r) {
  var sub = esc(r.content);
  if (r.need_remind && r.due_time && r.due_time !== NO_DATE) {
    var late = !r.processed && r.due_time < todayStr();
    sub += ' · <span class="' + (late ? 'c-bad' : '') + '">到期 ' + esc(r.due_time) + (late ? '（逾期）' : '') + '</span>';
  }
  if (r.need_remind && r.remind_time && r.remind_time !== r.due_time && r.remind_time !== NO_DATE) sub += ' · 提醒 ' + esc(r.remind_time);
  var cyc = cycleTxt(r);
  if (cyc) sub += ' · ' + cyc;
  var locked = todoLocked(r);
  var btitle = r.processed ? '重新打开（撤销完成）'
    : (locked ? '未到提醒日，' + String(r.remind_time).slice(0, 10) + ' 后可完成' : '完成');
  return '<div class="row' + (r.processed ? ' done' : '') + (locked ? ' locked' : '') + '">' +
    '<button class="done-btn' + (r.processed ? ' done' : '') + '" title="' + btitle + '"' +
      (locked ? ' disabled' : '') +
      ' onclick="' + (r.processed ? 'reopenReminder' : 'doneReminder') + '(' + r.id + ', this)">✓</button>' +
    '<span class="grow">' + esc(r.title || r.content) + '<small class="sub">' + sub + '</small></span>' +
    '<button class="link blue" onclick="openEditReminderForm(' + r.id + ')">编辑</button>' +
    '<button class="link bad" onclick="delReminder(this,' + r.id + ')">删除</button>' +
    '</div>';
}
var _showFuture = false; /* 是否展开「未到提醒」分组 */
function toggleFutureReminders() { _showFuture = !_showFuture; paintReminders(DB.reminders); }
function paintReminders(list) {
  DB.reminders = list;
  var q = FQ.reminders;
  var matches = list.filter(function (r) { return matchQ(q, r.title) || matchQ(q, r.content); });
  /* 分组：无提醒（前台常显）/ 已到提醒（前台）/ 未到提醒（默认收起） */
  var noRemind = [], due = [], future = [];
  matches.forEach(function (r) {
    if (!r.need_remind) noRemind.push(r);
    else if (remindArrived(r)) due.push(r);
    else future.push(r);
  });

  var parts = [];
  if (noRemind.length) parts.push('<div class="tgroup">待办</div>' + noRemind.map(reminderRowHtml).join(''));
  if (due.length) parts.push('<div class="tgroup">提醒</div>' + due.map(reminderRowHtml).join(''));
  if (future.length) {
    if (_showFuture || q) {
      parts.push('<div class="tgroup">未到提醒</div>' + future.map(reminderRowHtml).join(''));
    } else {
      parts.push('<button class="tgroup-toggle" onclick="toggleFutureReminders()"><span>未到提醒 · ' + future.length + ' 项</span><span class="link">展开 ›</span></button>');
    }
  }

  $('list-reminders').innerHTML = parts.length
    ? parts.join('')
    : '<div class="empty"><i>✓</i>' + (list.length ? '无匹配' : '暂无待办') + '</div>';

  var unp = list.filter(function (r) { return !r.processed; }).length;
  setSub('待办', list.length ? (unp + ' 项未完成 / 共 ' + list.length + ' 项') : '');
  paintDash();
}
function loadReminders(force) {
  if (!force && fresh('reminders')) { paintReminders(DB.reminders); return Promise.resolve(); }
  return api('/todos').then(function (d) { LT.reminders = Date.now(); paintReminders(d); }).catch(function () {
    failToast();
    $('list-reminders').innerHTML = '<div class="empty"><i>✓</i>加载失败</div>';
  });
}
/* 就地替换列表中的一条，避免完成后为了刷新再发一次 GET */
function updateReminderLocal(r) {
  for (var i = 0; i < DB.reminders.length; i++) {
    if (DB.reminders[i].id === r.id) { DB.reminders[i] = r; return; }
  }
  DB.reminders.push(r);
}
function doneReminder(id, btn) {
  if (btn) btn.classList.add('busy'); /* 立即反馈，别等网络 */
  api('/todos/' + id + '/processed', 'PUT').then(function (r) {
    if (btn) btn.classList.remove('busy');
    if (r && typeof r.id !== 'undefined') {
      /* 用 PUT 返回的对象就地更新，省掉第二次 GET */
      updateReminderLocal(r);
      LT.reminders = Date.now();
      if (r.recurring && r.due_time) Toast.success('已完成，顺延到 ' + String(r.due_time).slice(0, 10));
      else Toast.success('已完成');
      paintReminders(DB.reminders);
    } else {
      loadReminders(true);
    }
  }).catch(function () {
    if (btn) btn.classList.remove('busy');
    failToast();
  });
}
function reopenReminder(id, btn) {
  if (btn) btn.classList.add('busy');
  api('/todos/' + id, 'PUT', { processed: false }).then(function (r) {
    if (btn) btn.classList.remove('busy');
    if (r && typeof r.id !== 'undefined') {
      updateReminderLocal(r);
      LT.reminders = Date.now();
      Toast.success('已重新打开');
      paintReminders(DB.reminders);
    } else {
      loadReminders(true);
    }
  }).catch(function () {
    if (btn) btn.classList.remove('busy');
    failToast();
  });
}

/* 待办新建/编辑：待办版块内联表单（是否提醒勾选后展开日期区） */
function openReminderForm() {
  if (currentView !== '待办') goView('待办');
  $('fr-id').value = '';
  $('fr-heading').textContent = '新建待办';
  $('fr-title').value = '';
  $('fr-content').value = '';
  $('fr-need').checked = false;
  $('fr-remind-box').hidden = true;
  setDate('fr-due', todayStr());
  setDate('fr-remind', '');
  setISelect('fr-cycle', 'once');
  openForm('iform-reminders', 'fr-title');
}
function openEditReminderForm(id) {
  var r = null;
  for (var i = 0; i < DB.reminders.length; i++) {
    if (DB.reminders[i].id === id) r = DB.reminders[i];
  }
  if (!r) return;
  if (currentView !== '待办') goView('待办');
  $('fr-id').value = r.id;
  $('fr-heading').textContent = '编辑待办';
  $('fr-title').value = r.title || '';
  $('fr-content').value = r.content || '';
  var need = !!r.need_remind;
  $('fr-need').checked = need;
  $('fr-remind-box').hidden = !need;
  setDate('fr-due', (r.due_time && r.due_time !== NO_DATE) ? String(r.due_time).slice(0, 10) : '');
  setDate('fr-remind', (r.remind_time && r.remind_time !== NO_DATE) ? String(r.remind_time).slice(0, 10) : '');
  var cyc = r.cycle_mode || 'once';
  if (!/^(once|daily|weekly|monthly|yearly)$/.test(cyc)) cyc = 'once';
  setISelect('fr-cycle', cyc);
  openForm('iform-reminders', 'fr-title');
}
function saveReminderForm() {
  var id = $('fr-id').value;
  var title = $('fr-title').value.trim(), content = $('fr-content').value.trim();
  if (!title) { markInvalid($('fr-title')); Toast.warning('标题必填'); return; }
  if (!content) { markInvalid($('fr-content')); Toast.warning('内容必填'); return; }
  var body = { title: title, content: content, need_remind: $('fr-need').checked };
  if (body.need_remind) {
    var due = dateVal('fr-due'), rem = dateVal('fr-remind');
    if (due) body.due_time = due.slice(0, 10);
    if (rem) body.remind_time = rem.slice(0, 10);
    body.cycle_mode = $('fr-cycle').value || 'once';
  }
  var done = function () {
    Toast.success(id ? '已保存' : '已保存待办');
    hideForm('iform-reminders');
    loadReminders(true);
  };
  if (id) api('/todos/' + id, 'PUT', body).then(done).catch(failToast);
  else api('/todos', 'POST', body).then(done).catch(failToast);
}
function delReminder(btn, id) {
  var r = null, i;
  for (i = 0; i < DB.reminders.length; i++) { if (DB.reminders[i].id === id) r = DB.reminders[i]; }
  if (!r) return;
  armDelete(btn, function () {
    api('/todos/' + id, 'DELETE').then(function () {
      Toast.success('已删除');
      loadReminders(true);
    }).catch(failToast);
  });
}

/* ═════════ 记账 ═════════ */
function moneyCls(t) { return t === 'income' ? 'c-ok' : 'c-bad'; }
function moneySign(t, a) { return (t === 'income' ? '+' : '-') + '¥' + Number(a).toFixed(2); }

/* ═════════ 记账（内联表单） ═════════ */
function delExpense(btn, id) {
  var e = null, i;
  for (i = 0; i < DB.ledger.length; i++) { if (DB.ledger[i].id === id) e = DB.ledger[i]; }
  if (!e) return;
  armDelete(btn, function () {
    api('/ledger/' + id, 'DELETE').then(function () {
      Toast.success('已删除');
      loadLedger(true);
    }).catch(failToast);
  });
}
/* 利息仅还款（debt_out）时显示 */
function syncInterest() {
  $('fe-interest-wrap').hidden = ($('fe-type').value !== 'debt_out');
}
function openExpenseForm() {
  if (currentView !== '记账') goView('记账');
  hideForm('iform-asset');
  $('fe-id').value = '';
  $('fe-heading').textContent = '新建记账';
  setISelect('fe-type', 'expense');
  $('fe-amount').value = '';
  $('fe-interest').value = '';
  $('fe-desc').value = '';
  $('fe-category').value = '';
  setDate('fe-date', todayStr());
  syncInterest();
  openForm('iform-expenses', 'fe-amount');
}
/* 编辑账单：整行回填（后端 PUT 要完整对象，notes 从缓存原样带回） */
function openEditExpenseForm(id) {
  var e = null;
  for (var i = 0; i < DB.ledger.length; i++) {
    if (DB.ledger[i].id === id) e = DB.ledger[i];
  }
  if (!e) return;
  if (currentView !== '记账') goView('记账');
  hideForm('iform-asset');
  $('fe-id').value = e.id;
  $('fe-heading').textContent = '编辑账单';
  setISelect('fe-type', e.record_type || 'expense');
  $('fe-amount').value = (e.amount != null ? e.amount : '');
  $('fe-interest').value = e.interest || '';
  $('fe-desc').value = e.item || '';
  $('fe-category').value = e.category || '';
  setDate('fe-date', String(e.record_date || '').slice(0, 10));
  syncInterest();
  openForm('iform-expenses', 'fe-amount');
}
function saveExpenseForm() {
  var id = $('fe-id').value;
  var amount = parseFloat($('fe-amount').value);
  if (!(amount > 0)) { markInvalid($('fe-amount')); Toast.warning('金额需大于 0'); return; }
  var date = dateVal('fe-date');
  var body = {
    item: $('fe-desc').value.trim() || '支出',
    amount: amount,
    interest: parseFloat($('fe-interest').value) || 0,
    record_type: $('fe-type').value,
    record_date: date ? date.slice(0, 10) : todayStr(),
    category: $('fe-category').value.trim() || null
  };
  if (id) {
    for (var i = 0; i < DB.ledger.length; i++) {
      if (String(DB.ledger[i].id) === String(id)) { body.notes = DB.ledger[i].notes || null; break; }
    }
    api('/ledger/' + id, 'PUT', body).then(function () {
      Toast.success('已保存');
      hideForm('iform-expenses');
      loadLedger(true);
    }).catch(failToast);
  } else {
    api('/ledger', 'POST', body).then(function () {
      Toast.success('已记账');
      hideForm('iform-expenses');
      loadLedger(true);
    }).catch(failToast);
  }
}
/* 余额/负债校准：记账版块内联小表单（对账用，流水不动） */
function openAssetForm(which) {
  if (currentView !== '记账') goView('记账');
  var isAsset = (which === 'asset');
  hideForm('iform-expenses');
  $('fa-which').value = which;
  $('fa-heading').textContent = isAsset ? '校准余额' : '校准负债';
  $('fa-amount').value = '';
  openForm('iform-asset', 'fa-amount');
}
function saveAssetForm() {
  var which = $('fa-which').value || 'asset';
  var raw = $('fa-amount').value.trim();
  if (raw === '') { markInvalid($('fa-amount')); return; }
  var amount = parseFloat(raw);
  if (!isFinite(amount)) { markInvalid($('fa-amount')); Toast.warning('金额不对'); return; }
  api('/' + which, 'POST', { amount: amount }).then(function () {
    Toast.success('已校准');
    hideForm('iform-asset');
    loadLedger(true);
  }).catch(failToast);
}
function paintLedger(list) {
  DB.ledger = list;
  var f = list.filter(function (e) { return matchQ(FQ.expenses, e.item) || matchQ(FQ.expenses, e.category); }).slice(0, 100);
  $('list-expenses').innerHTML = f.length
    ? f.map(function (e) {
        return '<div class="row"><span class="grow">' + esc(e.item) +
          '<small class="sub">' + esc(e.record_date || '') + (e.category ? ' · ' + esc(e.category) : '') + '</small></span>' +
          '<span class="mono ' + moneyCls(e.record_type) + '">' + moneySign(e.record_type, e.amount) + '</span>' +
          '<button class="link blue" onclick="openEditExpenseForm(' + e.id + ')">编辑</button>' +
          '<button class="link bad" onclick="delExpense(this,' + e.id + ')">删除</button></div>';
      }).join('')
    : '<div class="empty"><i>¥</i>' + (list.length ? '无匹配' : '暂无账单') + '</div>';
  setSub('记账', list.length ? (list.length + ' 笔流水') : '');
  paintDash();
}
/* 余额/负债只供仪表「记账」卡用（顶栏的 asset-total / liability-total 已移除） */
var MONEY = { asset: null, liab: null };
function paintTotals() {
  api('/asset').then(function (a) {
    MONEY.asset = Number(a.amount || 0);
    updateDashMoney();
  }).catch(function () {});
  api('/liability').then(function (l) {
    MONEY.liab = Number(l.amount || 0);
    updateDashMoney();
  }).catch(function () {});
}
/* 仪表「记账」卡：余额 + 负债（值来自 paintTotals，缓存复用） */
function updateDashMoney() {
  var m = $('dash-money');
  if (!m) return;
  m.textContent = MONEY.asset == null ? '–' : '¥' + MONEY.asset.toFixed(2);
  m.className = 'dash-v ' + (MONEY.asset == null ? 'muted' : (MONEY.asset >= 0 ? 'c-ok' : 'c-bad'));
  $('dash-money-sub').textContent = MONEY.liab == null ? '' : ('负债 ¥' + MONEY.liab.toFixed(2));
}
function loadLedger(force) {
  if (!force && fresh('ledger')) { paintLedger(DB.ledger); return Promise.resolve(); }
  return api('/ledger').then(function (d) {
    LT.ledger = Date.now();
    paintLedger(d);
    paintTotals();
  }).catch(function () {
    failToast();
    $('list-expenses').innerHTML = '<div class="empty"><i>¥</i>加载失败</div>';
  });
}
/* ═════════ 监控 ═════════ */
function paintServers(list) {
  DB.servers = list;
  var bad = 0, i;
  for (i = 0; i < list.length; i++) {
    if (!list[i].is_success) bad++;
  }
  var okTxt = list.length ? (bad ? bad + ' 异常' : '全部正常') : '无数据';
  var okCls = list.length ? (bad ? 'c-bad' : 'c-ok') : 'muted';
  $('server-summary').textContent = okTxt;
  $('server-summary').className = okCls;
  var fs = list.filter(function (s) {
    return matchQ(FQ.servers, s.server_name) || matchQ(FQ.servers, s.service_name) || matchQ(FQ.servers, s.content);
  }).slice(0, 100);
  $('list-servers').innerHTML = fs.length
    ? fs.map(function (s) {
        return '<div class="row"><span class="dot ' + (s.is_success ? 'ok' : 'bad') + '"></span>' +
          '<span class="grow">' + esc(s.server_name) + ' / ' + esc(s.service_name) +
          '<small class="sub">' + esc(s.content || '') + ' · ' + esc(s.time || '') + '</small></span>' +
          '<span class="' + (s.is_success ? 'c-ok' : 'c-bad') + '">' + (s.is_success ? '正常' : '异常') + '</span></div>';
      }).join('')
    : '<div class="empty"><i>●</i>' + (list.length ? '无匹配' : '无数据') + '</div>';
  setSub('监控', list.length ? okTxt : '');
  paintDash();
}
function loadServers(force) {
  if (!force && fresh('servers')) { paintServers(DB.servers); return Promise.resolve(); }
  return api('/server/status?limit=50').then(function (d) { LT.servers = Date.now(); paintServers(d); }).catch(function () {
    failToast();
    $('list-servers').innerHTML = '<div class="empty"><i>●</i>加载失败</div>';
  });
}

/* ═════════ 菜单/导航/搜索绑定与启动 ═════════ */
/* 菜单（导航 + 换壁纸，仅非主页顶栏显示）：点外部、选导航、Esc 关闭 */
var _menuOpen = false;
function setMenu(open) {
  _menuOpen = open;
  $('menu').classList.toggle('open', open);
  var trs = document.querySelectorAll('.menu-trigger');
  for (var i = 0; i < trs.length; i++) trs[i].classList.toggle('active', open);
}
function toggleMenu() { setMenu(!_menuOpen); }
function closeMenu() { if (_menuOpen) setMenu(false); }
document.addEventListener('click', function (e) {
  if (!_menuOpen) return;
  var t = e.target;
  if ($('menu').contains(t) || (t.closest && t.closest('.menu-trigger'))) return;
  closeMenu();
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

var navBtns = document.querySelectorAll('.nav-item[data-view]');
for (var _i = 0; _i < navBtns.length; _i++) {
  navBtns[_i].addEventListener('click', function () {
    goView(this.getAttribute('data-view'));
    closeMenu();
  });
}

/* 顶部搜索控件：四个版块共用一个搜索框（按当前版块过滤，输入即本地重画） */
var SEARCH_VIEW = {
  '待办': { ph: '搜索标题或内容…', key: 'reminders', paint: function () { paintReminders(DB.reminders); } },
  '记账': { ph: '搜索账单或分类…', key: 'expenses', paint: function () { paintLedger(DB.ledger); } },
  '监控': { ph: '搜索服务或内容…', key: 'servers', paint: function () { paintServers(DB.servers); } },
  '书签': { ph: '搜索标题 / 网址 / 标签…', key: 'bookmarks', paint: function () { paintBookmarks(DB.bookmarks); } }
};
function toggleSearchBar() {
  var box = $('searchbox');
  var inp = $('search-input');
  var btn = $('act-search');
  var show = box.hidden;
  box.hidden = !show;
  btn.classList.toggle('active', show);
  if (show) {
    try { inp.focus({ preventScroll: true }); } catch (_e) { inp.focus(); }
  } else {
    inp.value = '';
    var cfg = SEARCH_VIEW[currentView];
    if (cfg) { FQ[cfg.key] = ''; cfg.paint(); }
  }
}
/* 切换版块：收起搜索、清空过滤，避免用上一版块的词过滤新列表 */
function resetSearchFor(name) {
  var cfg = SEARCH_VIEW[name];
  $('searchbox').hidden = true;
  $('act-search').classList.remove('active');
  $('search-input').value = '';
  if (cfg) { FQ[cfg.key] = ''; $('search-input').placeholder = cfg.ph; }
}
$('search-input').addEventListener('input', function () {
  var cfg = SEARCH_VIEW[currentView];
  if (!cfg) return;
  FQ[cfg.key] = this.value.trim().toLowerCase();
  cfg.paint();
});

/* 内联表单绑定：保存/取消/关闭 + 回车保存 + Esc 关闭 + 条件字段 */
function bindForm(wrapId, saveId, cancelId, closeId, saveFn) {
  $(saveId).addEventListener('click', saveFn);
  $(cancelId).addEventListener('click', function () { hideForm(wrapId); });
  $(closeId).addEventListener('click', function () { hideForm(wrapId); });
  wireFormKeys(wrapId, saveFn);
}
bindForm('iform-reminders', 'fr-save', 'fr-cancel', 'fr-close', saveReminderForm);
bindForm('iform-expenses', 'fe-save', 'fe-cancel', 'fe-close', saveExpenseForm);
bindForm('iform-asset', 'fa-save', 'fa-cancel', 'fa-close', saveAssetForm);
bindForm('iform-bookmarks', 'fb-save', 'fb-cancel', 'fb-close', saveBookmarkForm);
$('fr-need').addEventListener('change', function () { $('fr-remind-box').hidden = !this.checked; });
$('fe-type').addEventListener('change', syncInterest);

/* ── 自定义日期选择（不用原生日期控件）：字段为按钮，日历面板插到当前行下方 ── */
var _pick = { field: null, y: 0, m: 0 };
function dateVal(id) { return $(id).getAttribute('data-value') || ''; }
function dateLabel(v) {
  var d = new Date(v + 'T00:00:00');
  var w = '日一二三四五六'.charAt(d.getDay());
  if (v === todayStr()) return '今天 · 周' + w;
  return v + ' 周' + w;
}
function setDate(id, v) {
  var el = $(id);
  el.setAttribute('data-value', v || '');
  el.querySelector('.idate-txt').textContent = v ? dateLabel(v) : (el.getAttribute('data-ph') || '选择日期');
  el.classList.toggle('on', !!v);
  el.classList.remove('invalid');
}
function renderPicker() {
  var y = _pick.y, m = _pick.m;
  var start = (new Date(y, m, 1).getDay() + 6) % 7; /* 周一第一列 */
  var days = new Date(y, m + 1, 0).getDate();
  var prevDays = new Date(y, m, 0).getDate();
  var sel = _pick.field ? dateVal(_pick.field) : '';
  var today = todayStr();
  var cells = [];
  for (var i = 0; i < 42; i++) {
    var dn, dim = false, off = 0;
    if (i < start) { dn = prevDays - start + 1 + i; dim = true; off = -1; }
    else if (i >= start + days) { dn = i - start - days + 1; dim = true; off = 1; }
    else dn = i - start + 1;
    var iso = new Date(y, m + off, dn).toLocaleDateString('sv-SE');
    cells.push('<button type="button" class="ip-day' + (dim ? ' dim' : '') +
      (iso === today ? ' today' : '') + (iso === sel ? ' sel' : '') +
      '" data-d="' + iso + '">' + dn + '</button>');
  }
  $('ipicker').innerHTML =
    '<div class="ip-head"><button type="button" class="ip-nav" data-nav="-1">‹</button>' +
    '<span class="ip-title">' + y + '年' + (m + 1) + '月</span>' +
    '<button type="button" class="ip-nav" data-nav="1">›</button></div>' +
    '<div class="ip-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
    '<div class="ip-days">' + cells.join('') + '</div>' +
    '<div class="ip-quick"><button type="button" data-quick="today">今天</button>' +
    '<button type="button" data-quick="tomorrow">明天</button>' +
    '<button type="button" data-quick="clear">清空</button></div>';
}
function openPicker(fieldId) {
  var el = $(fieldId);
  var panel = $('ipicker');
  var cur = dateVal(fieldId);
  var base = cur ? new Date(cur + 'T00:00:00') : new Date();
  _pick.field = fieldId;
  _pick.y = base.getFullYear();
  _pick.m = base.getMonth();
  panel.hidden = false;
  el.classList.add('open');
  renderPicker();
  positionPicker();
}
/* 浮层贴住日期键：默认在下方，放不下改上方，并夹在可视区内 */
function positionPicker() {
  if (!_pick.field) return;
  var el = $(_pick.field), panel = $('ipicker');
  if (!el || panel.hidden) return;
  var r = el.getBoundingClientRect();
  var vv = window.visualViewport;
  var vw = window.innerWidth;
  var vt = vv ? (vv.offsetTop || 0) : 0;
  var vh = vv ? vv.height : window.innerHeight;
  var pw = panel.offsetWidth, ph = panel.offsetHeight;
  var gap = 6;
  var below = r.bottom + gap;
  var above = r.top - gap - ph;
  var top = (below + ph <= vt + vh - 8 || above < vt + 8) ? below : above;
  top = Math.max(vt + 8, Math.min(top, vt + vh - ph - 8));
  var left = Math.max(8, Math.min(r.left, vw - pw - 8));
  panel.style.top = Math.round(top) + 'px';
  panel.style.left = Math.round(left) + 'px';
}
function closePicker() {
  var panel = $('ipicker');
  if (panel) panel.hidden = true;
  if (_pick.field) {
    var el = $(_pick.field);
    if (el) el.classList.remove('open');
  }
  _pick.field = null;
}
function applyDate(v) {
  var id = _pick.field;
  if (id) setDate(id, v);
  closePicker();
}
$('ipicker').addEventListener('click', function (e) {
  /* 面板内点击不冒泡到 document 的“点外收起”，否则切月重绘后会被误判为外点 */
  e.stopPropagation();
  var t = e.target;
  var nav = t.getAttribute && t.getAttribute('data-nav');
  if (nav) {
    _pick.m += Number(nav);
    if (_pick.m < 0) { _pick.m = 11; _pick.y--; }
    if (_pick.m > 11) { _pick.m = 0; _pick.y++; }
    renderPicker();
    return;
  }
  var day = t.getAttribute && t.getAttribute('data-d');
  if (day) { applyDate(day); return; }
  var q = t.getAttribute && t.getAttribute('data-quick');
  if (q === 'today') applyDate(todayStr());
  else if (q === 'tomorrow') {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    applyDate(d.toLocaleDateString('sv-SE'));
  } else if (q === 'clear') applyDate('');
});
var dateBtns = document.querySelectorAll('.idate');
for (var _d = 0; _d < dateBtns.length; _d++) {
  dateBtns[_d].addEventListener('click', function () {
    if (_pick.field === this.id) { closePicker(); return; }
    openPicker(this.id);
  });
}
/* 点面板与日期键之外任意处收起日历 */
document.addEventListener('click', function (e) {
  if (!_pick.field) return;
  var t = e.target;
  if (!t || !t.isConnected) return; /* 已重绘替换掉的节点：视为面板内，别误关 */
  if ($('ipicker').contains(t)) return;
  if (t.closest && t.closest('.idate')) return; /* 点在日期键或其内部文字（span）上 */
  closePicker();
});
/* 浮层跟随：弹窗内滚动 / 页面滚动时重算位置 */
window.addEventListener('scroll', function () { positionPicker(); positionISelect(); }, true);

/* ── 自定义下拉（替代原生 select）：#id 为隐藏值输入，.isel 为界面 ── */
var _isel = null;
function iselText(sel, v) {
  var opts = sel.querySelectorAll('.isel-opt');
  for (var i = 0; i < opts.length; i++) {
    if (opts[i].getAttribute('data-value') === v) return opts[i].textContent;
  }
  return '';
}
function syncISelect(id) {
  var sel = $(id + '-sel');
  if (!sel) return;
  var v = $(id).value;
  sel.querySelector('.isel-txt').textContent = iselText(sel, v);
  var opts = sel.querySelectorAll('.isel-opt');
  for (var i = 0; i < opts.length; i++) {
    opts[i].classList.toggle('sel', opts[i].getAttribute('data-value') === v);
  }
}
function setISelect(id, v) { $(id).value = v; syncISelect(id); }
function closeISelect() {
  if (!_isel) return;
  _isel.querySelector('.isel-menu').hidden = true;
  _isel.classList.remove('open');
  _isel = null;
}
/* 浮层贴在键下方，放不下自动翻上并夹在可视区内 */
function positionISelect() {
  if (!_isel) return;
  var btn = _isel.querySelector('.isel-btn');
  var menu = _isel.querySelector('.isel-menu');
  if (!btn || menu.hidden) return;
  var r = btn.getBoundingClientRect();
  var vv = window.visualViewport;
  var vt = vv ? (vv.offsetTop || 0) : 0;
  var vh = vv ? vv.height : window.innerHeight;
  menu.style.minWidth = Math.round(r.width) + 'px';
  var mw = menu.offsetWidth, mh = menu.offsetHeight;
  var below = r.bottom + 6, above = r.top - 6 - mh;
  var top = (below + mh <= vt + vh - 8 || above < vt + 8) ? below : above;
  top = Math.max(vt + 8, Math.min(top, vt + vh - mh - 8));
  var left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8));
  menu.style.top = Math.round(top) + 'px';
  menu.style.left = Math.round(left) + 'px';
}
function toggleISelect(selId) {
  var sel = $(selId);
  var wasOpen = (_isel === sel);
  closeISelect();
  if (wasOpen) return;
  _isel = sel;
  sel.querySelector('.isel-menu').hidden = false;
  sel.classList.add('open');
  positionISelect();
}
/* 选中选项：写回隐藏值 + 触发 change；点别处收起 */
document.addEventListener('click', function (e) {
  var t = e.target;
  var opt = t && t.closest && t.closest('.isel-opt');
  if (opt) {
    var sel = opt.closest('.isel');
    var id = sel.id.replace(/-sel$/, '');
    setISelect(id, opt.getAttribute('data-value'));
    $(id).dispatchEvent(new Event('change'));
    closeISelect();
    return;
  }
  if (_isel && !(t && t.closest && t.closest('.isel'))) closeISelect();
});

/* ── 弹窗键盘适配：遮罩高度/位置实时贴合 visualViewport（键盘弹起后只占键盘上方），
   布局视口不动（页面不重排、背景不跳），聚焦项再滚进遮罩可视区 ── */
function fitViewport(wrap) {
  var vv = window.visualViewport;
  var list = wrap ? [wrap] : document.querySelectorAll('.iform-wrap');
  for (var i = 0; i < list.length; i++) {
    var w = list[i];
    if (!w || !w.style || w.hidden) continue;
    if (vv) {
      w.style.setProperty('--vvt', Math.round(vv.offsetTop || 0) + 'px');
      w.style.setProperty('--vvh', Math.round(vv.height) + 'px');
    } else {
      w.style.removeProperty('--vvt');
      w.style.removeProperty('--vvh');
    }
  }
}
function revealField(el) {
  if (!el || document.activeElement !== el) return;
  var sc = el.closest('.iform-scroll, .panel-scroll, .home-scroll');
  var vv = window.visualViewport;
  if (!vv || !sc) return;
  var r = el.getBoundingClientRect();
  var visTop = vv.offsetTop || 0;
  var visBottom = visTop + vv.height;
  /* 手动滚容器，不用 scrollIntoView（避免连带滚动页面/可视视口） */
  var over = r.bottom - visBottom + 12;
  if (over > 0) sc.scrollTop += over;
  var under = visTop + 8 - r.top;
  if (under > 0) sc.scrollTop -= under;
}
document.addEventListener('focusin', function (e) {
  var t = e.target;
  if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  setTimeout(function () { fitViewport(); resetPageScroll(); revealField(t); }, 60);
  setTimeout(function () { fitViewport(); resetPageScroll(); revealField(t); }, 320);
});
document.addEventListener('focusout', function () {
  setTimeout(resetPageScroll, 150);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', function () {
    fitViewport();
    positionPicker();
    positionISelect();
    resetPageScroll();
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) setTimeout(function () { revealField(ae); }, 60);
  });
  window.visualViewport.addEventListener('scroll', function () { fitViewport(); positionPicker(); positionISelect(); resetPageScroll(); });
}
window.addEventListener('resize', function () { fitViewport(); positionPicker(); positionISelect(); resetPageScroll(); });
window.addEventListener('orientationchange', function () { setTimeout(function () { fitViewport(); positionPicker(); positionISelect(); }, 200); });
window.addEventListener('scroll', resetPageScroll);

syncTitle();
loadReminders(); loadLedger(); loadServers(); loadBookmarks();

/* ═════════ 壁纸：自有图接口，加载提示 → 壁纸淡入 → 内容登场（不再有全屏调色层，省性能） ═════════ */
var _bgShown = false;
function showContent() {
  if (_bgShown) return;
  _bgShown = true;
  document.body.classList.add('bg-ready');
  setTimeout(function () {
    document.body.classList.add('content-ready');
    /* boot：内容入场动画只跑一次，跑完摘掉，板块切换不再闪 */
    document.body.classList.add('boot');
    setTimeout(function () { document.body.classList.remove('boot'); }, 600);
    _boot = false; /* 首屏结束，之后的请求才显示「加载中…」 */
  }, 2100);
}
/* 壁纸跟色：只跟主题色到 --accent；玻璃与文字固定暗调，不跟头走 */
function applyTheme(thHex) {
  if (thHex) document.documentElement.style.setProperty('--accent', thHex);
}
var _bgObj = null;
var _bgBusy = false;
function fetchBg(initial) {
  if (_bgBusy) return;
  _bgBusy = true;
  /* 壁纸加载不显示全局「加载中…」（换壁纸只淡出→换图，不给加载反馈） */
  var url = API_BASE + '?_t=' + Date.now();
  /* 同一次 fetch 既读色头又取图：no-store 下分两次请求会拿到两张不同的图 */
  fetch(url).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    applyTheme(res.headers.get('X-Theme-Color-Hex'));
    return res.blob();
  }).then(function (blob) {
    if (_bgObj) URL.revokeObjectURL(_bgObj);
    _bgObj = URL.createObjectURL(blob);
    var el = $('anime-bg');
    el.style.backgroundImage = 'url("' + _bgObj + '")';
    el.style.opacity = '';
    if (initial) showContent();
    _bgBusy = false;
  }).catch(function () {
    var el = $('anime-bg');
    el.style.opacity = '';
    if (initial) showContent();
    _bgBusy = false;
  });
  if (initial) setTimeout(showContent, 5000);
}
function refreshBg() {
  $('anime-bg').style.opacity = '0';
  fetchBg(false);
}
fetchBg(true);
