// Pruebas unitarias del cálculo centralizado de planes (sin dependencias).
// Ejecutar: node tests/plan-tests.mjs
// Extrae las funciones REALES desde app.js y las evalúa contra un stub de window.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const APP_PATH = fileURLToPath(new URL('../app.js', import.meta.url));
const SRC = readFileSync(APP_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Extractor: recupera el cuerpo de una asignación `window.NAME = function ...;`
// desde el código fuente, saltando strings, template literals y comentarios.
// ---------------------------------------------------------------------------
function extractAssignment(src, name) {
    const marker = `window.${name} = function`;
    const start = src.indexOf(marker);
    if (start === -1) throw new Error(`No se encontró window.${name} en app.js`);
    // La siguiente asignación top-level (`\nwindow.` sin sangría) delimita el final.
    const next = src.indexOf('\nwindow.', start + marker.length);
    if (next === -1) throw new Error(`No se pudo delimitar window.${name}`);
    const code = src.slice(start, next);
    return { code, end: start + code.length };
}

function skipString(src, i) {
    const quote = src[i];
    i++;
    let inTplExpr = false;
    let exprDepth = 0;
    for (; i < src.length; i++) {
        const c = src[i];
        if (quote === '`') {
            if (c === '\\') { i++; continue; }
            if (c === '$' && src[i + 1] === '{') { inTplExpr = true; exprDepth = 1; i++; continue; }
            if (inTplExpr) {
                if (c === '{') exprDepth++;
                else if (c === '}') { exprDepth--; if (exprDepth === 0) inTplExpr = false; }
            }
            if (c === '`' && !inTplExpr) return i;
        } else {
            if (c === '\\') { i++; continue; }
            if (c === quote) return i;
        }
    }
    return i;
}

function extractObject(src, marker) {
    const start = src.indexOf(marker);
    const open = start + marker.length - 1;
    assert.equal(src[open], '{', `Literal ${marker} no encontrado`);
    let opened = 0;
    let i = open;
    for (; i < src.length; i++) {
        const c = src[i];
        if (c === '{') opened++;
        else if (c === '}') { opened--; if (opened === 0) break; }
        else if (c === '"' || c === "'" || c === '`') i = skipString(src, i);
    }
    return src.slice(start, i + 1);
}

// ---------------------------------------------------------------------------
// Sandbox: stub mínimo de window para ejecutar las funciones reales.
// ---------------------------------------------------------------------------
function createSandbox() {
    const raw = extractObject(SRC, 'window.MILKARF_CONFIG = {');
    const literal = raw.slice('window.MILKARF_CONFIG ='.length).replace(/;\s*$/, '');
    const config = Function('return (' + literal + ');')();
    const window = {
        MILKARF_CONFIG: config,
        state: { nombreMascota: 'Rex' },
        lastCalcResult: { peso: 9 },
        activePlanPresentation: '550gr',
        __presentationUserTouched: false,
        capitalizeName: (v) => String(v || '').trim(),
        vibrate: () => {}
    };
    return window;
}

const sandbox = createSandbox();
const names = ['getPresentationBySize', 'recommendPresentation', 'optimizeBagsForFormula', 'calculatePlanConsumption', 'computePlanPricing', 'buildFeedingPlan', 'generateFeedingPlans'];
for (const name of names) {
    const { code } = extractAssignment(SRC, name);
    Function('window', code)(sandbox);
}

// Extraer getWhatsAppTemplate (template de pedido) con el mismo mecanismo.
const waExtract = extractAssignment(SRC, 'getWhatsAppTemplate');
Function('window', waExtract.code)(sandbox);

const {
    recommendPresentation,
    calculatePlanConsumption,
    getPresentationBySize,
    computePlanPricing,
    buildFeedingPlan,
    generateFeedingPlans,
    getWhatsAppTemplate
} = sandbox;

// ---------------------------------------------------------------------------
// Escenario base: 457 g/día → 3199 g requeridos al plan semanal.
// ---------------------------------------------------------------------------
const DAILY = 457;
const DAYS_7 = 3199;

const clean = (plan) => {
    const flat = {};
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

// 0) Asignación automática de presentación por porción (Requisito 2)
{
    assert.equal(recommendPresentation(100).size, '250gr');
    assert.equal(recommendPresentation(125).size, '250gr');
    assert.equal(recommendPresentation(249).size, '250gr');
    assert.equal(recommendPresentation(250).size, '250gr');
    assert.equal(recommendPresentation(251).size, '550gr');
    assert.equal(recommendPresentation(300).size, '550gr');
    assert.equal(recommendPresentation(550).size, '550gr');
    assert.equal(recommendPresentation(750).size, '550gr');
}

// 1) 550 g: 6 bolsas de 550 g = 3300 g para 3199 g requeridos (457 g/día * 7 días)
{
    const p = computePlanPricing(DAILY, 7, 'pollo', '550gr');
    assert.deepEqual(p.presentation, '550gr');
    assert.equal(p.totalBags, 6);
    assert.equal(p.totalGrams, 3300);
    assert.equal(p.surplusGrams, 101);
    assert.equal(p.subtotal, 33.00);
    assert.equal(p.discountPct, 0.05);
    assert.equal(p.discountPercent, 5);
    assert.equal(p.discountAmount, 1.65);
    assert.equal(p.finalPrice, 31.35);
    assert.equal(p.costPerDay, 4.48);
}

// 2) 250 g con porción 457g: 13 bolsas de 250 g = 3250 g para 3199 g requeridos
{
    const p = computePlanPricing(DAILY, 7, 'pollo', '250gr');
    assert.equal(p.presentation, '250gr');
    assert.equal(p.totalBags, 13);
    assert.equal(p.totalGrams, 3250);
    assert.equal(p.subtotal, 32.50);
    assert.equal(p.finalPrice, 30.87);
}

// 3) Prueba de regresión: 100 g/día durante 7 días -> 700 g requeridos -> 3 bolsas de 250 g (750 g provistos)
{
    const rec = recommendPresentation(100, 'pollo');
    assert.equal(rec.size, '250gr', 'Porción <= 250g debe recomendar 250gr');
    const p = computePlanPricing(100, 7, 'pollo');
    assert.equal(p.presentation, '250gr');
    assert.equal(p.totalBags, 3, 'Corresponden 3 bolsas para 700 g');
    assert.equal(p.totalGramsProvided, 750);
    assert.equal(p.requiredGrams, 700);
    assert.equal(p.discardedSurplusGrams, 50);
}

// 4) Descuentos de plan: 5 %, 7,5 %, 10 % para 7/15/30 días
{
    const byDays = { 7: 0.05, 15: 0.075, 30: 0.10 };
    for (const [d, pct] of Object.entries(byDays)) {
        const p = computePlanPricing(DAILY, Number(d), 'pollo', '550gr');
        assert.equal(p.discountPct, pct, `Descuento ${d} días`);
        assert.equal(p.finalPrice, Math.round((p.subtotal - p.discountAmount) * 100) / 100);
        assert.equal(p.discountAmount, Math.round((p.subtotal - p.finalPrice) * 100) / 100, 'Descuento = subtotal - total');
    }
}

// 5) buildFeedingPlan es consistente con computePlanPricing
{
    const plan = clean(buildFeedingPlan(DAILY, 30, 'pollo', 'Rex'));
    const pricing = computePlanPricing(DAILY, 30, 'pollo', '550gr');
    assert.equal(plan.bagsCount, pricing.totalBags);
    assert.equal(plan.totalGramsProvided, pricing.totalGrams);
    assert.equal(plan.finalPrice, pricing.finalPrice);
    assert.equal(plan.originalSubtotal, pricing.subtotal);
    assert.equal(plan.presentation, '550gr');
    assert.equal(plan.requiredGrams, DAYS_7 * (30 / 7)); // 13710
    assert.equal(plan.petWeight, 9);
    assert.deepEqual(plan.presentationBreakdown.bagSize, '550gr');
    assert.equal(plan.presentationBreakdown.bagsCount, plan.bagsCount);
}

// 6) 250 g respetado cuando se pasa explícitamente a buildFeedingPlan
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
    assert.equal(keptFormula.presentationPrice, 3.50);
}

// 7) Plan mixto según consumo del periodo (DAILY=457g, 7 días: 3 bolsas Pollo + 3 bolsas Res = 6 bolsas de 550g)
{
    const p = computePlanPricing(DAILY, 7, 'mixto', '550gr');
    assert.equal(p.split.polloPct, 50);
    assert.equal(p.split.resPct, 50);
    assert.equal(p.bags.length, 2);
    assert.equal(p.bags[0].size, '550gr');
    assert.equal(p.bags[1].size, '550gr');
    assert.equal(p.bags[0].qty, 3);
    assert.equal(p.bags[1].qty, 3);
    assert.equal(p.totalBags, 6);
    assert.equal(p.subtotal, 39.60); // 3*5.50 + 3*7.70
    assert.equal(p.finalPrice, 37.62); // -5 %
}

// 7.5) Conservación 24h con pauta de comidas (Requisito 4)
{
    const schedule = [
        { time: 0, grams: 50 },
        { time: 12 * 3600 * 1000, grams: 50 },
        { time: 20 * 3600 * 1000, grams: 50 },
        { time: 30 * 3600 * 1000, grams: 50 }
    ];
    const res = calculatePlanConsumption(100, 2, 'pollo', '250gr', schedule);
    assert.equal(res.totalBags, 2, 'Abre 2 bolsas por expiración tras 24h');
    assert.equal(res.totalGramsProvided, 500);
    assert.equal(res.requiredGrams, 200);
    assert.equal(res.discardedSurplusGrams, 100);
    assert.equal(res.usableRemainingGrams, 200);
    assert.equal(res.totalGramsProvided, res.requiredGrams + res.discardedSurplusGrams + res.usableRemainingGrams);
}

// 8) Frío/datos degenerados: sin NaN, sin negativos, sin undefined
{
    const degenerate = [0, -5, 'abc', null, undefined, 0.0001];
    for (const badDaily of degenerate) {
        for (const badDays of degenerate) {
            const p = computePlanPricing(badDaily, badDays, 'pollo', '550gr');
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

// 9) generateFeedingPlans genera los 3 planes con la presentación recomendada automáticamente
{
    const plans = generateFeedingPlans(150, 'res', 'Rex');
    assert.equal(plans.length, 3);
    for (const pl of plans) {
        clean(pl);
        assert.equal(pl.presentation, '250gr');
        assert.equal(pl.presentationGrams, 250);
        assert.equal(pl.discountPct, pl.days === 7 ? 0.05 : pl.days === 15 ? 0.075 : 0.10);
    }
}

// 10) getPresentationBySize resuelve correctamente
{
    assert.equal(getPresentationBySize('pollo', '250gr').price, 2.50);
    assert.equal(getPresentationBySize('res', '550gr').price, 7.70);
}

// 11) Template 'newOrder': incluye presentación, bolsas, peso y desglose
{
    const plan = buildFeedingPlan(DAILY, 30, 'pollo', 'Rex');
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
    assert.match(msg, /550 g/);
    assert.match(msg, /Ración: 457 g\/día/);
    assert.match(msg, /Presentación: 550 g/);
    assert.match(msg, /Bolsas: 25x 550gr/);
    assert.equal(msg.includes('undefined'), false, 'No debe contener "undefined"');
    assert.equal(msg.includes('NaN'), false, 'No debe contener "NaN"');
    assert.equal(msg.includes('null '), false, 'No debe contener "null"');
    assert.match(msg, /30 días/);
    assert.match(msg, /13\.75 kg provistos/);
}

// 12) El template no estalla con datos ausentes (guardas para mensaje incompleto)
{
    const msg = getWhatsAppTemplate('newOrder', { items: [{ type: 'feeding_plan' }] });
    assert.equal(msg.includes('undefined'), false);
    assert.equal(msg.includes('NaN'), false);
}

// 13) Invariantes de marca: precios de la configuración real
{
    assert.equal(getPresentationBySize('pollo', '250gr').price, 2.50);
    assert.equal(getPresentationBySize('pollo', '550gr').price, 5.50);
    assert.equal(getPresentationBySize('res', '250gr').price, 3.50);
    assert.equal(getPresentationBySize('res', '550gr').price, 7.70);
}

console.log('✅ Todas las pruebas pasaron (13 bloques: 250g/550g, descuentos, mixto, degenerados, planes, WhatsApp).');