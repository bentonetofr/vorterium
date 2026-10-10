"""Objetos de cidade grande no estilo de Nova York: metrô, escada de incêndio, letreiros, toldos e afins.

Folha `tlou-cidade`. Usados pelo mundo "Nova York" (scripts/tlou_art/world_nyc.py).
"""
from __future__ import annotations

from PIL import Image

from .objects_roads import BLACKISH, SIGN_GREEN, SIGN_RED, WHITE, _big
from .objects_ruins import moss_patch, rust_streaks, wheel
from .palettes import *  # noqa: F403
from .px import Cv, _hash, rgb, rng, scatter, text, text_width
from .sheet import Sheet, solid

CAT = 'Apocalipse: Cidade grande (NY)'


# ── Trilhos (chão) ──────────────────────────────────────────

def track(vertical: bool, seed: int) -> Cv:
    cv = Cv(32, 32)
    r = rng(seed)
    for i in range(32):                                    # brita
        for j in range(32):
            if r.random() < 0.18:
                cv.px(i, j, rgb('#3b3f44') if r.random() < 0.5 else rgb('#575c60'))
    sl = rgb('#3d2d1f'); sl2 = rgb('#54402c')
    for k in (2, 10, 18, 26):                              # dormentes
        if vertical:
            cv.rect(3, k, 26, 4, sl); cv.rect(3, k, 26, 1, sl2)
        else:
            cv.rect(k, 3, 4, 26, sl); cv.rect(k, 3, 1, 26, sl2)
    for off in (8, 21):                                    # trilhos
        if vertical:
            cv.rect(off, 0, 3, 32, rgb('#7b848a')); cv.rect(off, 0, 1, 32, rgb('#aab3b8')); cv.rect(off + 2, 0, 1, 32, rgb('#4b5359'))
        else:
            cv.rect(0, off, 32, 3, rgb('#7b848a')); cv.rect(0, off, 32, 1, rgb('#aab3b8')); cv.rect(0, off + 2, 32, 1, rgb('#4b5359'))
    for _ in range(14):                                    # ferrugem e mato
        x, y = r.randint(0, 31), r.randint(0, 31)
        cv.px(x, y, rgb('#8b5230') if r.random() < 0.5 else rgb('#4b6129'))
    return cv


def subway_car(seed: int = 501) -> Cv:
    cv = Cv(200, 76)
    body = ramp('#3a424a', '#566069', '#74808a', '#939fa8', '#b2bec6')
    cv.tex_poly([(2, 14), (194, 14), (198, 22), (198, 58), (2, 58)], body, seed, 5, 0.55)
    cv.rect(2, 14, 196, 3, body[4])
    cv.rect(2, 52, 196, 6, body[1])                         # saia
    for i in range(6):                                      # janelas
        x = 10 + i * 31
        cv.rect(x, 22, 20, 14, GLASS[1]); cv.rect(x, 22, 20, 1, GLASS[4]); cv.px(x + 1, 24, GLASS[4])
        if i in (1, 3):                                      # vidro quebrado
            cv.poly([(x + 3, 22), (x + 12, 22), (x + 6, 36)], rgb('#101820'))
    for x in (30, 92, 154):                                 # portas
        cv.rect(x, 20, 3, 36, body[0]); cv.rect(x + 8, 20, 3, 36, body[0])
        cv.rect(x - 1, 18, 14, 2, body[1])
    cv.rect(2, 40, 196, 2, rgb('#c9302c'))                  # faixa vermelha
    cv.rect(2, 43, 196, 1, rgb('#d9a62a'))
    text(cv, 160, 45, '6', rgb('#1c6e3f'))
    # pichações e ferrugem
    r = rng(seed)
    for x0 in (16, 70, 120):
        for k in range(8):
            cv.px(x0 + k * 2, 47 + (k % 3), rgb('#e8d96a') if k % 2 else rgb('#7ccf5a'))
    rust_streaks(cv, 4, 18, 192, 40, seed + 1, 30)
    moss_patch(cv, 6, 8, 180, 10, seed + 2, 0.5)
    moss_patch(cv, 4, 44, 192, 16, seed + 3, 0.25)
    for cx in (28, 60, 140, 172):
        wheel(cv, cx, 64, 6)
    cv.rect(2, 58, 196, 3, rgb('#101012'))
    cv.finish(shadow=(100, 70, 190, 8))
    return cv


def subway_entrance(seed: int = 511) -> Cv:
    cv = Cv(72, 84)
    for x in (4, 62):                                        # postes com globos verdes
        cv.tex_rect(x, 14, 4, 62, SIGN_GREEN, seed + x, 2, 0.5)
        cv.ell(x - 4, 2, 12, 12, rgb('#2f8a52')); cv.ell(x - 2, 4, 5, 5, rgb('#9be0a8'))
    cv.rect(4, 36, 64, 3, SIGN_GREEN[2]); cv.rect(4, 36, 64, 1, SIGN_GREEN[4])
    for x in range(8, 62, 6):                                # grade
        cv.rect(x, 39, 2, 28, SIGN_GREEN[1])
    cv.rect(4, 66, 64, 4, SIGN_GREEN[0])
    cv.rect(14, 44, 44, 14, BLACKISH)                        # escuridão da escada
    for k in range(5):
        cv.rect(14, 46 + k * 3, 44, 1, rgb('#2a2e32'))
    text(cv, 20, 24, 'SUBWAY', WHITE)
    cv.rect(18, 20, 36, 12, SIGN_GREEN[1]); cv.d.rectangle([18, 20, 53, 31], outline=WHITE)
    text(cv, 22, 23, 'SUBWAY', WHITE)
    rust_streaks(cv, 4, 14, 64, 60, seed + 1, 8)
    moss_patch(cv, 2, 60, 68, 14, seed + 2, 0.5)
    cv.finish(shadow=(36, 80, 66, 6))
    return cv


def fire_escape(seed: int = 521) -> Cv:
    cv = Cv(52, 128)
    iron = rgb('#1b1d1f'); hi = rgb('#3d4448')
    for y in (18, 66, 112):                                   # plataformas
        cv.rect(2, y, 48, 3, hi); cv.rect(2, y + 3, 48, 1, iron)
        for x in range(4, 50, 4):
            cv.rect(x, y + 4, 1, 7, iron)
        cv.rect(2, y - 10, 1, 10, iron); cv.rect(49, y - 10, 1, 10, iron); cv.rect(2, y - 10, 48, 1, iron)
    for (xa, y0, y1) in ((8, 21, 66), (34, 69, 112)):         # escadas inclinadas
        for k in range(12):
            y = y0 + k * (y1 - y0) // 12
            cv.rect(xa, y, 14, 1, hi)
        cv.line(xa, y0, xa, y1, iron); cv.line(xa + 13, y0, xa + 13, y1, iron)
    cv.rect(20, 8, 12, 6, iron)                                # escada recolhível
    rust_streaks(cv, 2, 8, 48, 110, seed, 14)
    moss_patch(cv, 2, 100, 48, 20, seed + 1, 0.4)
    cv.finish(shadow=None)
    return cv


def awning(seed: int = 531, colors=('#1c6e3f', '#e8e4d0'), label: str = '') -> Cv:
    cv = Cv(92, 34)
    c1, c2 = rgb(colors[0]), rgb(colors[1])
    for x in range(0, 92, 8):
        cv.poly([(x, 4), (x + 8, 4), (x + 10, 28), (x + 2, 28)], c1 if (x // 8) % 2 == 0 else c2)
    cv.rect(0, 2, 92, 3, rgb('#101214'))
    for x in range(0, 92, 8):
        cv.ell(x + 1, 26, 8, 6, c1 if (x // 8) % 2 == 0 else c2)
    if label:
        text(cv, 46 - text_width(label) // 2, 12, label, rgb('#101214'))
    r = rng(seed)
    for _ in range(14):                                         # rasgos
        x = r.randint(2, 88)
        for k in range(r.randint(3, 9)):
            cv.px(x, 8 + k, (0, 0, 0, 0))
    moss_patch(cv, 0, 4, 92, 24, seed, 0.2)
    cv.finish(shadow=None)
    return cv


def neon(label: str, bg: str, fg: str, seed: int, scale: int = 2) -> Cv:
    tw = text_width(label) * scale
    w, h = tw + 14, 5 * scale + 12
    cv = Cv(w, h)
    cv.rect(0, 0, w, h, rgb('#14161a'))
    cv.d.rectangle([2, 2, w - 3, h - 3], outline=rgb(bg))
    tmp = Cv(text_width(label), 5)
    text(tmp, 0, 0, label, rgb(fg))
    cv.im.alpha_composite(tmp.im.resize((tw, 5 * scale), Image.NEAREST), (7, 6))
    r = rng(seed)
    for y in range(h):
        for x in range(w):
            if cv.get(x, y)[3] and r.random() < 0.08:
                cv.px(x, y, rgb('#14161a'))                      # letras apagadas
    cv.finish(shadow=None)
    return cv


def hotdog_cart(seed: int = 541) -> Cv:
    cv = Cv(60, 60)
    cv.tex_rect(12, 28, 36, 20, IRON_LIGHT, seed, 2, 0.5)
    cv.rect(12, 28, 36, 3, IRON_LIGHT[4]); cv.rect(14, 34, 32, 8, rgb('#a8271d'))
    text(cv, 17, 36, 'HOT DOG', WHITE)
    wheel(cv, 18, 52, 5); wheel(cv, 42, 52, 5)
    cv.rect(29, 6, 2, 24, IRON[3])
    for i, x in enumerate(range(8, 52, 6)):                      # guarda-sol
        cv.poly([(30, 4), (x, 20), (x + 6, 20)], rgb('#d9442e') if i % 2 == 0 else rgb('#e8e4d0'))
    rust_streaks(cv, 12, 28, 36, 20, seed + 1, 6)
    moss_patch(cv, 8, 44, 44, 12, seed + 2, 0.4)
    cv.finish(shadow=(30, 56, 46, 6))
    return cv


def trash_can(seed: int = 551) -> Cv:
    cv = Cv(24, 32)
    cv.tex_rect(4, 8, 16, 20, SIGN_GREEN, seed, 2, 0.5)
    for x in range(5, 19, 3):
        cv.rect(x, 10, 1, 16, SIGN_GREEN[0])
    cv.rect(3, 6, 18, 3, SIGN_GREEN[3]); cv.rect(5, 3, 14, 4, rgb('#3b3f44'))
    rust_streaks(cv, 4, 8, 16, 18, seed + 1, 3)
    cv.finish(shadow=(12, 29, 18, 4))
    return cv


def steam_stack(seed: int = 561) -> Cv:
    cv = Cv(28, 68)
    for k in range(7):
        y = 6 + k * 8
        cv.rect(7, y, 14, 8, rgb('#d9632a') if k % 2 == 0 else rgb('#e8e4d0'))
    cv.poly([(5, 8), (7, 2), (21, 2), (23, 8)], rgb('#d9632a'))
    cv.rect(5, 60, 18, 4, IRON[2])
    rust_streaks(cv, 7, 6, 14, 54, seed, 8)
    moss_patch(cv, 4, 54, 20, 10, seed + 1, 0.5)
    cv.finish(shadow=(14, 64, 20, 5))
    return cv


def rowboat(seed: int = 571) -> Cv:
    cv = Cv(92, 40)
    cv.tex_poly([(4, 16), (88, 16), (76, 34), (16, 34)], WOOD, seed, 3, 0.5)
    cv.rect(4, 14, 84, 3, WOOD_PALE[3])
    cv.rect(44, 18, 3, 12, WOOD[1])
    for x in range(14, 80, 10):
        cv.line(x, 18, x - 3, 32, WOOD[0])
    moss_patch(cv, 6, 14, 80, 20, seed + 1, 0.35)
    cv.finish(shadow=(46, 36, 78, 6))
    return cv


def ruined_wall_v(seed: int = 581) -> Cv:
    """Muro de tijolos aparente num beco (stand baixo)."""
    cv = Cv(64, 56)
    cv.tex_poly([(2, 10), (62, 8), (62, 50), (2, 50)], BRICK, seed, 3, 0.5)
    for y in range(12, 50, 6):
        cv.rect(2, y, 60, 1, BRICK[0])
    moss_patch(cv, 2, 36, 60, 14, seed + 1, 0.5)
    cv.finish(shadow=(32, 52, 60, 5))
    return cv


def car_front(body, seed: int, back: bool = False, taxi: bool = False, van: bool = False) -> Cv:
    """Carro visto de frente ou de trás (pra ruas na vertical)."""
    w, h = (52, 60) if van else (48, 52)
    cv = Cv(w, h)
    top = 4 if not van else 2
    cv.tex_poly([(4, 22), (8, 14), (w - 8, 14), (w - 4, 22), (w - 4, h - 12), (4, h - 12)], body, seed, 4, 0.55)
    cab_x0, cab_x1 = (10, w - 10)
    cv.tex_poly([(cab_x0, 14), (cab_x0 + 4, top + 4), (cab_x1 - 4, top + 4), (cab_x1, 14)], body, seed + 1, 4, 0.55)
    glass = GLASS[2] if not back else GLASS[1]
    cv.poly([(cab_x0 + 3, 14), (cab_x0 + 6, top + 7), (cab_x1 - 6, top + 7), (cab_x1 - 3, 14)], glass)
    cv.line(cab_x0 + 6, top + 7, cab_x0 + 14, top + 7, GLASS[4])
    if seed % 3 == 0:
        cv.poly([(w // 2, top + 7), (w // 2 + 6, top + 7), (w // 2 + 2, 14)], rgb('#101820'))        # vidro trincado
    cv.rect(6, 28, w - 12, 3, body[1])
    cv.rect(w // 2 - 7, h - 20, 14, 5, rgb('#d8d4c4') if back else IRON_LIGHT[2])                    # placa / grade
    if back:
        cv.rect(7, 30, 6, 4, rgb('#9c2a22')); cv.rect(w - 13, 30, 6, 4, rgb('#9c2a22'))
    else:
        cv.rect(7, 30, 6, 4, rgb('#d8d4a4')); cv.rect(w - 13, 30, 6, 4, GLASS[1])
        cv.rect(w // 2 - 8, 33, 16, 5, IRON[2])
    cv.rect(2, h - 14, w - 4, 4, IRON_LIGHT[1])                                                      # para-choque
    for x in (6, w - 14):
        cv.rect(x, h - 11, 8, 8, rgb('#0d0d0e')); cv.rect(x + 1, h - 10, 6, 1, rgb('#2a2a2c'))        # rodas
    if taxi:
        cv.rect(w // 2 - 6, 1, 12, 5, rgb('#e8d24a')); cv.rect(w // 2 - 6, 1, 12, 1, rgb('#fff6a0'))
        cv.rect(4, 36, w - 8, 2, rgb('#101012'))
        for k in range(0, w - 8, 4):
            cv.px(4 + k, 36, rgb('#e8d24a')); cv.px(6 + k, 37, rgb('#e8d24a'))
    r = rng(seed)
    for _ in range(4):
        x0 = r.randint(6, w - 14)
        cv.tex_ell(x0, r.randint(30, 40), r.randint(5, 10), r.randint(3, 5), RUST, seed + x0, 1.5, 0.3)
    rust_streaks(cv, 6, 14, w - 12, 30, seed + 3, 8)
    moss_patch(cv, 8, 4, w - 16, 10, seed + 4, 0.4)
    moss_patch(cv, 4, 30, w - 8, 12, seed + 5, 0.25)
    cv.finish(shadow=(w // 2, h - 4, w - 2, 8))
    return cv


def build(sh: Sheet) -> None:
    tg = ['pós-apocalipse', 'Nova York']
    sh.add(track(False, 11), 'trilho-h', 'Trilho de metrô (horizontal)', CAT, ['trilho', 'metrô'] + tg, kind='floor', sort=0)
    sh.add(track(True, 12), 'trilho-v', 'Trilho de metrô (vertical)', CAT, ['trilho', 'metrô'] + tg, kind='floor', sort=0)
    sh.add(subway_car(), 'vagao-metro', 'Vagão de metrô abandonado', CAT, ['metrô', 'vagão', 'veículo'] + tg, solids=[solid(96, 16)], sort=5)
    sh.add(subway_entrance(), 'entrada-metro', 'Entrada do metrô (SUBWAY)', CAT, ['metrô', 'entrada'] + tg, solids=[solid(30, 6)], sort=3)
    sh.add(fire_escape(), 'escada-incendio', 'Escada de incêndio', CAT, ['escada', 'prédio', 'ferro'] + tg, kind='wall', sort=2)
    sh.add(awning(531, ('#1c6e3f', '#e8e4d0'), 'DELI'), 'toldo-verde', 'Toldo listrado verde (bodega)', CAT, ['toldo', 'loja'] + tg, kind='wall', sort=2)
    sh.add(awning(532, ('#a8271d', '#e8e4d0'), 'OPEN'), 'toldo-vermelho', 'Toldo listrado vermelho', CAT, ['toldo', 'loja'] + tg, kind='wall', sort=2)
    sh.add(awning(533, ('#22529e', '#e8e4d0'), ''), 'toldo-azul', 'Toldo listrado azul', CAT, ['toldo', 'loja'] + tg, kind='wall', sort=2)
    for slug, label, bg, fg, scale in (
        ('deli', 'DELI', '#d9442e', '#ffd86a', 3), ('farmacia', 'PHARMACY', '#2f8a52', '#d8f5df', 2),
        ('motel', 'MOTEL', '#d9442e', '#ffe08a', 3), ('diner', 'DINER', '#22529e', '#ffd86a', 3),
        ('posto', 'GARAGE', '#d9a62a', '#fff2b0', 2), ('hotel', 'HOTEL', '#d9442e', '#ffe08a', 3),
        ('policia', 'POLICE', '#22529e', '#dfe9ff', 3), ('banco', 'BANK', '#1c6e3f', '#e8e4d0', 3),
        ('escola', 'P.S. 114', '#a8271d', '#e8e4d0', 3), ('restaurante', 'THE ARBOR', '#c93a2c', '#ffd86a', 3),
        ('moda', 'FASHION', '#7a3a8a', '#f2d6ff', 2), ('escritorio', 'OFFICES', '#3068bd', '#dfe9ff', 2),
    ):
        sh.add(neon(label, bg, fg, 600 + len(slug), scale), f'letreiro-{slug}', f'Letreiro "{label}"', CAT, ['letreiro', 'placa', 'loja'] + tg, kind='wall', sort=2)
    for key, body, label, taxi, van in (('vermelho', CAR_RED, 'vermelho', False, False), ('azul', CAR_BLUE, 'azul', False, False),
                                        ('branco', CAR_WHITE, 'branco', False, False), ('amarelo', CAR_YELLOW, 'táxi', True, False),
                                        ('verde', CAR_GREEN, 'verde', False, False), ('van', CAR_WHITE, 'van', False, True)):
        for back in (False, True):
            slug = f'carro-v-{key}-{"costas" if back else "frente"}'
            sh.add(car_front(body, 700 + len(slug), back, taxi, van), slug,
                   f'Carro {label} visto de {"trás" if back else "frente"} (rua na vertical)', CAT, ['carro', 'veículo', 'rua'] + tg,
                   solids=[solid(21 if not van else 24, 18)], sort=5)
    sh.add(hotdog_cart(), 'carrinho-hotdog', 'Carrinho de cachorro-quente', CAT, ['carrinho', 'rua', 'comida'] + tg, solids=[solid(18, 8)], sort=3)
    sh.add(trash_can(), 'lixeira-nyc', 'Lixeira de arame verde', CAT, ['lixeira', 'rua'] + tg, solids=[solid(6, 4)], sort=3)
    sh.add(steam_stack(), 'chamine-vapor', 'Chaminé de vapor listrada', CAT, ['vapor', 'rua', 'metrô'] + tg, solids=[solid(7, 4)], sort=3)
    sh.add(rowboat(), 'barco-remo', 'Barco a remo encalhado', CAT, ['barco', 'rio'] + tg, solids=[solid(36, 8)], sort=3)
    sh.add(ruined_wall_v(), 'muro-beco', 'Muro de tijolos do beco', CAT, ['muro', 'beco'] + tg, solids=[solid(30, 6)], sort=3)
