/* notify.js：右上角 Toast 已停用（用户指示不需要）。
 * 保留 Toast API（show/success/error/warning/info）为空实现，避免各调用处改动。
 * 失败反馈改用全局顶部「加载中…」指示（app.js 的 netStart/netEnd）与表单标红。
 */
(function (global) {
'use strict';

function noop() { return { dismiss: noop }; }

global.Toast = {
  show: noop,
  success: noop,
  error: noop,
  warning: noop,
  info: noop
};
})(window);
