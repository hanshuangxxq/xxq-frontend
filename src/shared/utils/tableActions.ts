import { h } from 'vue'
import { NButton, NPopconfirm, NSpace } from 'naive-ui'

export interface TableAction {
  label: string
  onClick: () => void
  /** true 时渲染为描边红色按钮(删除等危险操作);缺省为主色实心按钮 */
  danger?: boolean
  /** 提供时包一层 NPopconfirm 二次确认,值为确认文案 */
  confirm?: string
}

function renderButton(action: TableAction, withHandler: boolean) {
  return h(
    NButton,
    {
      size: 'small' as const,
      type: action.danger ? ('error' as const) : ('primary' as const),
      secondary: action.danger === true,
      ...(withHandler ? { onClick: action.onClick } : {}),
    },
    () => action.label,
  )
}

/**
 * 表格操作列统一渲染:实心主按钮 + 描边危险按钮,按钮间距 6px。
 * small 按钮配合 DataTable 紧凑行(tdPadding 6px),上下各留 ~6px 不贴表格线。
 * 用法(列定义 render 中):render: (row) => renderActions([{ label: t('x.edit'), onClick: () => startEdit(row) }, { label: t('x.delete'), danger: true, confirm: t('x.deleteConfirm'), onClick: () => handleDelete(row.id) }])
 */
export function renderActions(actions: TableAction[]) {
  return h(NSpace, { size: 6, align: 'center' }, () =>
    actions.map((action) =>
      action.confirm
        ? h(
            NPopconfirm,
            { onPositiveClick: action.onClick },
            { default: () => action.confirm, trigger: () => renderButton(action, false) },
          )
        : renderButton(action, true),
    ),
  )
}
