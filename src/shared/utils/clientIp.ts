/**
 * 客户端私网 IP 探测(尽力而为,仅用于登录请求)。
 *
 * 背景:教务系统登录接口按 IP 限流时,同栋宿舍楼经 NAT 出口后公网 IP 相同,
 * 需要客户端的私网 IP 作为辅助区分维度。浏览器无法直接读取本机 IP,
 * 唯一途径是 WebRTC 的 host ICE candidate;但现代浏览器默认用 mDNS
 * 掩藏主机候选(*.local),往往拿不到真实 IP,因此探测结果可能为空 ——
 * 后端应把它当作可选的限流辅助头,缺失时回退到 X-Forwarded-For。
 *
 * 探测结果仅通过登录请求的 X-Client-Private-IP 头上报;登录后的限流/风控
 * 由后端按账户维度处理,不再依赖 IP。注意:该值由客户端上报、可被伪造,
 * 只能用于登录限流分桶,不能用于安全判定。
 */

/** 请求头名:客户端上报的私网 IP(多个以逗号分隔) */
export const CLIENT_PRIVATE_IP_HEADER = 'X-Client-Private-IP'

/** 判断是否为私网/运营商级 NAT 地址(链路本地地址不具备区分度,排除) */
function isPrivateIp(ip: string): boolean {
  if (ip.startsWith('10.')) return true
  if (ip.startsWith('192.168.')) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  // CGNAT 100.64.0.0/10(校园网常用)
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true
  // IPv6 ULA fc00::/7
  const lower = ip.toLowerCase()
  return lower.startsWith('fc') || lower.startsWith('fd')
}

/** WebRTC host candidate 探测,1s 兜底超时;不支持/被 mDNS 掩藏时返回空数组 */
function detectPrivateIps(): Promise<string[]> {
  if (typeof RTCPeerConnection === 'undefined') return Promise.resolve([])
  return new Promise((resolve) => {
    const ips = new Set<string>()
    let settled = false
    const pc = new RTCPeerConnection({ iceServers: [] })

    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      pc.onicecandidate = null
      pc.close()
      resolve([...ips])
    }
    const timer = setTimeout(finish, 1000)

    pc.onicecandidate = (e) => {
      // candidate 为 null 表示 ICE 收集结束
      if (!e.candidate) {
        finish()
        return
      }
      // 形如 "candidate:842163049 1 udp 2113937151 192.168.1.5 53474 typ host ..."
      const ip = e.candidate.candidate.split(' ')[4]
      if (ip && isPrivateIp(ip)) ips.add(ip)
    }

    try {
      // 无媒体流时需先建 DataChannel 才会触发 ICE 收集
      pc.createDataChannel('')
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(finish)
    } catch {
      finish()
    }
  })
}

let detected: Promise<string[]> | null = null

/** 启动探测(进入登录页时调用,用户输入凭据期间即可完成;整个页面生命周期只探测一次) */
export function startClientIpDetection(): void {
  detected ??= detectPrivateIps()
}

/** 生成携带私网 IP 的请求头(等待进行中的探测完成;无结果时返回空对象) */
export async function clientIpHeaders(): Promise<Record<string, string>> {
  startClientIpDetection()
  const ips = (await detected) ?? []
  return ips.length > 0 ? { [CLIENT_PRIVATE_IP_HEADER]: ips.join(', ') } : {}
}
