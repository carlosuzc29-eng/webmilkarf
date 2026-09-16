// Guard de divergencia: verifica que la lógica canónica del nuevo sitio (src/domain)
// produce los mismos números que las funciones reales de app.js legacy.
// Ejecutar: npx tsx tests/divergence-guard.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {
    getPresentationBySize,
    computePlanPricing,
    buildFeedingPlan
} from '../src/domain/plans.ts';

const APP_PATH = fileURLToPath(new URL('../../app.js', import.meta.url));
const SRC = readFileSync(APP_PATH, 'utf8');

function extractAssignment(src, name) {
    const marker = `window.${name} = function`;
    const start = src.indexOf(marker);
    if (start === -1) throw new Error(`No se encontró window.${name} en app.js`);
    const next = src.indexOf('\nwindow.', start + marker.length);
    if (next === -1) throw new Error(`No se pudo delimitar window.${name}`);
    return src.slice(start, next);
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

const raw = extractObject(SRC, 'window.MILKARF_CONFIG = {');
const literal = raw.slice('window.MILKARF_CONFIG ='.length).replace(/;\s*$/, '');
const config = Function('return (' + literal + ');')();

const windowStub = {
    MILKARF_CONFIG: config,
    state: { nombreMascota: 'Rex' },
    lastCalcResult: { peso: 9 },
    activePlanPresentation: '500gr',
    capitalizeName: (v) => String(v || '').trim(),
    vibrate: () => {}
};
for (const name of ['getPresentationBySize', 'computePlanPricing', 'buildFeedingPlan']) {
    Function('window', extractAssignment(SRC, name))(windowStub);
}
const legacy = {
    getPresentationBySize: windowStub.getPresentationBySize,
    computePlanPricing: windowStub.computePlanPricing,
    buildFeedingPlan: windowStub.buildFeedingPlan
};

const NUMERIC_KEYS = [
    'requiredGrams', 'totalGrams', 'surplusGrams', 'totalBags', 'includedGrams',
    'subtotal', 'originalSubtotal', 'discountPct', 'discountPercent', 'discountAmount',
    'finalPrice', 'costPerDay', 'presentationGrams', 'presentationPrice'
];

const plansNumeric = [
    'requiredGrams', 'dailyGrams', 'totalGramsRequired', 'requiredKg', 'includedGrams',
    'totalGramsProvided', 'includedKg', 'surplusGrams', 'surplusKg', 'bagsCount',
    'presentationGrams', 'presentationPrice', 'originalSubtotal', 'originalPrice',
    'discountPct', 'discountPercent', 'discountAmount', 'finalPrice', 'price', 'savings', 'costPerDay'
];

const dailies = [0, 100, 250, 300, 457, 800, 1000.5, 3200, 999.99];
const daySets = [7, 15, 30, 0, -3];
const formulas = ['pollo', 'res', 'mixto', 'xxx', 'Pollo'];
const bagSizes = ['250gr', '500gr', '', undefined];

let checks = 0;
for (const daily of dailies) {
    for (const days of daySets) {
        for (const formula of formulas) {
            for (const bagSize of bagSizes) {
                const args = [daily, days, formula];
                if (bagSize !== undefined) args.push(bagSize);
                const ref = legacy.computePlanPricing(...args);
                const got = computePlanPricing(...args);

                for (const k of NUMERIC_KEYS) {
                    assert.equal(
                        Number(got[k]).toFixed(4),
                        Number(ref[k]).toFixed(4),
                        `computePlanPricing divergió en ${k} con daily=${daily} days=${days} formula=${formula} bagSize=${bagSize}`
                    );
                }
                assert.deepEqual(got.split, ref.split);
                assert.equal(got.presentation, ref.presentation);
                assert.equal(got.bags.length, ref.bags.length);
                for (let i = 0; i < ref.bags.length; i++) {
                    for (const k of ['formula', 'size', 'grams', 'qty', 'unitPrice']) {
                        assert.equal(got.bags[i][k], ref.bags[i][k], `bags[${i}].${k} divergió`);
                    }
                }
                checks++;

                // buildFeedingPlan (petWeight 9 para igualar el stub legacy)
                const refPlan = legacy.buildFeedingPlan(daily, days, formula, 'Rex', bagSize ?? '500gr');
                const gotPlan = buildFeedingPlan(daily, days, formula, 'Rex', bagSize ?? '500gr', 9);
                for (const k of plansNumeric) {
                    assert.equal(
                        Number(gotPlan[k]).toFixed(4),
                        Number(refPlan[k]).toFixed(4),
                        `buildFeedingPlan divergió en plan.${k} con daily=${daily} days=${days} formula=${formula}`
                    );
                }
                checks++;
            }
        }
    }
}

// Presentación por tamaño
for (const f of ['pollo', 'res']) {
    for (const s of ['250gr', '500gr', 'XXX']) {
        assert.equal(getPresentationBySize(f, s)?.price, legacy.getPresentationBySize(f, s)?.price, `getPresentationBySize ${f}/${s}`);
        checks++;
    }
}

console.log(`✅ Guard de divergencia: ${checks} comparaciones idénticas entre src/domain y app.js.`);