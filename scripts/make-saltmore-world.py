"""Gera o mundo pronto SALTMORE do Vortable (public/vortable/maps/saltmore.mundo.json).

uso (da raiz do projeto):
    python scripts/make-saltmore-world.py          gera o arquivo e confere as saídas e o encadeamento das zonas
    python scripts/make-saltmore-world.py --check  só confere o arquivo que já está no disco (dá pra ir de uma saída a outra andando?)
    python scripts/make-saltmore-world.py --gallery out.png medieval:Vila    folha de contato de objetos do catálogo (pack:categoria)

Usa só o que já existe nos catálogos do Vortable (terrenos, objetos e peças de personagem): nenhuma arte nova, então não
depende da sincronização do motor. Os ids dos objetos são estáveis (`folha@x,y`).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.stdout.reconfigure(encoding='utf-8')


def main() -> None:
    args = sys.argv[1:]
    if '--gallery' in args:
        from saltmore import gallery
        i = args.index('--gallery')
        gallery.render(gallery.pick(args[i + 2:]), args[i + 1])
        print('folha de contato pronta')
        return
    from saltmore import verify, world
    if '--check' not in args:
        world.generate()
    sys.exit(1 if verify.verify(world.MAP) else 0)


if __name__ == '__main__':
    main()
