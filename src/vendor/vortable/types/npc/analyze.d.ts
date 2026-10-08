import type { ZoneData } from '../types';
export type ProfileId = 'biblioteca' | 'taverna' | 'vila' | 'mercado' | 'fazenda' | 'floresta' | 'cemiterio' | 'masmorra' | 'neve' | 'geral';
export declare const PROFILE_LABELS: Record<ProfileId, string>;
export interface ZoneAnalysis {
    profile: ProfileId;
    label: string;
    /** Por que esse estilo (pra mostrar ao mestre, curto). */
    reasons: string[];
    scores: Record<ProfileId, number>;
}
export declare function analyzeZone(zone: ZoneData): ZoneAnalysis;
