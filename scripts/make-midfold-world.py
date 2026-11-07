"""Gera o mundo pronto MIDFOLD do Vortable (public/vortable/maps/midfold.mundo.json).

uso (da raiz do projeto):
    python scripts/make-midfold-world.py          gera o arquivo e confere as saídas e o encadeamento das zonas
    python scripts/make-midfold-world.py --check  só confere o arquivo que já está no disco

Reaproveita as ferramentas do Saltmore (scripts/saltmore) e só usa peças que já existem nos catálogos do Vortable.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.stdout.reconfigure(encoding='utf-8')


def main() -> None:
    from midfold import world
    from saltmore import verify
    if '--check' not in sys.argv[1:]:
        world.generate()
    sys.exit(1 if verify.verify(world.MAP) else 0)


if __name__ == '__main__':
    main()
