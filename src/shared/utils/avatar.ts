/** 将 avatar 文件名转为后端图片接口 URL，filename 为空时返回 undefined */
export function avatarUrl(filename: string | null | undefined): string | undefined {
  if (!filename) return undefined
  return `/api/avatar/${filename}`
}
