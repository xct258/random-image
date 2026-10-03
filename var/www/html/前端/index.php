<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>控制台</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="./css/style.css?v=<?php echo filemtime(__DIR__ . '/css/style.css'); ?>">
  <script src="./js/notify.js?v=<?php echo filemtime(__DIR__ . '/js/notify.js'); ?>" defer></script>
  <script src="./js/app.js?v=<?php echo filemtime(__DIR__ . '/js/app.js'); ?>" defer></script>
</head>
<body>
<?php
  // 壁纸接口地址（app.js 的 refreshBg 使用）；轻提示走 ./js/notify.js（Toast）
  $apiBase = 'https://random-image.xct258.top/';
?>
  <!-- ═══ 全屏壁纸层 + 加载提示（壁纸就绪后淡出） ═══ -->
  <div id="anime-bg"></div>
  <div id="bg-loader"><span class="spin"></span><span>壁纸加载中…</span></div>
  <!-- ═══ 全局请求加载指示（有后端请求在飞时显示） ═══ -->
  <div id="net-loading" aria-live="polite"><span class="spin"></span><span>加载中…</span></div>

  <!-- ═══ 应用外壳：单张内容卡片 = 卡片头（标题/动作/菜单）+ 状态磁贴 + 视图内容 ═══ -->
  <div class="app">
    <main class="stage">
      <!-- ═══ 卡片头：标题/摘要 + 按版块切换的动作区 + 菜单（导航/换壁纸） ═══ -->
      <header class="apptop">
        <div class="ttl" id="view-ttl">
          <h1 id="view-title">主页</h1>
          <small id="view-sub"></small>
        </div>
        <div class="acts">
          <span class="searchbox" id="searchbox" hidden><input id="search-input" class="search" type="text" placeholder="搜索…"></span>
          <button class="icon-btn" id="act-search" title="搜索" style="display:none" onclick="toggleSearchBar()">🔍</button>
          <button class="btn primary" id="act-todo" onclick="openReminderForm()" style="display:none">+ 添加</button>
          <span id="act-exp" class="chips" style="display:none">
            <button class="btn primary" onclick="openExpenseForm()">+ 记账</button>
          </span>
          <span id="act-mon" class="chip mono" style="display:none"><span id="server-summary">—</span></span>
          <button class="btn primary" id="act-bm" onclick="openBookmarkForm()" style="display:none">+ 添加</button>
        </div>
        <button class="icon-btn menu-trigger" id="menu-btn" title="菜单" aria-haspopup="true" onclick="toggleMenu()">☰</button>
        <div class="menu" id="menu">
          <nav class="nav" id="nav">
            <button class="nav-item" data-view="主页"><i>⌂</i><span>主页</span></button>
            <button class="nav-item" data-view="仪表"><i>▦</i><span>仪表</span></button>
            <button class="nav-item" data-view="待办"><i>✓</i><span>待办</span></button>
            <button class="nav-item" data-view="记账"><i>¥</i><span>记账</span></button>
            <button class="nav-item" data-view="监控"><i>●</i><span>监控</span></button>
            <button class="nav-item" data-view="书签"><i>★</i><span>书签</span></button>
          </nav>
          <div class="menu-sep"></div>
          <button class="nav-item" onclick="refreshBg();closeMenu()"><i>🎲</i><span>换壁纸</span></button>
        </div>
      </header>

      <!-- ═══ 视图内容：六个视图叠放，硬切显隐 ═══ -->
      <div class="views">

        <section id="view-home" class="view active">
          <!-- 段头固定在书签滚动区上方（不随书签滚动） -->
          <div class="home-head">
            <div class="sec-head">
              <span><b class="c-blue">★</b> 书签</span>
              <span class="sec-acts">
                <button class="chip" id="act-dash" title="仪表盘" onclick="goView('仪表')">▦ 仪表<span class="badge" id="dash-badge" hidden></span></button>
              </span>
            </div>
          </div>
          <div class="home-scroll custom-scroll">
            <!-- 书签：主页唯一内容 -->
            <div class="sec-body" id="home-bookmarks"><div class="empty"><i>★</i>加载中…</div></div>
          </div>
        </section>

        <!-- ═══ 仪表：各版块简略消息，点击卡片进对应版块 ═══ -->
        <section id="view-dash" class="view">
          <div class="dash-scroll custom-scroll">
            <div class="dash-grid">
              <button class="dash-card" onclick="goView('待办')">
                <span class="dash-h"><i class="c-warn">✓</i>待办</span>
                <b class="dash-v" id="dash-todo">–</b>
                <small class="dash-s" id="dash-todo-sub"></small>
              </button>
              <button class="dash-card" onclick="goView('记账')">
                <span class="dash-h"><i class="c-ok">¥</i>记账</span>
                <b class="dash-v" id="dash-money">–</b>
                <small class="dash-s" id="dash-money-sub"></small>
              </button>
              <button class="dash-card" onclick="goView('监控')">
                <span class="dash-h"><i class="c-cyan">●</i>监控</span>
                <b class="dash-v" id="dash-mon">–</b>
                <small class="dash-s" id="dash-mon-sub"></small>
              </button>
              <button class="dash-card" onclick="goView('书签')">
                <span class="dash-h"><i class="c-blue">★</i>书签</span>
                <b class="dash-v" id="dash-bm">–</b>
                <small class="dash-s" id="dash-bm-sub"></small>
              </button>
            </div>
          </div>
        </section>

        <section id="view-reminders" class="view">
          <div class="panel">
            <div class="panel-scroll custom-scroll" id="list-reminders">
              <div class="empty"><i>✓</i>加载中…</div>
            </div>
          </div>
        </section>

        <section id="view-expenses" class="view">
          <div class="panel">
            <div class="panel-scroll custom-scroll" id="list-expenses">
              <div class="empty"><i>¥</i>加载中…</div>
            </div>
          </div>
        </section>

        <section id="view-monitor" class="view">
          <div class="panel mono">
            <div class="panel-scroll custom-scroll" id="list-servers">
              <div class="empty"><i>●</i>加载中…</div>
            </div>
          </div>
        </section>

        <section id="view-bookmarks" class="view">
          <div class="panel">
            <div class="panel-scroll custom-scroll" id="list-bookmarks">
              <div class="empty"><i>★</i>加载中…</div>
            </div>
          </div>
        </section>

      </div>
    </main>
  </div>


  <!-- ═══ 表单弹窗（挂 body：fixed 定位不受舞台玻璃包含块限制，覆盖整页） ═══ -->
  <!-- 待办表单弹窗：新建/编辑共用 -->
  <div class="iform-wrap" id="iform-reminders" hidden>
    <div class="iform-box">
      <div class="iform iform-scroll">
        <div class="iform-head">
          <span class="iform-title" id="fr-heading">新建待办</span>
          <button class="icon-btn sm" id="fr-close" title="关闭">✕</button>
        </div>
        <input type="hidden" id="fr-id">
        <label class="ifield"><span>标题</span><input id="fr-title" type="text" placeholder="待办标题…" maxlength="100"></label>
        <label class="ifield"><span>内容</span><textarea id="fr-content" rows="2" placeholder="待办内容…"></textarea></label>
        <div class="ifield"><span>优先级</span>
          <div class="isel" id="fr-priority-sel">
            <button type="button" class="isel-btn" aria-haspopup="listbox" onclick="toggleISelect('fr-priority-sel')"><span class="isel-txt">无</span></button>
            <div class="isel-menu" hidden role="listbox">
              <button type="button" class="isel-opt" data-value="0">无</button>
              <button type="button" class="isel-opt" data-value="3">高</button>
              <button type="button" class="isel-opt" data-value="2">中</button>
              <button type="button" class="isel-opt" data-value="1">低</button>
            </div>
          </div>
          <input type="hidden" id="fr-priority" value="0">
        </div>
        <label class="icheck"><input id="fr-need" type="checkbox"> 需要提醒</label>
        <div class="isub" id="fr-remind-box" hidden>
          <div class="ifield"><span>循环</span>
            <div class="isel" id="fr-cycle-sel">
              <button type="button" class="isel-btn" aria-haspopup="listbox" onclick="toggleISelect('fr-cycle-sel')"><span class="isel-txt">一次性</span></button>
              <div class="isel-menu" hidden role="listbox">
                <button type="button" class="isel-opt" data-value="once">一次性</button>
                <button type="button" class="isel-opt" data-value="daily">每天</button>
                <button type="button" class="isel-opt" data-value="weekly">每周</button>
                <button type="button" class="isel-opt" data-value="monthly">每月</button>
                <button type="button" class="isel-opt" data-value="yearly">每年</button>
                <button type="button" class="isel-opt" data-value="days">每 N 天</button>
              </div>
            </div>
            <input type="hidden" id="fr-cycle" value="once">
          </div>
          <div class="ifield" id="fr-days-row" hidden><span>每几天</span><input id="fr-cycle-days" type="number" min="1" max="365" step="1" value="7" inputmode="numeric"></div>
          <!-- 选「每天」时隐藏日期：每天循环，完成即顺延到明天 -->
          <div class="irow" id="fr-dates">
            <div class="ifield"><span>到期日</span><button type="button" class="idate" id="fr-due" data-value="" data-ph="选择到期日"><span class="idate-txt">选择到期日</span></button></div>
            <div class="ifield"><span>提醒日（可选）</span><button type="button" class="idate" id="fr-remind" data-value="" data-ph="默认提前 3 天"><span class="idate-txt">默认提前 3 天</span></button></div>
          </div>
          <div class="iform-hint" id="fr-date-hint">到期日必填；提醒日可选，不填默认提前 3 天。</div>
          <div class="iform-hint" id="fr-daily-hint" hidden>每天循环：完成后自动顺延到明天，今天不用再管。</div>
          <label class="icheck" id="fr-catchup-wrap" hidden><input id="fr-catchup" type="checkbox"> 错过后逐期补做（不勾选则跳到下一次）</label>
        </div>
        <div class="iform-acts">
          <button class="btn" id="fr-cancel">取消</button>
          <button class="btn primary" id="fr-save">保存待办</button>
        </div>
      </div>
    </div>
  </div>
  <!-- 记账表单弹窗：新建/编辑共用（利息仅还款时出现） -->
  <div class="iform-wrap" id="iform-expenses" hidden>
    <div class="iform-box">
      <div class="iform iform-scroll">
        <div class="iform-head">
          <span class="iform-title" id="fe-heading">新建记账</span>
          <button class="icon-btn sm" id="fe-close" title="关闭">✕</button>
        </div>
        <input type="hidden" id="fe-id">
        <div class="irow">
          <div class="ifield"><span>类型</span>
            <div class="isel" id="fe-type-sel">
              <button type="button" class="isel-btn" aria-haspopup="listbox" onclick="toggleISelect('fe-type-sel')"><span class="isel-txt">支出</span></button>
              <div class="isel-menu" hidden role="listbox">
                <button type="button" class="isel-opt" data-value="expense">支出</button>
                <button type="button" class="isel-opt" data-value="income">收入</button>
                <button type="button" class="isel-opt" data-value="debt_in">借入</button>
                <button type="button" class="isel-opt" data-value="debt_out">还款</button>
              </div>
            </div>
            <input type="hidden" id="fe-type" value="expense">
          </div>
          <label class="ifield"><span>金额 (元)</span><input id="fe-amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></label>
        </div>
        <label class="ifield" id="fe-interest-wrap" hidden><span>利息 (还款时)</span><input id="fe-interest" type="number" min="0" step="0.01" inputmode="decimal" placeholder="选填"></label>
        <label class="ifield"><span>说明</span><input id="fe-desc" type="text" placeholder="例如：午餐、工资…" maxlength="100"></label>
        <div class="irow">
          <label class="ifield"><span>分类</span><input id="fe-category" type="text" placeholder="选填" maxlength="50"></label>
                  <div class="ifield"><span>日期</span><button type="button" class="idate" id="fe-date" data-value="" data-ph="选择日期"><span class="idate-txt">选择日期</span></button></div>
        </div>
        <div class="iform-acts">
          <button class="btn" id="fe-cancel">取消</button>
          <button class="btn primary" id="fe-save">保存</button>
        </div>
      </div>
    </div>
  </div>
  <!-- 余额/负债校准弹窗：点顶栏数字展开 -->
  <div class="iform-wrap" id="iform-asset" hidden>
    <div class="iform-box">
      <div class="iform iform-scroll">
        <div class="iform-head">
          <span class="iform-title" id="fa-heading">校准余额</span>
          <button class="icon-btn sm" id="fa-close" title="关闭">✕</button>
        </div>
        <input type="hidden" id="fa-which" value="asset">
        <label class="ifield"><span>金额 (元)</span><input id="fa-amount" type="number" step="0.01" inputmode="decimal" placeholder="当前实际金额…"></label>
        <div class="iform-acts">
          <button class="btn" id="fa-cancel">取消</button>
          <button class="btn primary" id="fa-save">保存</button>
        </div>
      </div>
    </div>
  </div>
  <!-- 书签表单弹窗：新建/编辑共用（链接自动补协议） -->
  <div class="iform-wrap" id="iform-bookmarks" hidden>
    <div class="iform-box">
      <div class="iform iform-scroll">
        <div class="iform-head">
          <span class="iform-title" id="fb-heading">新建书签</span>
          <button class="icon-btn sm" id="fb-close" title="关闭">✕</button>
        </div>
        <input type="hidden" id="fb-id">
        <label class="ifield"><span>标题</span><input id="fb-title" type="text" placeholder="书签标题…" maxlength="100"></label>
        <label class="ifield"><span>链接</span><input id="fb-url" type="text" inputmode="url" placeholder="https://example.com"></label>
        <label class="ifield"><span>描述</span><input id="fb-desc" type="text" placeholder="选填" maxlength="200"></label>
        <label class="ifield"><span>标签</span><input id="fb-tags" type="text" placeholder="逗号分隔，选填"></label>
        <div class="iform-acts">
          <button class="btn" id="fb-cancel">取消</button>
          <button class="btn primary" id="fb-save">保存书签</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ 自定义日期选择面板（JS 会把它移到当前字段所在行下方） ═══ -->
  <div class="ipicker" id="ipicker" hidden></div>

  <script>var API_BASE = '<?php echo $apiBase; ?>';</script>
</body>
</html>
