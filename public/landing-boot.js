// 登录态打类 —— 落地页唯一阻塞渲染的脚本,故意保持极短。
//
// 本文件在 <head> 以同步方式加载:此时 body 尚未解析,先给 <html> 打类,
// landing.css 的 .user-only / .guest-only 据此显隐访客与已登录元素,无闪烁。
// 登录态依据 localStorage 的 xxq-user(与 SPA 的 useAuthStore 一致);
// localStorage 不可用或数据损坏时按访客态渲染。
//
// 为什么必须阻塞、不能 defer:defer 会在 body 解析完之后才执行,已登录访客
// 会先看到「登录»按钮再被替换成头像。
// 为什么不内联:生产 CSP(script-src 'self',见 docs/nginx.conf)禁止内联脚本,
// 放行内联需要按内容哈希维护白名单,改一个字符就失效且失效是静默的。
//
// 其余交互逻辑(头像菜单、退出登录)在 landing.js,以 defer 加载,不阻塞渲染。
try {
  var landingUser = localStorage.getItem('xxq-user')
  if (landingUser && JSON.parse(landingUser).userId) {
    document.documentElement.classList.add('logged-in')
  }
} catch (e) {
  /* 忽略,按访客态渲染 */
}
