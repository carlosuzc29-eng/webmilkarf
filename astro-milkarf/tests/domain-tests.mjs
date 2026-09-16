// Pruebas del dominio canónico del nuevo sitio (Astro).
// Ejecutar: npx tsx tests/domain-tests.mjs
// Los valores esperados son idénticos a los de tests/plan-tests.mjs (legacy).

import assert from 'node:assert/strict';
import {
    getPresentationBySize,
    computePlanPricing,
    buildFeedingPlan,
    generateFeedingPlans
} from '../src/domain/plans.ts';
import { getWhatsAppTemplate } from '../src/domain/whatsapp.ts';
import { computeRacion, computeEquivalenciasMensuales } from '../src/domain/calculator.ts';

const DAILY = 457;

const clean = (plan) => {
    const walk = (v, p) => {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            for (const k of Object.keys(v)) walk(v[k], p + '.' + k);
        }
    };
    walk(plan, 'plan');
    for (const k of ['petName', 'formulaLabel', 'presentation', 'label', 'tag']) {
        assert.notEqual(plan[k], undefined, `Campo indefinido: ${k}`);
        assert.notEqual(plan[k], null, `Campo nulo: ${k}`);
    }
    for (const k of ['requiredGrams', 'totalGramsProvided', 'surplusGrams', 'bagsCount',
                     'originalSubtotal', 'discountAmount', 'finalPrice', 'costPerDay',
                     'dailyGrams', 'presentationGrams', 'presentationPrice']) {
        const v = Number(plan[k]);
        assert.equal(Number.isNaN(v), false, `NaN en plan.${k}`);
        assert.ok(v >= 0, `Negativo en plan.${k}: ${v}`);
    }
    return plan;
};

// 1) 500 g: 7 bolsas de 500 g = 3500 g para 3199 g requeridos
{
    const p = computePlanPricing(DAILY, 7, 'pollo', '500gr');
    assert.deepEqual(p.presentation, '500gr');
    assert.equal(p.totalBags, 7);
    assert.equal(p.totalGrams, 3500);
    assert.equal(p.surplusGrams, 301);
    assert.equal(p.subtotal, 35.0);
    assert.equal(p.discountPct, 0.05);
    assert.equal(p.discountPercent, 5);
    assert.equal(p.discountAmount, 1.75);
    assert.equal(p.finalPrice, 33.25);
    assert.equal(p.costPerDay, 4.75);
}

// 2) 250 g con la misma porción: 13 bolsas de 250 g = 3250 g
{
    const p = computePlanPricing(DAILY, 7, 'pollo', '250gr');
    assert.equal(p.presentation, '250gr');
    assert.equal(p.totalBags, 13);
    assert.equal(p.totalGrams, 3250);
    assert.equal(p.subtotal, 32.5);
    assert.equal(p.finalPrice, 30.87);
}

// 3) Cambiar presentación recalcula
{
    const p250 = computePlanPricing(DAILY, 7, 'pollo', '250gr');
    const p500 = computePlanPricing(DAILY, 7, 'pollo', '500gr');
    assert.notEqual(p250.totalBags, p500.totalBags);
    assert.equal(p250.presentation, '250gr');
    assert.equal(p500.presentation, '500gr');
}

// 4) Descuentos de plan: 5 %, 7,5 %, 10 % para 7/15/30 días
{
    const byDays = { 7: 0.05, 15: 0.075, 30: 0.1 };
    for (const [d, pct] of Object.entries(byDays)) {
        const p = computePlanPricing(DAILY, Number(d), 'pollo', '500gr');
        assert.equal(p.discountPct, pct, `Descuento ${d} días`);
        assert.equal(p.finalPrice, Math.round((p.subtotal - p.subtotal * pct) * 100) / 100);
        assert.equal(p.discountAmount, Math.round((p.subtotal - p.finalPrice) * 100) / 100, 'Descuento = subtotal - total');
    }
}

// 5) buildFeedingPlan es consistente con computePlanPricing
{
    const plan = clean(buildFeedingPlan(DAILY, 30, 'pollo', 'Rex', '500gr', 9));
    const pricing = computePlanPricing(DAILY, 30, 'pollo', '500gr');
    assert.equal(plan.bagsCount, pricing.totalBags);
    assert.equal(plan.totalGramsProvided, pricing.totalGrams);
    assert.equal(plan.finalPrice, pricing.finalPrice);
    assert.equal(plan.originalSubtotal, pricing.subtotal);
    assert.equal(plan.presentation, '500gr');
    assert.equal(plan.requiredGrams, 13710);
    assert.equal(plan.petWeight, 9);
    assert.deepEqual(plan.presentationBreakdown.bagSize, '500gr');
    assert.equal(plan.presentationBreakdown.bagsCount, plan.bagsCount);
}

// 6) 250 g respetado como presentación única del plan (cambios de días/fórmula)
{
    const plan = buildFeedingPlan(DAILY, 7, 'pollo', 'Rex', '250gr');
    const kept = buildFeedingPlan(plan.dailyGrams, 30, plan.formula, plan.petName, plan.presentation);
    assert.equal(kept.presentation, '250gr');
    assert.equal(kept.id !== plan.id, true);
    assert.equal(kept.days, 30);
    const keptFormula = buildFeedingPlan(plan.dailyGrams, plan.days, 'res', plan.petName, plan.presentation);
    assert.equal(keptFormula.formula, 'res');
    assert.equal(keptFormula.presentation, '250gr');
    assert.equal(keptFormula.presentationGrams, 250);
    assert.equal(keptFormula.presentationPrice, 3.5);
}

// 7) Plan mixto: 50/50 con el mismo tamaño de bolsa
{
    const p = computePlanPricing(DAILY, 7, 'mixto', '500gr');
    assert.equal(p.split.polloPct, 50);
    assert.equal(p.split.resPct, 50);
    assert.equal(p.bags.length, 2);
    assert.equal(p.bags[0].size, '500gr');
    assert.equal(p.bags[1].size, '500gr');
    assert.equal(p.bags[0].qty, 4);
    assert.equal(p.bags[1].qty, 4);
    assert.equal(p.totalBags, 8);
    assert.equal(p.subtotal, 48.0);
    assert.equal(p.finalPrice, 45.6);
}

// 8) Datos degenerados: sin NaN, sin negativos, sin undefined
{
    const degenerate = [0, -5, 'abc', null, undefined, 0.0001];
    for (const badDaily of degenerate) {
        for (const badDays of degenerate) {
            const p = computePlanPricing(badDaily, badDays, 'pollo', '500gr');
            for (const k of ['requiredGrams', 'totalGrams', 'surplusGrams', 'subtotal', 'discountAmount', 'finalPrice', 'costPerDay', 'totalBags']) {
                const v = Number(p[k]);
                assert.equal(Number.isNaN(v), false, `NaN con daily=${badDaily} days=${badDays} en ${k}`);
                assert.ok(v >= 0, `Negativo con daily=${badDaily} en ${k}: ${v}`);
            }
        }
    }
    const b0 = buildFeedingPlan(0, 0, 'pollo', 'Rex');
    assert.equal(Number.isNaN(b0.requiredGrams), false);
    assert.equal(Number.isNaN(b0.finalPrice), false);
}

// 9) generateFeedingPlans genera los 3 planes con la presentación activa
{
    const plans = generateFeedingPlans(DAILY, 'res', 'Rex', '250gr');
    assert.equal(plans.length, 3);
    for (const pl of plans) {
        clean(pl);
        assert.equal(pl.presentation, '250gr');
        assert.equal(pl.presentationGrams, 250);
        assert.equal(pl.discountPct, pl.days === 7 ? 0.05 : pl.days === 15 ? 0.075 : 0.1);
    }
}

// 10) getPresentationBySize resuelve correctamente
{
    assert.equal(getPresentationBySize('pollo', '250gr').price, 2.5);
    assert.equal(getPresentationBySize('res', '500gr').price, 7);
}

// 11) Template 'newOrder': incluye presentación, bolsas, peso y desglose
{
    const plan = buildFeedingPlan(DAILY, 30, 'pollo', 'Rex', '500gr', 9);
    const item = {
        type: 'feeding_plan',
        petName: plan.petName,
        petWeight: plan.petWeight,
        dailyGrams: plan.dailyGrams,
        durationDays: plan.durationDays,
        formulaName: plan.formulaName,
        formula: plan.formula,
        presentation: plan.presentation,
        presentationGrams: plan.presentationGrams,
        presentationPrice: plan.presentationPrice,
        bags: plan.bags,
        bagsCount: plan.bagsCount,
        totalGramsRequired: plan.totalGramsRequired,
        totalGramsProvided: plan.totalGramsProvided,
        surplusGrams: plan.surplusGrams,
        originalSubtotal: plan.originalSubtotal,
        discountPercent: plan.discountPercent,
        discountAmount: plan.discountAmount,
        finalPrice: plan.finalPrice
    };
    const msg = getWhatsAppTemplate('newOrder', {
        items: [item],
        subtotal: plan.originalSubtotal,
        discountAmount: plan.discountAmount,
        discountType: 'plan',
        discountLabel: 'Descuento por plan',
        finalTotal: plan.finalPrice,
        contactPhone: '',
        userName: 'Cliente',
        orderId: 'local_123',
        location: 'Caracas'
    });
    assert.match(msg, /Plan para Rex/);
    assert.match(msg, /500 g/);
    assert.match(msg, /Ración: 457 g\/día/);
    assert.match(msg, /Presentación: 500 g/);
    assert.match(msg, /Bolsas: 28x 500gr/);
    assert.equal(msg.includes('undefined'), false, 'No debe contener "undefined"');
    assert.equal(msg.includes('NaN'), false, 'No debe contener "NaN"');
    assert.equal(msg.includes('null '), false, 'No debe contener "null"');
    assert.match(msg, /30 días/);
    assert.match(msg, /14\.00 kg provistos/);
    assert.match(msg, /adicionales por redondeo/, 'El excedente se presenta como redondeo, no como comida gratis');
    assert.equal(msg.includes('sin costo'), false, 'No debe usar "sin costo" para el excedente por redondeo');
}

// 12) El template no estalla con datos ausentes
{
    const msg = getWhatsAppTemplate('newOrder', { items: [{ type: 'feeding_plan' }] });
    assert.equal(msg.includes('undefined'), false);
    assert.equal(msg.includes('NaN'), false);
}

// 13) Invariantes de marca: precios de la configuración real
{
    assert.equal(getPresentationBySize('pollo', '250gr').price, 2.5);
    assert.equal(getPresentationBySize('pollo', '500gr').price, 5);
    assert.equal(getPresentationBySize('res', '250gr').price, 3.5);
    assert.equal(getPresentationBySize('res', '500gr').price, 7);
}

// 14) Calculadora nutricional replica la fórmula del legacy
{
    const adult = computeRacion({ peso: 9, etapa: 'adulto' });
    assert.equal(adult.gramos, Math.round((70 * Math.pow(9, 0.75) * 1.4) / 1.25));
    assert.equal(adult.kcal, Math.round(70 * Math.pow(9, 0.75) * 1.4));
    assert.equal(adult.comidas, 2);
    assert.equal(adult.porComida, Math.round(adult.gramos / 2));

    const cachorro = computeRacion({ peso: 3, etapa: 'cachorro', cachorroEdad: '4-6' });
    assert.equal(cachorro.gramos, Math.round((70 * Math.pow(3, 0.75) * 2.5) / 1.25));
    assert.equal(cachorro.comidas, 4);

    const eq = computeEquivalenciasMensuales(adult.gramos, adult.comidas);
    assert.equal(eq.bolsas250Mes, Math.ceil((adult.gramos * 30) / 250));
    assert.equal(eq.bolsas500Mes, Math.ceil((adult.gramos * 30) / 500));
    assert.equal(eq.porcionesMes, adult.comidas * 30);
    assert.match(eq.kilosMes, / kg$/);
}

console.log('✅ Dominio Astro: todas las pruebas pasaron (14 bloques: 250g/500g, descuentos, mixto, degenerados, planes, WhatsApp, calculadora).');