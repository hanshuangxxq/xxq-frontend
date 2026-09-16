// XXQ SEO 落地页交互脚本(中英落地页共用)
//
// 加载方式:<script src="/landing.js" defer>,在 DOMContentLoaded 之前执行完毕,
// 因此下面注册的 DOMContentLoaded 监听必然能触发。
// 不要改用 async:若脚本晚于 DOMContentLoaded 才加载,监听器永不触发,
// 已登录用户的头像菜单与退出登录会静默失效。
// 登录态打类在 landing-boot.js(必须阻塞),本文件不参与首屏渲染。
//
// 注意:生产环境 CSP(script-src 'self',见 docs/nginx.conf)禁止内联脚本,
// 落地页交互一律写入本文件,不要内联到 HTML。

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

  // 头像:无头像用姓名首字符占位。
  // 后端 /api/avatar/** 需登录(AuthInterceptor 拦截),<img> 直链不携带 Authorization 头,
  // 站内头像必须 fetch 带 Bearer 取 blob 转 ObjectURL(与 SPA useAvatar 同策略);
  // 外部 http(s) 头像可直链。拉取失败(含 token 过期 401)一律回退占位符。
  var avatarImg = document.querySelector('.avatar-img')
  var avatarFallback = document.querySelector('.avatar-fallback')
  function showAvatarFallback() {
    avatarFallback.textContent = (user.name || '?').charAt(0)
    avatarFallback.hidden = false
  }
  var avatar = user.avatar
  if (!avatar) {
    showAvatarFallback()
  } else if (/^(https?:)?\/\//.test(avatar)) {
    avatarImg.src = avatar
    avatarImg.hidden = false
  } else {
    var avatarToken = null
    try {
      avatarToken = localStorage.getItem('xxq-access-token')
    } catch (e) {
      avatarToken = null
    }
    if (!avatarToken) {
      showAvatarFallback()
    } else {
      fetch('/api/avatar/' + avatar.replace(/^\/api\/avatar\//, ''), {
        headers: { Authorization: 'Bearer ' + avatarToken },
      })
        .then(function (res) {
          if (!res.ok) throw new Error('avatar ' + res.status)
          return res.blob()
        })
        .then(function (blob) {
          avatarImg.src = URL.createObjectURL(blob)
          avatarImg.hidden = false
        })
        .catch(showAvatarFallback)
    }
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
