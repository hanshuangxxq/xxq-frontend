// XXQ SEO 落地页交互脚本(中英落地页共用)
// 注意:生产环境 CSP(script-src 'self',见 docs/nginx.conf)禁止内联脚本,
// 落地页脚本必须保持外置;新增落地页交互一律写入本文件,不要内联到 HTML。

// ---- 登录态标记(渲染前执行)----
// 本文件在 <head> 以阻塞方式加载:此时 body 尚未解析,先给 <html> 打类,
// CSS(.user-only/.guest-only)据此显隐访客/已登录元素,无闪烁。
// 登录态依据 xxq-user(与 SPA useAuthStore 一致);localStorage 不可用或数据损坏时按访客态渲染
try {
  var landingUser = localStorage.getItem('xxq-user')
  if (landingUser && JSON.parse(landingUser).userId) {
    document.documentElement.classList.add('logged-in')
  }
} catch (e) {
  /* 忽略,按访客态渲染 */
}

// ---- 已登录头像菜单(DOM 解析完成后初始化)----
document.addEventListener('DOMContentLoaded', function () {
  // 访客态下无事可做
  if (!document.documentElement.classList.contains('logged-in')) return

  var user = null
  try {
    user = JSON.parse(localStorage.getItem('xxq-user'))
  } catch (e) {
    user = null
  }
  if (!user) return

  // 头像:文件名拼 /api/avatar/ 前缀(与 SPA avatarUrl() 同规则),无头像用姓名首字符占位
  var avatarImg = document.querySelector('.avatar-img')
  var avatarFallback = document.querySelector('.avatar-fallback')
  var avatar = user.avatar
  if (avatar) {
    var src = avatar
    if (!/^(https?:)?\/\//.test(avatar)) {
      src = '/api/avatar/' + avatar.replace(/^\/api\/avatar\//, '')
    }
    avatarImg.src = src
    avatarImg.hidden = false
  } else {
    avatarFallback.textContent = (user.name || '?').charAt(0)
    avatarFallback.hidden = false
  }
  document.querySelector('.user-name').textContent = user.name || ''

  // 下拉开关:点头像切换,点外部或 Esc 关闭
  var avatarBtn = document.querySelector('.avatar-btn')
  var dropdown = document.querySelector('.user-dropdown')
  function closeDropdown() {
    dropdown.hidden = true
    avatarBtn.setAttribute('aria-expanded', 'false')
  }
  avatarBtn.addEventListener('click', function (e) {
    e.stopPropagation()
    var opening = dropdown.hidden
    dropdown.hidden = !opening
    avatarBtn.setAttribute('aria-expanded', String(opening))
  })
  document.addEventListener('click', function (e) {
    if (!dropdown.hidden && !dropdown.contains(e.target)) closeDropdown()
  })
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !dropdown.hidden) closeDropdown()
  })

  // 退出登录:尽力通知后端,本地会话无论如何都清空
  document.querySelector('[data-logout]').addEventListener('click', function () {
    var finish = function () {
      try {
        localStorage.removeItem('xxq-access-token')
        localStorage.removeItem('xxq-refresh-token')
        localStorage.removeItem('xxq-user-id')
        localStorage.removeItem('xxq-user')
      } catch (e) {
        /* 忽略 */
      }
      location.reload()
    }
    var token = null
    try {
      token = localStorage.getItem('xxq-access-token')
    } catch (e) {
      token = null
    }
    if (!token) {
      finish()
      return
    }
    fetch('/api/login/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    })
      .catch(function () {
        /* 后端不可达也继续本地登出 */
      })
      .finally(function () {
        finish()
      })
  })
})
