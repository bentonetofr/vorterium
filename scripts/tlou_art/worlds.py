"""Mundo pronto "Cidade em Ruínas": quatro zonas do Vortable no clima de The Last of Us.

Gera `public/vortable/maps/ruinas.mundo.json` (formato `vortable-world`, o mesmo do TORVALLEN) usando só o que
já existe no catálogo: terrenos e objetos do pacote Apocalipse (ids `tlou-*` e `tlou@*`) e as paredes e tetos
dos pacotes de paredes. Zonas: Rua da Cidade, Posto de Quarentena, Hospital Abandonado e Subsolo Infectado.
"""
from __future__ import annotations

import json
import os
import random

from .px import fbm

TILE = 32
MAP = 'maps/ruinas.mundo.json'


# ── Zona: grade de vértices, cômodos, objetos, luzes, saídas ──────────────

class Zone:
    def __init__(self, zid: str, name: str, w: int, h: int, base: str, seed: int):
        self.id, self.name, self.w, self.h, self.base, self.seed = zid, name, w, h, base, seed
        self.vw, self.vh = w + 1, h + 1
        self.corners = [''] * (self.vw * self.vh)
        self.overlay = [''] * (self.vw * self.vh)
        self.rooms = [''] * (self.vw * self.vh)
        self.objects: list[dict] = []
        self.lights: list[dict] = []
        self.portals: list[dict] = []
        self.npcs: list[dict] = []
        self.spawn = {'x': w * TILE // 2, 'y': h * TILE // 2}
        self.lighting: dict = {'place': 'outdoor', 'particles': True, 'clouds': True}
        self.sound: dict = {'auto': True}
        self.rng = random.Random(seed)

    # vértices
    def at(self, x: int, y: int) -> int:
        return y * self.vw + x

    def paint(self, terrain: str, x0: int, y0: int, x1: int, y1: int) -> None:
        """Pinta os vértices do retângulo (inclusive) com o terreno."""
        for y in range(max(0, y0), min(self.vh - 1, y1) + 1):
            for x in range(max(0, x0), min(self.vw - 1, x1) + 1):
                self.corners[self.at(x, y)] = terrain

    def noise(self, terrain: str, scale: float, thr: float, seed: int, box: tuple[int, int, int, int] | None = None,
              only: str | None = None) -> None:
        """Manchas de ruído: onde o ruído passa do limite, pinta (só sobre `only`, se dado)."""
        x0, y0, x1, y1 = box or (0, 0, self.vw - 1, self.vh - 1)
        for y in range(max(0, y0), min(self.vh - 1, y1) + 1):
            for x in range(max(0, x0), min(self.vw - 1, x1) + 1):
                cur = self.corners[self.at(x, y)]
                if only is not None and cur != only:
                    continue
                if fbm(x / scale, y / scale, seed, 3) > thr:
                    self.corners[self.at(x, y)] = terrain

    def disc(self, terrain: str, cx: float, cy: float, r: float, jitter: int = 0) -> None:
        for y in range(self.vh):
            for x in range(self.vw):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if d <= r + (fbm(x / 2.3, y / 2.3, self.seed + jitter, 2) - 0.5) * 2.2 * (1 if jitter else 0):
                    self.corners[self.at(x, y)] = terrain

    def room(self, x0: int, y0: int, x1: int, y1: int, floor: str, wall: str, ceil: str, height: int = 4) -> None:
        """Cômodo como o editor grava: parede nas primeiras `height + 1` linhas, piso no resto, moldura por cima."""
        style = f'{floor}|{wall}|{ceil}|{height}'
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                i = self.at(x, y)
                self.corners[i] = wall if y <= y0 + height else floor
                self.overlay[i] = ceil
                self.rooms[i] = style

    def door(self, x0: int, x1: int, y0: int, y1: int, floor: str) -> None:
        """Vão numa parede: piso nos vértices (a moldura e o cômodo continuam)."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.corners[self.at(x, y)] = floor

    # objetos e luzes (em tiles)
    def put(self, kind: str, tx: float, ty: float, flip: bool = False) -> None:
        o = {'kind': kind if '@' in kind else f'tlou@{kind}', 'x': round(tx * TILE), 'y': round(ty * TILE)}
        if flip:
            o['flip'] = True
        self.objects.append(o)

    def paint_line(self, base_kind: str, axis: str, fixed: int, a: int, b: int, skip=None) -> None:
        """Emenda faixas pintadas, um ladrilho por vez. axis 'h': linha na horizontal na fileira `fixed`, de a a b;
        'v': na vertical na coluna `fixed`. Alterna a versão gasta pra não repetir."""
        for i in range(a, b + 1):
            tx, ty = (i, fixed) if axis == 'h' else (fixed, i)
            if skip and skip(tx, ty):
                continue
            tag = '-b' if self.rng.random() < 0.5 else ''
            self.put(f'{base_kind}-{axis}{tag}', tx + 0.5, ty + 1)

    def scatter(self, kinds: list[str], n: int, box: tuple[float, float, float, float], avoid: list[tuple] | None = None) -> None:
        x0, y0, x1, y1 = box
        placed = 0
        tries = 0
        while placed < n and tries < n * 30:
            tries += 1
            tx, ty = self.rng.uniform(x0, x1), self.rng.uniform(y0, y1)
            if avoid and any(ax0 <= tx <= ax1 and ay0 <= ty <= ay1 for ax0, ay0, ax1, ay1 in avoid):
                continue
            self.put(self.rng.choice(kinds), tx, ty, self.rng.random() < 0.5)
            placed += 1

    def light(self, lid: str, tx: float, ty: float, radius: int, color: str, intensity: float, flicker: float = 0) -> None:
        self.lights.append({'id': lid, 'x': round(tx * TILE), 'y': round(ty * TILE), 'radius': radius,
                            'color': color, 'intensity': intensity, 'flicker': flicker})

    def portal(self, pid: str, name: str, tx: float, ty: float, tw: float, th: float, to: tuple[str, str]) -> None:
        self.portals.append({'id': pid, 'name': name, 'x': round(tx * TILE), 'y': round(ty * TILE),
                             'w': round(tw * TILE), 'h': round(th * TILE), 'to': {'zone': to[0], 'portal': to[1]}})

    def npc(self, nid: str, name: str, role: str, appearance: dict, tx: float, ty: float, d: str = 'down') -> None:
        self.npcs.append({'id': nid, 'name': name, 'role': role, 'appearance': appearance,
                          'x': round(tx * TILE), 'y': round(ty * TILE), 'dir': d})

    def data(self) -> dict:
        z = {
            'version': 1, 'id': self.id, 'name': self.name, 'width': self.w, 'height': self.h, 'base': self.base,
            'corners': self.corners, 'overlay': self.overlay, 'rooms': self.rooms, 'objects': self.objects,
            'lighting': self.lighting, 'sound': self.sound, 'lights': self.lights, 'portals': self.portals,
            'spawn': self.spawn,
        }
        if self.npcs:
            z['npcs'] = self.npcs
        return z


# ── Bonecos dos NPCs ─────────────────────────────────────────────────────

def person(body: str, hair: str, hair_color: str, shirt: tuple, legs: tuple, shoes: str = 'brown', **extra) -> dict:
    """Aparência pronta: corpo adulto com a cabeça e o cabelo padrão do catálogo e itens de `tlou/`."""
    male = body != 'female'
    slots: dict = {
        'body': {'id': 'body/body'},
        'head': {'id': f'head/heads/human/heads_human_{"male" if male else "female"}', 'colors': {'color_2': 'brown'}},
        'hair': {'id': hair, 'colors': {'color': hair_color}},
        'clothes': {'id': shirt[0], **({'variant': shirt[1]} if len(shirt) > 1 else {}),
                    **({'colors': {'color': shirt[2]}} if len(shirt) > 2 else {})},
        'legs': {'id': legs[0], **({'variant': legs[1]} if len(legs) > 1 else {}),
                 **({'colors': {'color': legs[2]}} if len(legs) > 2 else {})},
        'shoes': {'id': 'feet/shoes/feet_shoes_basic' if male else 'feet/boots/feet_boots_basic', 'colors': {'color': shoes}},
    }
    for slot, spec in extra.items():
        slots[slot] = {'id': spec[0], **({'variant': spec[1]} if len(spec) > 1 else {})}
    return {'version': 2, 'body': body, 'skin': 'light', 'slots': slots}


SHORT = 'hair/short/hair_messy1'
LONG = 'hair/long/hair_long'

SHIRT_PLAID = lambda v: ('tlou/clothes/xadrez', v)           # noqa: E731
SHIRT_DIRTY = lambda v: ('tlou/clothes/surrada', v)          # noqa: E731
SHIRT_CAMO = lambda v: ('tlou/clothes/camuflada', v)         # noqa: E731
LEGS_DIRTY = lambda v: ('tlou/legs/surrada', v)              # noqa: E731
LEGS_CAMO = lambda v: ('tlou/legs/camuflada', v)             # noqa: E731


# ── Zona 1: Rua da Cidade ─────────────────────────────────────────────

def street() -> Zone:
    z = Zone('ruinas-rua', 'Rua da Cidade (ruínas)', 56, 34, 'tlou-asfalto', 101)
    W, H = z.vw, z.vh
    # calçadas em cima e embaixo, rua no meio
    z.paint('tlou-calcada', 0, 8, W - 1, 10)
    z.paint('tlou-calcada', 0, 29, W - 1, H - 1)
    # prédios na frente: hospital (esquerda) e mercadinho (direita)
    z.room(3, 0, 27, 7, 'tlou-concreto', 'wall-49', 'ceil-25', 4)
    z.room(33, 0, 53, 7, 'tlou-concreto', 'wall-177', 'ceil-30', 4)
    # desgaste da rua: asfalto rachado, musgo, lama, entulho e mato nas frestas
    z.noise('tlou-asfalto-rachado', 5.0, 0.56, 11, (0, 11, W - 1, 28), only='tlou-asfalto')
    z.noise('tlou-asfalto-musgo', 4.0, 0.64, 17, (0, 11, W - 1, 28), only='tlou-asfalto')
    z.noise('tlou-mato-invasor', 3.2, 0.7, 23, (0, 8, W - 1, 10), only='tlou-calcada')
    z.noise('tlou-mato-invasor', 3.2, 0.68, 29, (0, 29, W - 1, H - 1), only='tlou-calcada')
    z.disc('tlou-lama', 40, 24, 3.4, 3)
    z.disc('tlou-entulho', 25, 19, 3.6, 5)
    z.disc('tlou-micelio', 46, 11, 2.6, 7)                  # fungo escorrendo do mercadinho
    z.disc('tlou-grama-seca', 6, 27, 3.0, 9)

    # entulho no meio da rua (a rua está bloqueada)
    z.put('entulho', 24, 19); z.put('laje', 26.5, 19.6); z.put('pilar-quebrado', 22.4, 20.4)
    z.put('entulho-pequeno', 28.5, 20.2); z.put('pneus', 25.6, 21.4); z.put('sacos-lixo', 22.2, 17.6)
    z.put('papeis', 27.5, 22.6); z.put('vidro-quebrado', 23.4, 22.8)
    # carros abandonados
    z.put('carro-vermelho', 10, 16.5); z.put('carro-azul', 16.5, 25.5, True); z.put('carro-branco', 34, 14.5)
    z.put('van', 46, 25.2); z.put('carro-amarelo', 8.5, 24.6, True); z.put('carro-verde', 38.5, 18.8)
    z.put('cacamba', 51, 15.4); z.put('carrinho', 31.5, 25.4)
    # mobiliário urbano
    for tx in (7, 20, 36, 49):
        z.put('poste-luz', tx, 10.4)
    for tx in (13, 43):
        z.put('poste-luz', tx, 30.6)
    z.put('semaforo', 29.5, 10.5); z.put('semaforo', 29.5, 30.4)
    z.put('hidrante', 18, 10.6); z.put('hidrante', 41.5, 30.5); z.put('caixa-correio', 31.5, 10.6)
    z.put('banco-pracas', 11, 31.2); z.put('banco-pracas', 21, 31.4); z.put('cone', 14, 13); z.put('cone', 15.2, 13.4)
    # natureza tomando conta
    z.put('arvore-morta', 3.4, 33.0); z.put('arvore-morta', 52, 33.2)
    z.scatter(['mato-alto-1', 'mato-alto-2', 'arbusto-invasor', 'arbusto-seco', 'mato-denso'], 14, (1, 9.5, 55, 11.5))
    z.scatter(['mato-alto-1', 'mato-alto-2', 'arbusto-invasor', 'arbusto-seco', 'mato-denso'], 12, (1, 30, 55, 33.5),
              avoid=[(2.5, 30, 4.5, 33.5), (50.5, 30, 53, 33.5)])
    z.scatter(['raizes-asfalto', 'rachadura-ervas', 'folhas-secas', 'poca-1', 'poca-2'], 18, (1, 12, 54, 28),
              avoid=[(21, 16, 30, 24)])
    z.scatter(['papeis', 'vidro-quebrado', 'latas-garrafas'], 12, (1, 12, 54, 28), avoid=[(21, 16, 30, 24)])
    z.scatter(['tronco-quebrado', 'pilha-lenha'], 3, (1, 31, 55, 33))
    # fachadas: janelas e portas tapadas, pichações e infecção no mercadinho
    for tx in (6, 10, 20, 24):
        z.put('janela-tapada', tx, 4.55)
    z.put('porta-tapada', 38, 4.6); z.put('porta-tapada', 49, 4.6)
    z.put('janela-tapada', 41.5, 4.55); z.put('janela-tapada', 45, 4.55)
    z.put('pichacao-confie', 8.3, 3.9); z.put('pichacao-cura', 22.2, 3.9); z.put('pichacao-vivos', 35.4, 3.5)
    z.put('hera-parede-1', 12.4, 4.6); z.put('hera-parede-2', 27.3, 4.6)
    z.put('cordyceps-parede-1', 40.4, 4.6); z.put('cordyceps-parede-2', 47.3, 4.6)
    z.put('cordyceps-parede-3', 51.6, 4.7)
    # a entrada do mercadinho está barrada e infectada
    z.put('barricada-madeira', 42.8, 7.4); z.put('barricada-madeira', 44.6, 7.6, True)
    z.put('corpo-fungo', 44.5, 9.4); z.put('micelio-1', 47.5, 9.6); z.put('micelio-3', 45.6, 11.2)
    z.put('tentaculos-chao', 49.5, 10.5); z.put('casulo', 51.8, 9.2); z.put('esporos-flutuando', 46, 8)
    z.put('nuvem-esporos', 48.6, 9.8)
    # acampamento improvisado de sobreviventes na calçada
    z.put('abrigo-lona', 16, 8.9); z.put('fogueira', 12.4, 9.6); z.put('mochila-chao', 14.2, 10.3)
    z.put('saco-dormir', 17.8, 10.4); z.put('barril-agua', 9.4, 9.6)


    # ── asfalto pintado e peças dos EUA ──
    def rubble(tx: int, ty: int) -> bool:
        return (tx + 0.5 - 25) ** 2 + (ty + 0.5 - 19) ** 2 < 4.6 ** 2
    def cross(tx: int, ty: int) -> bool:
        return tx in (31, 32)
    z.paint_line('amarela-dupla', 'h', 19, 0, 55, lambda x, y: rubble(x, y) or cross(x, y))
    z.paint_line('faixa-branca', 'h', 15, 0, 55, lambda x, y: rubble(x, y) or cross(x, y))
    z.paint_line('faixa-branca', 'h', 24, 0, 55, lambda x, y: rubble(x, y) or cross(x, y))
    z.paint_line('amarela-borda', 'h', 11, 0, 55)
    z.paint_line('amarela-borda', 'h', 28, 0, 55)
    for ty in range(12, 28):
        if ty != 19:
            z.put('faixa-pedestre-ns', 31.5, ty + 1); z.put('faixa-pedestre-ns', 32.5, ty + 1)
    for ty in range(20, 28):
        z.put('linha-parada-v', 29.5, ty + 1)
    for ty in range(12, 19):
        z.put('linha-parada-v', 34.5, ty + 1)
    z.put('seta-chao', 12.5, 22.5 + 0.5); z.put('seta-chao', 44.5, 16.5 + 0.5, True); z.put('seta-chao', 20.5, 22.5 + 0.5)
    z.put('bueiro', 18.5, 17 + 1); z.put('bueiro', 38.5, 22 + 1); z.put('bueiro', 8.5, 13 + 1)
    # placas e peças americanas nas calçadas
    z.put('placa-hospital', 3.6, 10.9); z.put('bandeira-eua', 22.4, 10.9); z.put('placa-velocidade', 26.4, 10.9)
    z.put('placa-rua', 33.9, 10.9); z.put('placa-mao-unica', 39.6, 10.9); z.put('poste-eletrico', 52.8, 10.95)
    z.put('placa-escola', 6.8, 31.2); z.put('placa-estacionar', 25.6, 31.3); z.put('placa-pare', 32.4, 31.1)
    z.put('parquimetro', 16.6, 30.7); z.put('placa-proibido-entrar', 47.8, 31.1); z.put('outdoor-fedra', 36.5, 33.95)
    z.put('poste-eletrico', 1.6, 31.2); z.put('placa-posto', 23.0, 33.4)
    z.put('onibus-escolar', 40.6, 13.3)
    z.put('pichacao-luz', 17.4, 4.1)

    # luzes: janelas frias, fogueira e o brilho doente do fungo
    z.light('rua-fogueira', 12.4, 8.8, 150, '#ff9a4a', 0.65, 0.35)
    z.light('rua-micelio', 46.8, 9.2, 120, '#9bd96a', 0.3, 0.1)
    for i, tx in enumerate((7, 36)):
        z.light(f'rua-poste-{i}', tx, 8.2, 110, '#cfe4ff', 0.25, 0.05)

    # saídas
    z.portal('hospital', 'Entrar no Hospital Abandonado', 14.4, 6.4, 3, 1.6, ('ruinas-hospital', 'saida-rua'))
    z.portal('quarentena', 'Posto de Quarentena', 54.4, 12, 1.6, 15, ('ruinas-quarentena', 'oeste'))
    z.spawn = {'x': 28 * TILE, 'y': 27 * TILE}
    z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'wind': 0.35}
    z.sound = {'auto': True, 'layers': {'wind': 0.35}}

    z.npc('rua-soldado-morto', 'Soldado caído', 'Corpo (revistar)',
          person('male', SHORT, 'black', SHIRT_CAMO('floresta'), LEGS_CAMO('floresta'),
                 mask=('tlou/mask/mascara-gas',), grime=('tlou/grime/sujeira', 'pesada')), 23.6, 23.2, 'left')
    return z


# ── Zona 2: Posto de Quarentena ──────────────────────────────────────────

def checkpoint() -> Zone:
    z = Zone('ruinas-quarentena', 'Posto de Quarentena', 44, 32, 'tlou-concreto', 202)
    W, H = z.vw, z.vh
    z.paint('tlou-asfalto', 0, 0, 9, H - 1)                    # a estrada que chega
    z.noise('tlou-asfalto-rachado', 4.0, 0.6, 31, (0, 0, 9, H - 1), only='tlou-asfalto')
    z.paint('tlou-terra', 16, 3, 41, 18)                       # chão do acampamento
    z.noise('tlou-lama', 3.5, 0.62, 41, (14, 2, 42, 20), only='tlou-terra')
    z.noise('tlou-mato-invasor', 3.0, 0.68, 43, (10, 20, W - 1, H - 1), only='tlou-concreto')
    z.noise('tlou-grama-seca', 4.0, 0.62, 47, (10, 20, W - 1, H - 1), only='tlou-concreto')
    z.noise('tlou-asfalto-rachado', 4.5, 0.62, 53, (10, 0, W - 1, H - 1), only='tlou-concreto')

    # cancela: duas fileiras de barreiras e sacos de areia com uma abertura no meio
    for ty in (4, 6.7, 9.4, 21.5, 24.2, 26.9):
        z.put('barreira-concreto', 10.6, ty); z.put('barreira-concreto', 13.2, ty, True)
    for ty in (12.6, 14.2):
        z.put('sacos-areia', 11, ty); z.put('sacos-areia', 14, ty, True)
    z.put('cavalete', 11.4, 17.6); z.put('cavalete', 14.2, 18.6, True); z.put('cone', 12, 16.2); z.put('cone', 13.6, 20.2)
    z.put('placa-quarentena', 8.4, 12.4); z.put('placa-perigo', 8.8, 19.6); z.put('placa-estrada', 5.4, 5.6)
    z.put('carro-branco', 5.6, 22.8); z.put('van', 4.4, 9.6)
    # cerca de arame em volta do acampamento
    for tx in range(16, 43, 2):
        z.put('cerca-arame', tx + 0.5, 2.4)
    for tx in range(16, 43, 2):
        z.put('cerca-arame', tx + 0.5, 19.6)
    for ty in (6, 9, 12, 15):
        z.put('cerca-arame', 42.6, ty)
    z.put('arame-farpado', 17, 3.0); z.put('arame-farpado', 30, 3.0); z.put('arame-farpado', 38, 20.2)
    # barracas, gerador e holofotes
    z.put('barraca-militar', 21, 8.6); z.put('barraca-militar', 29, 8.6); z.put('barraca-militar', 37, 8.6)
    z.put('gerador', 40.4, 13.4); z.put('holofote', 17.4, 6.4); z.put('holofote', 41, 5.6)
    z.put('caixotes-pilha', 18.2, 13.6); z.put('caixote', 20, 14.2); z.put('caixote-aberto', 21.4, 14.8)
    z.put('caixa-municao', 22.4, 13.2); z.put('barril-enferrujado', 24.2, 14.6); z.put('barril-agua', 25.4, 14.2)
    # centro de comando
    z.put('mesa-mapa', 29.6, 14.4); z.put('radio', 31.8, 14.0); z.put('cofre', 34.6, 15.0)
    z.put('fogueira', 27.6, 11.6); z.put('lampiao', 33.6, 12.4); z.put('caixa-ferramentas', 36.8, 15.2)
    z.put('armario-ferro', 38.4, 16.8)
    # lado de fora: sobreviventes mortos e fungo chegando
    z.put('corpo-fungo', 22, 26.2); z.put('casulo', 26.4, 28.4); z.put('micelio-1', 24, 24.6); z.put('micelio-2', 28.4, 26.2)
    z.put('tentaculos-chao', 30.8, 27.6); z.put('esporos-flutuando', 27, 24.4)
    z.put('arvore-morta', 40, 30.4); z.put('arvore-morta', 18, 30.8)
    z.put('pichacao-confie', 12.2, 2.6)
    z.scatter(['mato-alto-1', 'mato-alto-2', 'arbusto-invasor', 'arbusto-seco'], 12, (15, 21, 43, 31.5),
              avoid=[(20, 23, 33, 29.5)])
    z.scatter(['papeis', 'latas-garrafas', 'vidro-quebrado', 'rachadura-ervas', 'folhas-secas'], 14, (1, 1, 43, 31))


    # ── estrada pintada e placas dos EUA ──
    z.paint_line('amarela-dupla', 'v', 4, 0, 31)
    z.paint_line('faixa-branca', 'v', 1, 0, 31)
    z.paint_line('faixa-branca', 'v', 7, 0, 31)
    z.paint_line('amarela-borda', 'v', 9, 0, 31)
    for tx in (4,):
        z.put('linha-parada-h', tx + 0.5, 15 + 1)
    z.put('seta-chao', 2.5, 8 + 0.5); z.put('seta-chao', 6.5, 26 + 0.5)
    z.put('bueiro', 6.5, 14 + 1); z.put('bueiro', 2.5, 20 + 1)
    z.put('placa-velocidade', 9.5, 3.4); z.put('placa-pare', 9.6, 29.4); z.put('placa-trem', 1.8, 28.2)
    z.put('poste-eletrico', 9.6, 22.6); z.put('caixa-correio-rural', 9.4, 16.4); z.put('placa-saida', 3.0, 3.2)

    z.light('quar-holofote-1', 17.4, 5.2, 200, '#dfeeff', 0.55, 0.05)
    z.light('quar-holofote-2', 41, 4.4, 200, '#dfeeff', 0.55, 0.05)
    z.light('quar-fogueira', 27.6, 10.8, 150, '#ff9a4a', 0.6, 0.3)
    z.light('quar-gerador', 40.4, 12.4, 100, '#ffd36a', 0.3, 0.2)
    z.light('quar-micelio', 26, 26.4, 130, '#9bd96a', 0.28, 0.1)

    z.portal('oeste', 'Voltar à rua da cidade', 0, 0, 1.6, 32, ('ruinas-rua', 'quarentena'))
    z.spawn = {'x': 6 * TILE, 'y': 16 * TILE}
    z.lighting = {'place': 'outdoor', 'particles': True, 'clouds': True, 'wind': 0.4}
    z.sound = {'auto': True, 'layers': {'wind': 0.4}}

    z.npc('quar-guarda', 'Guarda da cancela', 'Soldado da quarentena',
          person('male', SHORT, 'black', SHIRT_CAMO('urbana'), LEGS_CAMO('urbana'), 'black',
                 armour=('tlou/armour/colete-tatico', 'preto'), mask=('tlou/mask/mascara-gas',),
                 weapon_hand=('tlou/weapon_hand/rifle',)), 12.4, 15.6, 'left')
    z.npc('quar-oficial', 'Oficial do posto', 'Comandante',
          person('male', SHORT, 'gray', SHIRT_CAMO('floresta'), LEGS_CAMO('floresta'), 'black',
                 armour=('tlou/armour/colete-tatico', 'oliva'), weapon_hip=('tlou/weapon_hip/pistola',)), 30.4, 16.4, 'up')
    z.npc('quar-medica', 'Médica do campo', 'Triagem',
          person('female', LONG, 'dark_brown', SHIRT_DIRTY('branca'), LEGS_DIRTY('jeans'), 'black',
                 mask=('tlou/mask/mascara-gas',)), 23.6, 11.4, 'right')
    z.npc('quar-sobrevivente', 'Sobrevivente assustado', 'Quer entrar',
          person('male', SHORT, 'chestnut', SHIRT_PLAID('azul'), LEGS_DIRTY('jeans'),
                 grime=('tlou/grime/sujeira', 'leve'), weapon_back=('tlou/weapon_back/taco',)), 7.6, 17.2, 'right')
    return z


# ── Zona 3: Hospital Abandonado ───────────────────────────────────────────

def hospital() -> Zone:
    z = Zone('ruinas-hospital', 'Hospital Abandonado', 46, 38, 'tlou-piso-hospital', 303)
    FL, WL, CL = 'tlou-piso-hospital', 'wall-81', 'ceil-9'
    # enfermaria (em cima) e recepção (embaixo), a parede da recepção divide as duas
    z.room(0, 0, 46, 17, FL, WL, CL, 4)
    z.room(0, 18, 46, 38, FL, WL, CL, 4)
    z.door(20, 25, 18, 22, FL)                               # porta entre as duas
    z.door(36, 39, 18, 22, FL)                               # segunda passagem
    # sujeira do chão: carpete sujo na recepção, fungo no canto da enfermaria
    z.noise('tlou-carpete-sujo', 5.0, 0.66, 61, (2, 23, 43, 38), only=FL)
    z.disc('tlou-micelio', 4, 12, 4.4, 11)
    z.disc('tlou-micelio', 6, 30, 3.0, 13)
    z.disc('tlou-entulho', 38, 33, 2.6, 15)

    # ─ enfermaria: camas, soros e vestígios
    for tx in (7, 12, 17, 22):
        z.put('cama-hospital', tx, 9.2); z.put('suporte-soro', tx + 1.4, 9.4)
    for tx in (28, 33, 38):
        z.put('cama-hospital', tx, 9.2); z.put('suporte-soro', tx + 1.4, 9.4, True)
    for tx in (9, 14.5, 20, 31, 36):
        z.put('cama-hospital', tx, 15.4, tx > 25); z.put('suporte-soro', tx + 1.5, 15.2)
    z.put('colchao-sujo', 26, 13.2); z.put('kit-medico', 24.4, 15.6); z.put('caixa-municao', 27.4, 15.4)
    z.put('armario-ferro', 42, 7.4); z.put('armario-ferro', 40.4, 7.4); z.put('bancada', 41.4, 11.4)
    z.put('caixa-ferramentas', 43, 14.4); z.put('mochila-chao', 4.6, 15.4)
    # fungo tomando a ala oeste
    z.put('cordyceps-parede-1', 4.4, 4.7); z.put('cordyceps-parede-3', 7.6, 4.7)
    z.put('cordyceps-parede-2', 10.8, 4.7); z.put('fungo-teto', 5.6, 6.6)
    z.put('corpo-fungo', 3.6, 11.4); z.put('casulo', 5.8, 13.6); z.put('micelio-1', 3, 13.6)
    z.put('micelio-3', 6.4, 11); z.put('tentaculos-chao', 4.4, 8.6); z.put('bulbo-esporos', 2.8, 9.6)
    z.put('esporos-flutuando', 5, 10); z.put('nuvem-esporos', 4.6, 12.4)
    z.put('janela-tapada', 15, 4.5); z.put('janela-tapada', 25, 4.5); z.put('janela-tapada', 34, 4.5)
    z.put('pichacao-vivos', 20, 3.7); z.put('pichacao-cura', 30, 3.7)
    z.put('papeis', 18, 12.6); z.put('vidro-quebrado', 30, 12.2); z.put('latas-garrafas', 22.4, 13)
    # ─ recepção: balcão, sala de espera e barricada na saída
    z.put('bancada', 21, 27.4); z.put('bancada', 24, 27.4, True); z.put('caixa-ferramentas', 22.6, 26.4)
    z.put('radio', 23.4, 26.8); z.put('papeis', 19.6, 28.6); z.put('lanterna', 25.6, 26.6)
    for tx in (6, 10, 14):
        z.put('banco-pracas', tx, 31.4)
    for tx in (32, 36, 40):
        z.put('banco-pracas', tx, 31.6, True)
    z.put('caixotes-pilha', 4, 36.4); z.put('caixote', 5.6, 36.8); z.put('caixote-aberto', 7.2, 36.6)
    z.put('barricada-madeira', 19.6, 37.4); z.put('barricada-madeira', 25.6, 37.4, True)
    z.put('entulho', 37.6, 34.6); z.put('laje', 40, 35); z.put('pilar-quebrado', 36.4, 36); z.put('sacos-lixo', 41.6, 34)
    z.put('janela-tapada', 8, 22.5); z.put('janela-tapada', 14.5, 22.5); z.put('janela-tapada', 31, 22.5)
    z.put('pichacao-confie', 11, 21.7); z.put('pichacao-cura', 42, 21.7)
    z.put('kit-medico', 30, 31.2); z.put('mochila-chao', 28.6, 34.2); z.put('saco-dormir', 12.6, 35)
    z.put('hera-parede-1', 17.6, 22.6); z.put('hera-parede-2', 28, 22.6)

    for i, (tx, ty) in enumerate(((15, 5), (25, 5), (34, 5), (8, 23.4), (14.5, 23.4), (31, 23.4))):
        z.light(f'hosp-janela-{i}', tx, ty + 1, 130, '#9cc4ff', 0.34, 0.04)
    z.light('hosp-lanterna', 25.6, 26, 120, '#ffd9a0', 0.5, 0.25)
    z.light('hosp-emergencia', 23, 19, 160, '#ff4a3a', 0.2, 0.5)
    z.light('hosp-micelio', 4.4, 11, 150, '#9bd96a', 0.32, 0.12)

    z.portal('saida-rua', 'Sair para a rua', 21, 36.6, 4, 1.4, ('ruinas-rua', 'hospital'))
    z.portal('escada', 'Escada para o subsolo', 41.2, 5.7, 2.6, 1.4, ('ruinas-subsolo', 'sobe'))
    z.spawn = {'x': 23 * TILE, 'y': 35 * TILE}
    z.lighting = {'place': 'indoor', 'particles': True, 'clouds': False}
    z.sound = {'auto': True, 'layers': {'spooky': 0.25}}

    z.npc('hosp-corredor', 'Corredor', 'Infectado',
          person('male', SHORT, 'chestnut', SHIRT_DIRTY('cinza'), LEGS_DIRTY('jeans'),
                 infection=('tlou/infection/veias',), grime=('tlou/grime/sujeira', 'pesada')), 10, 12.6, 'down')
    z.npc('hosp-medico', 'Doutor Almeida', 'Médico sobrevivente',
          person('male', SHORT, 'gray', SHIRT_DIRTY('branca'), LEGS_DIRTY('preta'), 'black',
                 mask=('tlou/mask/mascara-gas',), weapon_hip=('tlou/weapon_hip/faca',)), 23, 24.6, 'down')
    return z


# ── Zona 4: Subsolo Infectado ──────────────────────────────────────────

def basement() -> Zone:
    z = Zone('ruinas-subsolo', 'Subsolo Infectado', 40, 30, 'tlou-micelio', 404)
    FL, WL, CL = 'tlou-micelio', 'wall-49', 'ceil-25'
    z.room(1, 0, 38, 29, FL, WL, CL, 4)
    z.noise('tlou-concreto', 4.0, 0.6, 71, (2, 6, 37, 29), only=FL)
    z.noise('tlou-lama', 3.5, 0.66, 73, (2, 6, 37, 29), only=FL)
    z.noise('tlou-madeira-podre', 4.0, 0.7, 79, (2, 6, 37, 29), only='tlou-concreto')

    # parede do fundo coberta de cordyceps e a saída pra escada
    for tx, k in ((5, 1), (9, 3), (13, 2), (18, 1), (23, 3), (27, 2), (32, 1), (35, 3)):
        z.put(f'cordyceps-parede-{k}', tx, 4.7)
    z.put('fungo-teto', 8, 7.4); z.put('fungo-teto', 19, 7.6); z.put('fungo-teto', 31, 7.4)
    # o ninho
    z.put('arvore-fungo', 20, 17.4); z.put('bulbo-esporos', 16.4, 15.8); z.put('bulbo-esporos', 24, 16.6)
    z.put('bulbo-esporos', 12, 21.4); z.put('bulbo-esporos', 29.4, 22.4)
    for (tx, ty) in ((14, 10.6), (26, 11.2), (8, 14), (32, 15), (10, 25), (30, 26), (21, 24)):
        z.put('casulo', tx, ty)
    for (tx, ty, k) in ((17, 12.4, 1), (23, 13.6, 3), (7, 18, 2), (33, 19.6, 1), (15, 22.8, 3), (26, 25, 2), (36, 12, 1)):
        z.put(f'micelio-{k}', tx, ty)
    z.put('tentaculos-chao', 12.6, 18.6); z.put('tentaculos-chao', 28.4, 18.4, True); z.put('tentaculos-chao', 20, 22)
    z.put('corpo-fungo', 18.2, 20.6); z.put('corpo-fungo', 25.6, 20.2, True); z.put('corpo-fungo', 9.4, 12.4)
    z.put('tronco-fungo-1', 11, 16); z.put('tronco-fungo-2', 31, 17.4); z.put('tronco-fungo-1', 22, 9.4)
    z.put('nuvem-esporos', 19, 13); z.put('nuvem-esporos', 27, 20); z.put('nuvem-esporos', 11, 18)
    z.put('esporos-flutuando', 16, 14); z.put('esporos-flutuando', 24, 18); z.put('esporos-flutuando', 14, 24)
    # restos da expedição que desceu
    z.put('mochila-chao', 4.4, 8.6); z.put('lanterna', 5.6, 8.8); z.put('kit-medico', 3.2, 9.4)
    z.put('caixote-aberto', 35.4, 8.6); z.put('caixa-municao', 33.8, 9.6); z.put('cama-hospital', 36.2, 24.4)
    z.put('suporte-soro', 35, 22.6); z.put('barril-enferrujado', 3.4, 26.4); z.put('barril-enferrujado', 5, 27.4)
    z.put('papeis', 6.6, 22); z.put('latas-garrafas', 8.4, 24.4); z.put('vidro-quebrado', 28, 7.6)

    z.light('sub-lanterna', 5.6, 8, 160, '#ffd9a0', 0.55, 0.3)
    z.light('sub-ninho', 20, 16, 300, '#8bd45a', 0.6, 0.15)
    z.light('sub-bulbo-1', 16.4, 15, 120, '#b4ff7a', 0.5, 0.2)
    z.light('sub-bulbo-2', 24, 15.8, 120, '#b4ff7a', 0.5, 0.2)
    z.light('sub-bulbo-3', 12, 20.4, 110, '#b4ff7a', 0.4, 0.25)
    z.light('sub-bulbo-4', 29.4, 21.4, 110, '#b4ff7a', 0.4, 0.25)
    z.light('sub-parede', 20, 6, 220, '#7ccf5a', 0.3, 0.1)
    z.light('sub-escada', 33, 5.5, 150, '#9cc4ff', 0.4, 0.05)

    z.portal('sobe', 'Subir para o hospital', 32, 5.4, 3.2, 1.4, ('ruinas-hospital', 'escada'))
    z.spawn = {'x': 33 * TILE, 'y': 8 * TILE}
    z.lighting = {'place': 'underground', 'tint': '#2a3d2e', 'particles': True}
    z.sound = {'auto': True, 'layers': {'spooky': 0.55, 'cave': 0.35}}

    z.npc('sub-estalador-1', 'Estalador', 'Infectado cego (escuta tudo)',
          person('male', SHORT, 'chestnut', SHIRT_DIRTY('bege'), LEGS_DIRTY('cargo'),
                 infection=('tlou/infection/estalador',), grime=('tlou/grime/sujeira', 'lama')), 15, 19.4, 'left')
    z.npc('sub-estalador-2', 'Estalador', 'Infectado cego (escuta tudo)',
          person('female', LONG, 'dark_brown', SHIRT_DIRTY('cinza'), LEGS_DIRTY('jeans'),
                 infection=('tlou/infection/estalador',), grime=('tlou/grime/sujeira', 'pesada')), 26, 22.4, 'up')
    z.npc('sub-corredor', 'Corredor', 'Infectado (corre atrás do barulho)',
          person('male', SHORT, 'black', SHIRT_PLAID('marrom'), LEGS_DIRTY('preta'),
                 infection=('tlou/infection/veias',)), 30, 12.6, 'down')
    return z


# ── Mundo ─────────────────────────────────────────────────────────────────

def build() -> dict:
    zones = [street(), checkpoint(), hospital(), basement()]
    return {
        'format': 'vortable-world', 'version': 1,
        'world': {
            'version': 1, 'id': 'mundo-ruinas', 'name': 'CIDADE EM RUÍNAS', 'start': 'ruinas-rua',
            'layout': {'ruinas-rua': {'x': 0, 'y': 0}, 'ruinas-quarentena': {'x': 1, 'y': 0},
                       'ruinas-hospital': {'x': 0, 'y': -1}, 'ruinas-subsolo': {'x': 0, 'y': -2}},
            'sky': {'hour': 16.5, 'weather': 'cloudy'},
        },
        'zones': [z.data() for z in zones],
    }


def generate(public: str) -> None:
    bundle = build()
    path = os.path.join(public, MAP)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')))
    print(f'mundo: {len(bundle["zones"])} zonas, {sum(len(z["objects"]) for z in bundle["zones"])} objetos, '
          f'{sum(len(z.get("npcs", [])) for z in bundle["zones"])} NPCs -> {MAP}')
