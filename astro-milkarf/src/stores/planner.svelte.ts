// Store reactivo de la isla PlanificadorMilkarf (Svelte 5 runes).
// Es la única fuente de estado de la isla: mascota, calculadora, planes y carrito.
// Nota: en módulos .svelte.ts los runes ($state, etc.) son globales, no se importan,
// y el estado exportado debe mutarse por propiedades (no reasignarse).

import { computeRacion, computeEquivalenciasMensuales, notaPorEtapa, etapaLabel } from '../domain/calculator';
import type { Etapa, CachorroEdad, RacionResult, EquivalenciaMensual } from '../domain/calculator';
import { getBagRecommendation, buildFeedingPlan, generateFeedingPlans } from '../domain/plans';
import type { BagSize, FeedingPlan } from '../domain/plans';
import { getWhatsAppTemplate, getCheckoutWhatsAppUrl, normalizePhone, formatPhoneForDisplay } from '../domain/whatsapp';
import { loadCartFromStorage, saveCartToStorage, clearCartFromStorage, nicknameForKey } from '../domain/cartStorage';
import type { CartItemPlan } from '../domain/cartStorage';
import { MILKARF_CONFIG, WA_NUMBER } from '../data/catalog';

export type FormulaState = 'pollo' | 'res' | 'mixto';

// ─────────────────────────────────────────────────────────────────────────────
// Estado
// ─────────────────────────────────────────────────────────────────────────────

export const planner = $state({
    petName: '',
    etapa: null as Etapa | null,
    cachorroEdad: null as CachorroEdad | null,
    pesoTxt: '',
    error: '',
    resultado: null as RacionResult | null,
    equivalencia: null as EquivalenciaMensual | null,
    activeFormula: 'pollo' as FormulaState,
    activePresentation: '500gr' as BagSize,
    presentationUserTouched: false,
    cart: loadCartFromStorage() as CartItemPlan[]
});

// ─────────────────────────────────────────────────────────────────────────────
// Selectores mutables
// ─────────────────────────────────────────────────────────────────────────────

export function setPetName(v: string) {
    planner.petName = v;
    if (v.trim()) planner.error = '';
}

export function selectEtapa(v: Etapa) {
    planner.etapa = v;
    if (v !== 'cachorro') planner.cachorroEdad = null;
    planner.resultado = null;
    planner.error = '';
}

export function selectCachorroEdad(v: CachorroEdad) {
    planner.cachorroEdad = v;
    planner.resultado = null;
    planner.error = '';
}

export function setPeso(v: string) {
    planner.pesoTxt = v;
    planner.resultado = null;
}

export function stepPeso(delta: number) {
    const val = parseFloat(planner.pesoTxt.replace(',', '.')) || 0;
    const next = Math.min(90, Math.max(0.5, val + delta));
    planner.pesoTxt = String(next);
    planner.resultado = null;
}

export function selectFormula(f: FormulaState) {
    planner.activeFormula = f;
}

export function selectPresentation(size: BagSize) {
    if (size !== '250gr' && size !== '500gr') size = '500gr';
    planner.activePresentation = size;
    planner.presentationUserTouched = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculos
// ─────────────────────────────────────────────────────────────────────────────

/** Valida y calcula la porción orientativa. Devuelve true si el cálculo fue exitoso. */
export function calcular(): boolean {
    planner.error = '';
    if (!planner.petName.trim()) {
        planner.error = 'Ingresa el nombre de tu perro en el Paso 1 para continuar.';
        return false;
    }
    if (!planner.etapa || (planner.etapa === 'cachorro' && !planner.cachorroEdad)) {
        planner.error = 'Completa la etapa de vida de tu perro para calcular su porción orientativa.';
        return false;
    }

    const raw = String(planner.pesoTxt || '').trim();
    if (/[a-zA-Z@]/.test(raw)) {
        planner.error = 'Ingresa el peso en kg (solo números mayores a 0).';
        planner.pesoTxt = '';
        return false;
    }
    const peso = parseFloat(raw.replace(',', '.'));
    if (!peso || peso <= 0) {
        planner.error = 'Completa el peso de tu perro para calcular su porción orientativa.';
        return false;
    }

    planner.resultado = computeRacion({ peso, etapa: planner.etapa, cachorroEdad: planner.cachorroEdad });
    planner.equivalencia = computeEquivalenciasMensuales(planner.resultado.gramos, planner.resultado.comidas);

    if (!planner.presentationUserTouched) {
        planner.activePresentation = getBagRecommendation(planner.resultado.gramos).size === '250g' ? '250gr' : '500gr';
    }
    return true;
}

export function recomputePlans(): FeedingPlan[] {
    if (!planner.resultado) return [];
    return generateFeedingPlans(planner.resultado.gramos, planner.activeFormula, planner.petName, planner.activePresentation);
}

export function equivalenciaDiaria() {
    if (!planner.resultado) return null;
    return {
        b250: (Math.round((planner.resultado.gramos / 250) * 10) / 10).toFixed(1),
        b500: (Math.round((planner.resultado.gramos / 500) * 10) / 10).toFixed(1)
    };
}

export function notaResultado(): string {
    if (!planner.resultado || !planner.etapa) return '';
    return notaPorEtapa(planner.etapa);
}

export function subtitleResultado(pesoUsado: number): string {
    if (!planner.etapa) return '';
    return `${etapaLabel(planner.etapa, planner.cachorroEdad)} · ${pesoUsado} kg`;
}

export const etapas: { value: Etapa; label: string; sub: string; emoji: string }[] = [
    { value: 'cachorro', label: 'Cachorro', sub: '0–12 meses', emoji: '🐶' },
    { value: 'adulto', label: 'Adulto', sub: '1–7 años', emoji: '🐕' },
    { value: 'senior', label: 'Senior', sub: '+7 años', emoji: '🦴' }
];

export const edadesCachorro: CachorroEdad[] = ['2-4', '4-6', '6-9', '9-12'];

// ─────────────────────────────────────────────────────────────────────────────
// Carrito
// ─────────────────────────────────────────────────────────────────────────────

export function choosePlan(days: number): FeedingPlan {
    if (!planner.resultado) throw new Error('Calcula primero la porción de tu perro.');
    const plan = buildFeedingPlan(planner.resultado.gramos, days, planner.activeFormula, planner.petName, planner.activePresentation, pesoDeResultado());

    const existingIndex = planner.cart.findIndex(
        (i) => nicknameForKey(i.petName) === nicknameForKey(plan.petName)
    );
    const item: CartItemPlan = { ...plan, type: 'feeding_plan', key: nicknameForKey(plan.petName) };
    if (existingIndex >= 0) {
        planner.cart[existingIndex] = item;
    } else {
        planner.cart = [...planner.cart, item];
    }
    saveCartToStorage(planner.cart);
    return plan;
}

function pesoDeResultado(): number | null {
    if (!planner.resultado) return null;
    const raw = String(planner.pesoTxt || '').replace(',', '.');
    const p = parseFloat(raw);
    return Number.isFinite(p) && p > 0 ? p : null;
}

export function removePlan(planId: string) {
    planner.cart = planner.cart.filter((i) => i.id !== planId);
    saveCartToStorage(planner.cart);
}

export function updatePlanDuration(planId: string, newDays: number) {
    const plan = planner.cart.find((i) => i.id === planId);
    if (!plan) return;
    const updated = buildFeedingPlan(plan.dailyGrams, newDays, plan.formula, plan.petName, plan.presentation, plan.petWeight);
    const idx = planner.cart.findIndex((i) => i.id === planId);
    planner.cart[idx] = { ...updated, type: 'feeding_plan', key: plan.key };
    saveCartToStorage(planner.cart);
}

export function updatePlanFormula(planId: string, newFormula: string) {
    const plan = planner.cart.find((i) => i.id === planId);
    if (!plan) return;
    const updated = buildFeedingPlan(plan.dailyGrams, plan.days, newFormula, plan.petName, plan.presentation, plan.petWeight);
    const idx = planner.cart.findIndex((i) => i.id === planId);
    planner.cart[idx] = { ...updated, type: 'feeding_plan', key: plan.key };
    saveCartToStorage(planner.cart);
}

export function updatePlanPresentation(planId: string, size: BagSize) {
    const plan = planner.cart.find((i) => i.id === planId);
    if (!plan) return;
    const updated = buildFeedingPlan(plan.dailyGrams, plan.days, plan.formula, plan.petName, size, plan.petWeight);
    const idx = planner.cart.findIndex((i) => i.id === planId);
    planner.cart[idx] = { ...updated, type: 'feeding_plan', key: plan.key };
    saveCartToStorage(planner.cart);
}

export function clearCart() {
    planner.cart = [];
    clearCartFromStorage();
}

export function cartTotals() {
    const totalOriginalSubtotal = planner.cart.reduce((s, i) => s + (Number(i.originalSubtotal) || 0), 0);
    const totalPlanDiscount = planner.cart.reduce((s, i) => s + (Number(i.discountAmount) || 0), 0);
    const finalTotal = Math.max(0, totalOriginalSubtotal - totalPlanDiscount);
    return { totalOriginalSubtotal, totalPlanDiscount, finalTotal, count: planner.cart.length, savings: totalPlanDiscount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pedido por WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckoutData {
    tutorName: string;
    phone: string;
    location: string;
    deliveryDate?: string;
}

export function buildCheckout(data: CheckoutData) {
    const totals = cartTotals();
    if (totals.count === 0) return null;

    const items = planner.cart.map((i) => ({
        type: 'feeding_plan',
        name: `Plan ${i.durationDays}d - ${i.formulaName || 'Fórmula'}`,
        weight: `${(Number(i.totalGramsProvided || 0) / 1000).toFixed(2)} kg`,
        qty: 1,
        price: Number(i.finalPrice || i.price || 0),
        originalSubtotal: Number(i.originalSubtotal || 0),
        discountPercent: Number(i.discountPercent || 0),
        discountAmount: Number(i.discountAmount || 0),
        finalPrice: Number(i.finalPrice || 0),
        forPet: i.petName || '',
        petName: i.petName || '',
        dailyGrams: Number(i.dailyGrams || 0),
        durationDays: Number(i.durationDays || 7),
        formula: i.formula || 'pollo',
        formulaName: i.formulaName || '',
        totalGramsRequired: Number(i.totalGramsRequired || 0),
        totalGramsProvided: Number(i.totalGramsProvided || 0),
        surplusGrams: Number(i.surplusGrams || 0),
        bags: i.bags || [],
        presentation: i.presentation || (Array.isArray(i.bags) && i.bags[0] ? i.bags[0].weight : '500gr'),
        presentationGrams: Number(i.presentationGrams || 0),
        presentationPrice: Number(i.presentationPrice || 0),
        bagsCount: Number(i.bagsCount) || (Array.isArray(i.bags) ? i.bags.reduce((s, b) => s + (Number(b.qty) || 0), 0) : 0),
        petWeight: Number(i.petWeight) || null
    }));

    const contactPhone = normalizePhone(data.phone || '');
    const orderId = 'local_' + Date.now();
    const discountType = totals.totalPlanDiscount > 0 ? 'plan' : 'none';
    const discountLabel = totals.totalPlanDiscount > 0 ? 'Descuento por plan' : '';
    const msg = getWhatsAppTemplate('newOrder', {
        items,
        subtotal: totals.totalOriginalSubtotal,
        discountApplied: totals.totalPlanDiscount > 0,
        discountType,
        discountAmount: totals.totalPlanDiscount,
        discountLabel,
        finalTotal: totals.finalTotal,
        contactPhone,
        userName: data.tutorName || 'Cliente Milkarf',
        orderId,
        location: data.location || ''
    });
    const url = getCheckoutWhatsAppUrl(msg, WA_NUMBER);

    return {
        orderId,
        msg,
        url,
        totals,
        items,
        contactPhone,
        finalTotal: totals.finalTotal
    };
}

export const HELPERS = {
    money(v: number) {
        return '$' + Number(v || 0).toFixed(2);
    },
    phoneDisplay(v: string) {
        return formatPhoneForDisplay(v);
    },
    planDiscountPct(days: number) {
        return MILKARF_CONFIG.planDiscounts[days]?.discountPct || 0;
    },
    waitUntilLoaded() {}
};

export { WA_NUMBER };