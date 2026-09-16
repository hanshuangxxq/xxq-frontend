// XXQ SEO 落地页交互脚本(中英落地页共用)
//
// 加载方式:<script src="/landing.js" defer>,在 DOMContentLoaded 之前执行完毕,
// 因此下面注册的 DOMContentLoaded 监听必然能触发。
// 不要改用 async:若脚本晚于 DOMContentLoaded 才加载,监听器永不触发,
// 登录浮窗、头像菜单与退出登录会静默失效。
// 登录态打类在 landing-boot.js(必须阻塞),本文件不参与首屏渲染。
//
// 按登录态分两套初始化:
// - 访客态:登录浮窗(initLoginPopover)——访客在落地页直接登录,不再先跳
//   /login;登录成功写入与 SPA 相同的 localStorage 会话键,整页跳 /profile
//   直进系统,全程只有一次页面跳转。
// - 已登录:头像菜单与退出登录(initUserMenu)。
//
// 注意:生产环境 CSP(script-src 'self',见 docs/nginx.conf)禁止内联脚本,
// 落地页交互一律写入本文件,不要内联到 HTML。

document.addEventListener('DOMContentLoaded', function () {
  if (document.documentElement.classList.contains('logged-in')) {
    initUserMenu()
  } else {
    initLoginPopover()
  }
})

/**
 * 访客态:页头登录浮窗。
 *
 * 打开:悬停(.login-pop 的 pointerenter,只打开不抢焦点——鼠标只是路过页头时
 * 不应把焦点拽进输入框)或点击(页头「登录」/ hero「进入系统」,点击才自动聚焦
 * 账号框)。两者最终都是同一个浮窗,页头常驻视窗顶部,任何滚动位置都可触达。
 *
 * 收起按打开方式区分:
 * - 悬停打开的:鼠标移出登录区即收起(指针驱动的浮窗,体验上以指针为准)
 * - 点击打开的:「钉住」——鼠标移出不收起,必须焦点离开登录区(focusin 落在
 *   区外)、指针按在区外,或按 Esc 才收起;Esc 收起后焦点还给「登录」按钮。
 *   键盘/触屏用户没有悬停路径,若鼠标划过去浮窗就被关掉会令人困惑。
 * 统一的兜底:交互过面板(聚焦过任意输入)之后,进入钉住模式。
 *
 * 例外:输入法组合输入期间(compositionstart → compositionend)以上收起路径全部让路。
 * 候选窗是独立顶层窗口,打字时浏览器会据此误派发 pointerleave / focusin,用户并没有
 * 「离开」登录区;此时收起会把输入框随 form 的 hidden 一起失焦,中文等输入法直接不可用。 */
function initLoginPopover() {
  var pop = document.querySelector('.login-pop')
  var toggle = document.querySelector('[data-login-toggle]')
  var form = document.getElementById('login-popover')
  if (!pop || !toggle || !form) return

  var accountInput = form.querySelector('#login-account')
  var passwordInput = form.querySelector('#login-password')
  var errorEl = form.querySelector('[data-login-error]')
  var submitBtn = form.querySelector('.login-submit')

  // 运行时文案按 <html lang> 选择(静态标签已由生成器按页语言渲染)
  var TEXT =
    document.documentElement.lang === 'en'
      ? {
          submit: 'Sign In',
          signingIn: 'Signing in…',
          networkError: 'Network error, please try again later',
          requestFailed: 'Sign-in failed, please try again later',
          locked: function (s) {
            return 'Too many attempts, retry in ' + s + 's'
          },
        }
      : {
          submit: '登录',
          signingIn: '登录中…',
          networkError: '网络异常,请稍后重试',
          requestFailed: '登录失败,请稍后重试',
          locked: function (s) {
            return '尝试次数过多,' + s + ' 秒后可重试'
          },
        }

  // aria 在 JS 增强时补上:无 JS 时它只是指向 /login 的普通链接,不该宣称有弹窗
  toggle.setAttribute('role', 'button')
  toggle.setAttribute('aria-haspopup', 'dialog')
  toggle.setAttribute('aria-expanded', 'false')
  toggle.setAttribute('aria-controls', 'login-popover')

  // ---- 打开与收起 ----
  var opened = false
  var submitting = false
  // 钉住模式:false = 悬停打开,鼠标移出即收;true = 点击打开或已交互过,
  // 焦点驱动收起(见函数头注释)
  var pinned = false
  // 输入法组合输入中(拼音候选未上屏),期间一切收起路径让路,见下方 composition 监听
  var composing = false

  function open(focusAccount) {
    pinned = !!focusAccount
    if (!opened) {
      opened = true
      form.hidden = false
      toggle.setAttribute('aria-expanded', 'true')
    }
    if (focusAccount) accountInput.focus()
  }

  function close(restoreFocus) {
    if (!opened) return
    opened = false
    pinned = false
    form.hidden = true
    toggle.setAttribute('aria-expanded', 'false')
    if (restoreFocus) toggle.focus()
  }

  // 悬停打开(触屏点按也会先触发 pointerenter,随后的 click 再负责聚焦,无冲突)。
  // 已打开时指针再进来不要重复调用 open:open(false) 会把 pinned 降级回悬停态,
  // 此后任意一次 pointerleave 都会在用户正打字时把浮窗收掉。输入法(中文等)组合
  // 输入期间指针会因候选窗反复进出登录区(候选窗是独立顶层窗口,浏览器据此派发
  // pointerleave,指针移回页面时再派发 pointerenter),这条降级路径会让浮窗在
  // 打字中途收起——form 被 hidden 后输入框连带失焦,中文根本输不进去。
  pop.addEventListener('pointerenter', function () {
    if (!opened) open(false)
  })

  toggle.addEventListener('click', function (e) {
    e.preventDefault()
    open(true)
  })

  // hero 的「进入系统」:打开同一个浮窗(href="/login" 是无 JS 兜底)
  var openers = document.querySelectorAll('[data-login-open]')
  for (var i = 0; i < openers.length; i++) {
    openers[i].addEventListener('click', function (e) {
      e.preventDefault()
      open(true)
    })
  }

  // 鼠标移出登录区:只有未钉住的(悬停打开的)才收起
  pop.addEventListener('pointerleave', function () {
    if (composing) return
    if (opened && !pinned) close(false)
  })

  // 输入法组合输入(中文/日文等)期间的误报:候选窗是独立顶层窗口,浏览器会按
  // 指针与它的相对位置派发 pointerleave / focusin,Esc 也交给输入法去取消候选。
  // 这些都发生在用户正打字时,一律不收起(否则 form 被 hidden,输入框连带失焦)。
  form.addEventListener('compositionstart', function () {
    composing = true
  })
  form.addEventListener('compositionend', function () {
    composing = false
  })

  // 钉住模式的收起三条件:焦点落到区外 / 指针按在区外 / Esc;鼠标移出不收
  document.addEventListener('focusin', function (e) {
    if (composing) return
    if (opened && pinned && !pop.contains(e.target)) close(false)
  })
  document.addEventListener('pointerdown', function (e) {
    if (composing) return
    if (opened && !pop.contains(e.target)) close(false)
  })
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !opened) return
    // 组合中按 Esc 是「取消候选/撤销拼音」,不能顺带关掉浮窗
    if (composing || e.isComposing) return
    close(true)
  })

  // 键盘 Tab 聚焦进表单:与点击打开一致进入钉住模式,之后按焦点驱动收起
  accountInput.addEventListener('focus', function () {
    if (opened) pinned = true
  })
  passwordInput.addEventListener('focus', function () {
    if (opened) pinned = true
  })

  // ---- 客户端私网 IP 探测(与 SPA 的 clientIp.ts 同策略,仅供后端登录限流分桶)----
  // 页面加载即开始,用户输入凭据期间即可完成;结果可能为空(浏览器 mDNS 掩藏),
  // 后端把该头视为可选、可伪造,只用于登录限流
  var ipDetection = null

  function isPrivateIp(ip) {
    if (ip.indexOf('10.') === 0) return true
    if (ip.indexOf('192.168.') === 0) return true
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
    // CGNAT 100.64.0.0/10(校园网常用)
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true
    // IPv6 ULA fc00::/7
    var lower = ip.toLowerCase()
    return lower.indexOf('fc') === 0 || lower.indexOf('fd') === 0
  }

  function detectPrivateIps() {
    if (typeof RTCPeerConnection === 'undefined') return Promise.resolve([])
    return new Promise(function (resolve) {
      var ips = []
      var seen = {}
      var settled = false
      var pc = new RTCPeerConnection({ iceServers: [] })

      var finish = function () {
        if (settled) return
        settled = true
        clearTimeout(timer)
        pc.onicecandidate = null
        pc.close()
        resolve(ips)
      }
      var timer = setTimeout(finish, 1000)

      pc.onicecandidate = function (e) {
        // candidate 为 null 表示 ICE 收集结束
        if (!e.candidate) {
          finish()
          return
        }
        // 形如 "candidate:842163049 1 udp 2113937151 192.168.1.5 53474 typ host ..."
        var ip = e.candidate.candidate.split(' ')[4]
        if (ip && isPrivateIp(ip) && !seen[ip]) {
          seen[ip] = true
          ips.push(ip)
        }
      }

      try {
        // 无媒体流时需先建 DataChannel 才会触发 ICE 收集
        pc.createDataChannel('')
        pc.createOffer()
          .then(function (offer) {
            return pc.setLocalDescription(offer)
          })
          .catch(finish)
      } catch {
        finish()
      }
    })
  }

  function startIpDetection() {
    if (!ipDetection) {
      ipDetection = detectPrivateIps().catch(function () {
        return []
      })
    }
  }

  startIpDetection()

  // ---- 登录防爆破守卫(与 SPA 的 useLoginGuard 同 key 同策略,两侧共享锁定状态)----
  var GUARD_KEY = 'xxq-login-guard'
  var MAX_FAILURES = 5
  var LOCK_DURATIONS = [30, 60, 120, 300]
  var guard = loadGuard()
  var lockTimer = null

  function loadGuard() {
    try {
      var raw = sessionStorage.getItem(GUARD_KEY)
      if (!raw) return { failures: 0, lockLevel: 0, lockUntil: 0 }
      var parsed = JSON.parse(raw)
      return {
        failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
        lockLevel: typeof parsed.lockLevel === 'number' ? parsed.lockLevel : 0,
        lockUntil: typeof parsed.lockUntil === 'number' ? parsed.lockUntil : 0,
      }
    } catch {
      return { failures: 0, lockLevel: 0, lockUntil: 0 }
    }
  }

  function saveGuard() {
    try {
      sessionStorage.setItem(GUARD_KEY, JSON.stringify(guard))
    } catch {
      // 隐私模式等场景下 sessionStorage 可能不可用,降级为仅内存生效
    }
  }

  function lockedSeconds() {
    return Math.max(0, Math.ceil((guard.lockUntil - Date.now()) / 1000))
  }

  function stopLockTimer() {
    if (lockTimer) {
      clearInterval(lockTimer)
      lockTimer = null
    }
  }

  /** 按当前锁定/提交状态刷新提交按钮;锁定期内禁用并显示倒计时 */
  function refreshSubmit() {
    if (lockedSeconds() > 0) {
      submitBtn.disabled = true
      submitBtn.textContent = TEXT.locked(lockedSeconds())
      if (!lockTimer) {
        lockTimer = setInterval(function () {
          if (lockedSeconds() <= 0) {
            stopLockTimer()
            refreshSubmit()
          } else {
            submitBtn.textContent = TEXT.locked(lockedSeconds())
          }
        }, 500)
      }
      return
    }
    stopLockTimer()
    submitBtn.disabled = submitting
    submitBtn.textContent = submitting ? TEXT.signingIn : TEXT.submit
  }

  /** 记录一次登录失败,达到阈值后进入阶梯锁定(30s → 60s → 120s → 300s) */
  function recordFailure() {
    guard.failures += 1
    if (guard.failures >= MAX_FAILURES) {
      guard.failures = 0
      guard.lockLevel += 1
      guard.lockUntil =
        Date.now() + LOCK_DURATIONS[Math.min(guard.lockLevel, LOCK_DURATIONS.length - 1)] * 1000
    }
    saveGuard()
    refreshSubmit()
  }

  function recordSuccess() {
    stopLockTimer()
    guard = { failures: 0, lockLevel: 0, lockUntil: 0 }
    try {
      sessionStorage.removeItem(GUARD_KEY)
    } catch {
      // 同 saveGuard,忽略存储异常
    }
  }

  // 刷新页面时若仍在锁定期内,恢复倒计时
  refreshSubmit()

  // ---- 错误提示(面板内红字,不跳页)----
  function showError(msg) {
    errorEl.textContent = msg
    errorEl.hidden = false
    accountInput.classList.add('login-input-error')
    passwordInput.classList.add('login-input-error')
  }

  function hideError() {
    errorEl.hidden = true
    accountInput.classList.remove('login-input-error')
    passwordInput.classList.remove('login-input-error')
  }

  accountInput.addEventListener('input', hideError)
  passwordInput.addEventListener('input', hideError)

  // ---- 提交:与 SPA 同一接口同一参数;成功写同一份 localStorage 会话键 ----
  form.addEventListener('submit', function (e) {
    e.preventDefault()
    // required 校验已在 submit 触发前由浏览器完成;这里防回车连点与锁定期绕过
    if (submitting || lockedSeconds() > 0) return

    var account = accountInput.value.trim()
    var password = passwordInput.value
    if (!account || !password) return

    submitting = true
    hideError()
    refreshSubmit()

    startIpDetection()
    ipDetection
      .then(function (ips) {
        var headers = { 'Content-Type': 'application/json' }
        if (ips.length > 0) headers['X-Client-Private-IP'] = ips.join(', ')
        return fetch('/api/login', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            type: 'account',
            data: { account: account, password: password },
          }),
        })
      })
      .then(function (res) {
        if (!res.ok) {
          // HTTP 层错误:尽力取后端 message,取不到走通用提示
          return res.json().then(
            function (body) {
              throw { bizMessage: (body && body.message) || TEXT.requestFailed }
            },
            function () {
              throw { bizMessage: TEXT.requestFailed }
            },
          )
        }
        return res.json()
      })
      .then(function (body) {
        if (!body || body.code !== 200 || !body.data) {
          throw { bizMessage: (body && body.message) || TEXT.requestFailed }
        }
        var session = body.data
        // 与 SPA 的 setTokens + saveUser 完全一致的键,landing-boot.js 与
        // SPA 启动都靠它们识别登录态
        try {
          localStorage.setItem('xxq-access-token', session.accessToken)
          localStorage.setItem('xxq-refresh-token', session.refreshToken)
          localStorage.setItem('xxq-user-id', String(session.userId))
          localStorage.setItem('xxq-user', JSON.stringify(session))
        } catch {
          // localStorage 不可用也继续跳转;SPA 启动会按未登录处理并弹回 /login
        }
        recordSuccess()
        // 整页跳转直进系统:登录链路从「落地页→/login→落地页→/profile」缩为一跳
        location.replace('/profile')
      })
      .catch(function (err) {
        submitting = false
        showError((err && err.bizMessage) || TEXT.networkError)
        recordFailure()
      })
  })
}

/** 已登录:头像下拉菜单与退出登录 */
function initUserMenu() {
  var user = null
  try {
    user = JSON.parse(localStorage.getItem('xxq-user'))
  } catch {
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
    } catch {
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
      } catch {
        /* 忽略 */
      }
      location.reload()
    }
    var token = null
    try {
      token = localStorage.getItem('xxq-access-token')
    } catch {
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
}
