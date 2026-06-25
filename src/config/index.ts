/** API 后端路径前缀，可通过环境变量 VITE_API_BASE_URL 覆盖 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'
