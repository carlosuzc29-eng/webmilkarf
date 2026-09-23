// Cálculo centralizado de planes de alimentación (fuente canónica del nuevo sitio).
// Espeja 1:1 la lógica de `app.js` (computePlanPricing / buildFeedingPlan /
// generateFeedingPlans / getPresentationBySize / optimizeBags*), pero pura:
// sin dependencia de `window`. Los tests de divergencia comparan contra el legacy.

import { MILKARF_CONFIG } from '../data/catalog';
import type { Formula } from '../data/catalog';

export type BagSize = '250gr' | '550gr';

export interface BagItem {
    formula: string;
    formulaName: string;
    size: string;
    weight: string;
    grams: number;
    qty: number;
    unitPrice: number;
}

export interface SplitInfo {
    polloGrams: number;
    resGrams: number;
    polloPct: number;
    resPct: number;
}

export interface PlanPricing {
    requiredGrams: number;
    totalGrams: number;
    surplusGrams: number;
    totalBags: number;
    includedGrams: number;
    bags: BagItem[];
    split: SplitInfo | null;
    subtotal: number;
    originalSubtotal: number;
    discountInfo: { days: number; label: string; discountPct: number; tag: string };
    discountPct: number;
    discountPercent: number;
    discountAmount: number;
    finalPrice: number;
    costPerDay: number;
    presentation: string;
    presentationGrams: number;
    presentationPrice: number;
}

export interface FeedingPlan extends PlanPricing {
    id: string;
    petName: string;
    petWeight: number | null;
    petId: string | null;
    calcVersion: string;
    days: number;
    durationDays: number;
    label: string;
    tag: string;
    formula: string;
    formulaLabel: string;
    formulaName: string;
    dailyGrams: number;
    totalGramsRequired: number;
    requiredKg: string;
    includedKg: string;
    totalGramsProvided: number;
    surplusKg: string;
    bagsCount: number;
    presentationBreakdown: {
        bagSize: string;
        bagGrams: number;
        bagPrice: number;
        bagsCount: number;
        requiredGrams: number;
        providedGrams: number;
        surplusGrams: number;
    };
    originalPrice: number;
    price: number;
    savings: number;
    createdAt: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function getPresentationBySize(formula: string, bagSize?: string): { size: string; grams: number; price: number; available: boolean } | null {
    const prod = MILKARF_CONFIG.catalog?.[formula as keyof typeof MILKARF_CONFIG.catalog];
    if (!prod) return null;
    const list = prod.presentations || [];
    return list.find(p => p.size === bagSize) || list.find(p => p.available) || list[0] || null;
}

export function optimizeBagsSingle(formula: string, requiredGrams: number) {
    const prod = MILKARF_CONFIG.catalog[formula as keyof typeof MILKARF_CONFIG.catalog];
    if (!prod || !prod.available) throw new Error(`Fórmula ${formula} no disponible.`);
    const activePres = prod.presentations.filter(p => p.available);
    if (!activePres.length) throw new Error(`No hay presentaciones activas para ${formula}`);

    const pres = [...activePres].sort((a, b) => b.grams - a.grams);
    const validCombinations: Array<{ bags: BagItem[]; totalGrams: number; surplus: number; cost: number; totalBags: number }> = [];

    if (pres.length === 2) {
        const [p1, p2] = pres;
        const maxP1 = Math.ceil(requiredGrams / p1.grams) + 1;
        for (let c1 = 0; c1 <= maxP1; c1++) {
            const rem = Math.max(0, requiredGrams - c1 * p1.grams);
            const c2 = Math.ceil(rem / p2.grams);
            const totalGrams = c1 * p1.grams + c2 * p2.grams;
            if (totalGrams >= requiredGrams) {
                validCombinations.push({
                    bags: [
                        ...(c1 > 0 ? [{ formula, formulaName: prod.name, size: p1.size, weight: p1.size, grams: p1.grams, qty: c1, unitPrice: p1.price }] : []),
                        ...(c2 > 0 ? [{ formula, formulaName: prod.name, size: p2.size, weight: p2.size, grams: p2.grams, qty: c2, unitPrice: p2.price }] : [])
                    ],
                    totalGrams,
                    surplus: totalGrams - requiredGrams,
                    cost: c1 * p1.price + c2 * p2.price,
                    totalBags: c1 + c2
                });
            }
        }
    } else {
        function search(idx: number, currentGrams: number, currentCost: number, currentBags: BagItem[]) {
            if (idx === pres.length) {
                if (currentGrams >= requiredGrams) {
                    validCombinations.push({
                        bags: currentBags.filter(b => b.qty > 0),
                        totalGrams: currentGrams,
                        surplus: currentGrams - requiredGrams,
                        cost: currentCost,
                        totalBags: currentBags.reduce((s, b) => s + b.qty, 0)
                    });
                }
                return;
            }
            const p = pres[idx];
            const maxNeeded = Math.ceil(Math.max(0, requiredGrams - currentGrams) / p.grams) + 1;
            for (let q = 0; q <= maxNeeded; q++) {
                currentBags.push({ formula, formulaName: prod.name, size: p.size, weight: p.size, grams: p.grams, qty: q, unitPrice: p.price });
                search(idx + 1, currentGrams + q * p.grams, currentCost + q * p.price, currentBags);
                currentBags.pop();
            }
        }
        search(0, 0, 0, []);
    }

    if (!validCombinations.length) throw new Error('No se pudo generar combinación de bolsas.');

    validCombinations.sort((a, b) => {
        if (a.surplus !== b.surplus) return a.surplus - b.surplus;
        if (Math.abs(a.cost - b.cost) > 0.001) return a.cost - b.cost;
        return a.totalBags - b.totalBags;
    });

    return validCombinations[0];
}

export function optimizeBagsMixed(requiredGrams: number) {
    const polloProd = MILKARF_CONFIG.catalog.pollo;
    const resProd = MILKARF_CONFIG.catalog.res;

    function getBestBagsForGrams(formula: string, targetGrams: number) {
        const prod = MILKARF_CONFIG.catalog[formula as keyof typeof MILKARF_CONFIG.catalog] as Formula;
        const [p1, p2] = prod.presentations.sort((a, b) => b.grams - a.grams);
        const combos: Array<{ bags: BagItem[]; totalGrams: number; cost: number; totalBags: number }> = [];
        const maxP1 = Math.floor(targetGrams / p1.grams);
        for (let c1 = 0; c1 <= maxP1; c1++) {
            const rem = targetGrams - c1 * p1.grams;
            if (rem % p2.grams === 0) {
                const c2 = rem / p2.grams;
                combos.push({
                    bags: [
                        ...(c1 > 0 ? [{ formula, formulaName: prod.name, size: p1.size, weight: p1.size, grams: p1.grams, qty: c1, unitPrice: p1.price }] : []),
                        ...(c2 > 0 ? [{ formula, formulaName: prod.name, size: p2.size, weight: p2.size, grams: p2.grams, qty: c2, unitPrice: p2.price }] : [])
                    ],
                    totalGrams: targetGrams,
                    cost: c1 * p1.price + c2 * p2.price,
                    totalBags: c1 + c2
                });
            }
        }
        combos.sort((a, b) => {
            if (Math.abs(a.cost - b.cost) > 0.001) return a.cost - b.cost;
            return a.totalBags - b.totalBags;
        });
        return combos[0] || null;
    }

    void polloProd;
    void resProd;

    const validMixed: Array<{ bags: BagItem[]; totalGrams: number; surplus: number; diffFromHalf: number; cost: number; totalBags: number; split: { polloGrams: number; resGrams: number; polloPct: number; resPct: number } }> = [];
    for (let gPollo = 250; gPollo <= requiredGrams; gPollo += 250) {
        const minGRes = Math.max(250, Math.ceil((requiredGrams - gPollo) / 250) * 250);
        for (let gRes = minGRes; gRes <= minGRes + 500; gRes += 250) {
            const totalGrams = gPollo + gRes;
            if (totalGrams >= requiredGrams) {
                const polloOpt = getBestBagsForGrams('pollo', gPollo);
                const resOpt = getBestBagsForGrams('res', gRes);
                if (polloOpt && resOpt) {
                    const surplus = totalGrams - requiredGrams;
                    const diffFromHalf = Math.abs(gPollo - gRes);
                    const cost = polloOpt.cost + resOpt.cost;
                    const totalBags = polloOpt.totalBags + resOpt.totalBags;
                    validMixed.push({
                        bags: [...polloOpt.bags, ...resOpt.bags],
                        totalGrams,
                        surplus,
                        diffFromHalf,
                        cost,
                        totalBags,
                        split: {
                            polloGrams: gPollo,
                            resGrams: gRes,
                            polloPct: Math.round((gPollo / totalGrams) * 100),
                            resPct: Math.round((gRes / totalGrams) * 100)
                        }
                    });
                }
            }
        }
    }

    if (!validMixed.length) throw new Error('No se pudo generar combinación mixta.');

    validMixed.sort((a, b) => {
        if (a.surplus !== b.surplus) return a.surplus - b.surplus;
        if (a.diffFromHalf !== b.diffFromHalf) return a.diffFromHalf - b.diffFromHalf;
        if (Math.abs(a.cost - b.cost) > 0.001) return a.cost - b.cost;
        return a.totalBags - b.totalBags;
    });

    return validMixed[0];
}

export function getBagRecommendation(grams = 0) {
    const g = Number(grams) || 0;
    if (g <= 250) return { size: '250g', label: '250 g', text: 'Presentación sugerida: 250 g para prueba inicial, razas pequeñas o consumo moderado.' };
    return { size: '550g', label: '550 g', text: 'Presentación sugerida: 550 g para perros medianos, grandes o planificación regular de raciones.' };
}

/**
 * Es la ÚNICA fuente de verdad de los planes de alimentación (misma lógica que app.js).
 * @param bagSize Presentación seleccionada (250gr | 550gr).
 */
export function computePlanPricing(dailyGrams: number, days: number, formula: string, bagSize: string = '550gr'): PlanPricing {
    const pts = Number(days) > 0 ? Number(days) : 7;
    const dG = Math.max(0, Number(dailyGrams) || 0);
    const requiredGrams = Math.round(dG * pts);
    const discountInfo = MILKARF_CONFIG?.planDiscounts?.[pts] || { days: pts, discountPct: 0, label: `Plan ${pts} días`, tag: `${pts} días de alimentación` };

    const bags: BagItem[] = [];
    let totalGrams = 0;
    let cost = 0;
    let split: SplitInfo | null = null;

    const getPriceFor = (f: string) => getPresentationBySize(f, bagSize);

    if (formula === 'mixto') {
        const polloGrams = Math.round(requiredGrams / 2);
        const resGrams = requiredGrams - polloGrams;
        for (const part of [{ f: 'pollo', grams: polloGrams }, { f: 'res', grams: resGrams }]) {
            const pres = getPriceFor(part.f);
            if (!pres || !MILKARF_CONFIG.catalog[part.f as keyof typeof MILKARF_CONFIG.catalog]?.available) continue;
            const qty = part.grams > 0 ? Math.ceil(part.grams / pres.grams) : 0;
            if (!qty) continue;
            bags.push({
                formula: part.f,
                formulaName: MILKARF_CONFIG.catalog[part.f as keyof typeof MILKARF_CONFIG.catalog].name,
                size: pres.size,
                weight: pres.size,
                grams: pres.grams,
                qty,
                unitPrice: pres.price
            });
            totalGrams += qty * pres.grams;
            cost += qty * pres.price;
        }
        split = { polloGrams, resGrams, polloPct: 50, resPct: 50 };
    } else {
        const pres = getPriceFor(formula);
        if (pres && MILKARF_CONFIG.catalog[formula as keyof typeof MILKARF_CONFIG.catalog]?.available) {
            const qty = requiredGrams > 0 ? Math.max(1, Math.ceil(requiredGrams / pres.grams)) : 0;
            if (qty > 0) {
                bags.push({
                    formula,
                    formulaName: MILKARF_CONFIG.catalog[formula as keyof typeof MILKARF_CONFIG.catalog].name,
                    size: pres.size,
                    weight: pres.size,
                    grams: pres.grams,
                    qty,
                    unitPrice: pres.price
                });
            }
            totalGrams = qty * pres.grams;
            cost = qty * pres.price;
        }
    }

    const surplusGrams = Math.max(0, totalGrams - requiredGrams);
    const subtotal = round2(cost);
    const discountAmount = round2(subtotal * (Number(discountInfo.discountPct) || 0));
    const finalPrice = round2(subtotal - discountAmount);
    const costPerDay = pts > 0 ? round2(finalPrice / pts) : 0;
    const totalBags = bags.reduce((s, b) => s + b.qty, 0);

    return {
        requiredGrams,
        totalGrams,
        surplusGrams,
        totalBags,
        includedGrams: totalGrams,
        bags,
        split,
        subtotal,
        originalSubtotal: subtotal,
        discountInfo,
        discountPct: discountInfo.discountPct || 0,
        discountPercent: Math.round((discountInfo.discountPct || 0) * 100),
        discountAmount,
        finalPrice,
        costPerDay,
        presentation: (bags[0] && bags[0].size) || String(bagSize || '550gr'),
        presentationGrams: bags[0]?.grams || 0,
        presentationPrice: bags[0]?.unitPrice || 0
    };
}

export function buildFeedingPlan(
    dailyGrams: number,
    days: number,
    formula: string,
    petName = '',
    bagSize: string = '550gr',
    petWeight: number | null = null
): FeedingPlan {
    const pts = Number(days) || 7;
    const pricing = computePlanPricing(dailyGrams, pts, formula, bagSize);
    const discountInfo = pricing.discountInfo;

    const formulaLabel =
        formula === 'pollo' ? 'Pollo con Zanahoria' : formula === 'res' ? 'Carne de Res con Calabacín' : 'Plan Mixto (Pollo y Res)';

    return {
        id: 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        petName: petName || 'Tu perro',
        petWeight: petWeight ?? null,
        petId: null,
        calcVersion: MILKARF_CONFIG.calcEngineVersion,
        days: pts,
        durationDays: pts,
        label: discountInfo.label,
        tag: discountInfo.tag,
        formula,
        formulaLabel,
        formulaName: formulaLabel,
        dailyGrams,
        requiredGrams: pricing.requiredGrams,
        totalGramsRequired: pricing.requiredGrams,
        requiredKg: (pricing.requiredGrams / 1000).toFixed(2),
        includedGrams: pricing.totalGrams,
        totalGramsProvided: pricing.totalGrams,
        includedKg: (pricing.totalGrams / 1000).toFixed(2),
        surplusGrams: pricing.surplusGrams,
        surplusKg: (pricing.surplusGrams / 1000).toFixed(2),
        bags: pricing.bags,
        split: pricing.split || null,
        presentation: pricing.presentation,
        presentationGrams: pricing.presentationGrams,
        presentationPrice: pricing.presentationPrice,
        bagsCount: pricing.totalBags,
        presentationBreakdown: {
            bagSize: pricing.presentation,
            bagGrams: pricing.presentationGrams,
            bagPrice: pricing.presentationPrice,
            bagsCount: pricing.totalBags,
            requiredGrams: pricing.requiredGrams,
            providedGrams: pricing.totalGrams,
            surplusGrams: pricing.surplusGrams
        },
        originalPrice: pricing.subtotal,
        originalSubtotal: pricing.subtotal,
        subtotal: pricing.subtotal,
        totalGrams: pricing.totalGrams,
        totalBags: pricing.totalBags,
        discountInfo: pricing.discountInfo,
        discountPct: pricing.discountPct,
        discountPercent: pricing.discountPercent,
        discountAmount: pricing.discountAmount,
        finalPrice: pricing.finalPrice,
        price: pricing.finalPrice,
        savings: pricing.discountAmount,
        costPerDay: pricing.costPerDay,
        createdAt: new Date().toISOString()
    };
}

export function generateFeedingPlans(dailyGrams: number, formula = 'pollo', petName = '', bagSize: string = '550gr'): FeedingPlan[] {
    return [7, 15, 30].map(days => buildFeedingPlan(dailyGrams, days, formula, petName, bagSize));
}