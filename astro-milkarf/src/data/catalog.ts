export type PresentationSize = '250gr' | '500gr';
export type FormulaId = 'pollo' | 'res';

export interface Presentation {
    size: string;
    grams: number;
    price: number;
    available: boolean;
}

export interface Formula {
    id: FormulaId;
    name: string;
    shortName: string;
    emoji: string;
    available: boolean;
    presentations: Presentation[];
}

export interface PlanDiscount {
    days: number;
    label: string;
    discountPct: number;
    tag: string;
}

export interface MilkarfConfig {
    calcEngineVersion: string;
    catalog: Record<FormulaId, Formula>;
    planDiscounts: Record<number, PlanDiscount>;
    welcomeDiscountPct: number;
}

export const WA_NUMBER = '584121791137';

export const PRICES_POLLO: Record<PresentationSize, string> = { '250gr': '$2.50', '500gr': '$5.00' };
export const PRICES_RES: Record<PresentationSize, string> = { '250gr': '$3.50', '500gr': '$7.00' };

export const MILKARF_CONFIG: MilkarfConfig = {
    calcEngineVersion: 'v2.0_plan_based_low_activity',
    catalog: {
        pollo: {
            id: 'pollo',
            name: 'Pollo con Zanahoria',
            shortName: 'Pollo',
            emoji: '🍗',
            available: true,
            presentations: [
                { size: '250gr', grams: 250, price: 2.5, available: true },
                { size: '500gr', grams: 500, price: 5.0, available: true }
            ]
        },
        res: {
            id: 'res',
            name: 'Carne de Res con Calabacín',
            shortName: 'Res',
            emoji: '🥩',
            available: true,
            presentations: [
                { size: '250gr', grams: 250, price: 3.5, available: true },
                { size: '500gr', grams: 500, price: 7.0, available: true }
            ]
        }
    },
    planDiscounts: {
        7: { days: 7, label: 'Plan semanal', discountPct: 0.05, tag: '7 días de alimentación' },
        15: { days: 15, label: 'Plan quincenal', discountPct: 0.075, tag: '15 días de alimentación' },
        30: { days: 30, label: 'Plan mensual', discountPct: 0.1, tag: 'Mayor ahorro' }
    },
    welcomeDiscountPct: 0.2
};

export const PLAN_DAYS = [7, 15, 30] as const;