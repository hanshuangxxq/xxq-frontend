/** 将 avatar 文件名转为后端图片接口 URL，filename 为空时返回 undefined */
export function avatarUrl(filename: string | null | undefined): string | undefined {
  if (!filename) return undefined
  if (filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('//'))
    return filename
  // 防止后端已返回完整路径时产生 /api/avatar/api/avatar/xxx 双重前缀
  const name = filename.replace(/^\/api\/avatar\//, '')
  return `/api/avatar/${name}`
}
