#!/usr/bin/env python3
"""生成社交分享卡片与品牌方图(SEO 用)。

产物(均为提交进仓库的静态资源,随 public/ 并入 dist):
  public/og-image.png     1200x630  中文分享卡(og:image / twitter:image)
  public/og-image-en.png  1200x630  英文分享卡(/en/ 用)
  public/logo.png          512x512  方形字标(JSON-LD Organization.logo,需 >=112px 方图)

这是一次性的资源生成脚本,不是构建步骤:产物已提交,只有改版式时才需要重跑。
依赖 Pillow 与系统中文字体,换机器生成时若字体缺失会明确报错。

用法: python scripts/build-og-image.py
"""

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("缺少 Pillow,请先执行: pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public"

# 与 landing.css / src/theme 保持一致的品牌色
BRAND = (37, 99, 235)  # #2563eb
BRAND_DEEP = (29, 79, 215)  # #1d4fd7
TEXT = (31, 35, 41)  # #1f2329
TEXT_MUTED = (107, 114, 128)  # #6b7280
TEXT_FAINT = (156, 163, 175)  # #9ca3af
BG = (240, 242, 245)  # #f0f2f5
WHITE = (255, 255, 255)

CARD_W, CARD_H = 1200, 630
LOGO_SIZE = 512

# 依次尝试的字体路径:优先微软雅黑(Windows 中文环境),退化到苹方/思源
FONT_CANDIDATES = [
    ("C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/msyh.ttc"),
    ("C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/msyh.ttc"),
    ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/PingFang.ttc"),
    (
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ),
    (
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ),
]


def resolve_fonts():
    """定位可用的中文字体,返回 (粗体路径, 常规路径)。找不到直接退出,不生成半成品。"""
    for bold, regular in FONT_CANDIDATES:
        if Path(bold).exists() and Path(regular).exists():
            return bold, regular
    sys.exit(
        "未找到可用的中文字体,请在本机安装微软雅黑/苹方/思源黑体任一,"
        "或在 FONT_CANDIDATES 中补充路径。"
    )


BOLD_PATH, REGULAR_PATH = resolve_fonts()


def font(path, size):
    # .ttc 是字体集合,index=0 取第一个字重
    return ImageFont.truetype(path, size, index=0)


def draw_card(title_lines, subtitle_lines, out_name):
    """绘制 1200x630 分享卡。

    版式:浅色底 + 顶部品牌色条 + 左上 XXQ 字标 + 居中标题/副标题 + 底部域名。
    纯几何与文字,无外部图片依赖,结果可复现。所有文本用 anchor 定位,
    避免依赖字体 ascender/descender 的具体数值。
    """
    img = Image.new("RGB", (CARD_W, CARD_H), BG)
    d = ImageDraw.Draw(img)

    # 顶部品牌色条
    d.rectangle([0, 0, CARD_W, 12], fill=BRAND)

    # 右上角装饰:三层同心浅蓝圆,压住大面积留白
    cx, cy = CARD_W - 60, -40
    for i, radius in enumerate((260, 190, 120)):
        ratio = (12 + i * 10) / 255
        d.ellipse(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            fill=tuple(round(BG[j] + (BRAND[j] - BG[j]) * ratio) for j in range(3)),
        )

    # 左上角字标
    d.text((88, 104), "XXQ", font=font(BOLD_PATH, 54), fill=BRAND, anchor="lm")

    # 主标题:粗体大字,逐行居中(视觉中心 y 依次 +96)
    f_title = font(BOLD_PATH, 68)
    for i, line in enumerate(title_lines):
        d.text((CARD_W / 2, 248 + i * 96), line, font=f_title, fill=TEXT, anchor="mm")

    # 标题与副标题之间的品牌色分隔线
    d.rectangle([(CARD_W - 96) / 2, 412, (CARD_W + 96) / 2, 418], fill=BRAND)

    # 副标题:两行,弱化色
    f_sub = font(REGULAR_PATH, 32)
    for i, line in enumerate(subtitle_lines):
        d.text((CARD_W / 2, 472 + i * 44), line, font=f_sub, fill=TEXT_MUTED, anchor="mm")

    # 底部域名
    d.text((CARD_W / 2, 576), "hanshauangxxq.cn", font=font(REGULAR_PATH, 26), fill=TEXT_FAINT,
           anchor="mm")

    img.save(OUT_DIR / out_name, "PNG", optimize=True)
    print(f"  public/{out_name}  {CARD_W}x{CARD_H}")


def draw_logo():
    """绘制 512x512 方形字标:品牌色圆角方块 + 白色 XXQ"""
    img = Image.new("RGBA", (LOGO_SIZE, LOGO_SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.rounded_rectangle([0, 0, LOGO_SIZE - 1, LOGO_SIZE - 1], radius=104, fill=BRAND)
    # 描一圈深色边,避免纯平色显得单薄
    d.rounded_rectangle(
        [0, 0, LOGO_SIZE - 1, LOGO_SIZE - 1], radius=104, outline=BRAND_DEEP, width=6
    )

    d.text((LOGO_SIZE / 2, LOGO_SIZE / 2), "XXQ", font=font(BOLD_PATH, 168), fill=WHITE,
           anchor="mm")

    img.save(OUT_DIR / "logo.png", "PNG", optimize=True)
    print(f"  public/logo.png  {LOGO_SIZE}x{LOGO_SIZE}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("生成 SEO 图片资源:")
    draw_card(
        title_lines=["高校教务管理系统", "一体化教学管理平台"],
        subtitle_lines=["选课 · 排课 · 成绩 · 考试", "毕业设计 · 实践教学 · 学业预警"],
        out_name="og-image.png",
    )
    draw_card(
        title_lines=["Academic Affairs", "Management System"],
        subtitle_lines=["Scheduling · Grades · Exams", "Graduation Projects · Practice"],
        out_name="og-image-en.png",
    )
    draw_logo()


if __name__ == "__main__":
    main()
