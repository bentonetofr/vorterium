import { type ObjectDef, type ObjectKind, type ObjectLight, type Rect } from '../assets/objects';
/** O ajuste gravado no pack.json (sem solids/sort = colisão automática). */
export interface CurateOverride {
    label: string;
    category: string;
    tags: string[];
    kind: ObjectKind;
    solids?: Rect[];
    sort?: number;
    light: ObjectLight | null;
    fps?: number;
    hidden?: boolean;
}
export declare function curateForm(def: ObjectDef, image: CanvasImageSource, categories: string[]): {
    body: HTMLDivElement[];
    value(): CurateOverride;
};
