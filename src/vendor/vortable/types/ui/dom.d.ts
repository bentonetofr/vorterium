export type Children = (Node | string | null | undefined | false)[];
/** Cria um elemento: h('button', { class: 'x', onclick }, 'texto', outroNó). */
export declare function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, unknown>, ...children: Children): HTMLElementTagNameMap[K];
/** Põe uma folha de estilo na página uma vez só. */
export declare function injectStyle(id: string, css: string): void;
