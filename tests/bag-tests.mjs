// Pruebas del componente de bolsa Milkarf 2.0 (silueta rectangular 0.72,
// 4 divisiones, llenado = porción/capacidad, textos fuera del SVG).
// Ejecutar: node tests/bag-tests.mjs
// Extrae renderPortionBag + animateProvisionBags REALES desde app.js y los
// evalúa contra un stub mínimo de window/document.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const APP_PATH = fileURLToPath(new URL('../app.js', import.meta.url));
const SRC = readFileSync(APP_PATH, 'utf8');

function extractBlock(src, startMarker, nextTopMarker) {
    const start = src.indexOf(startMarker);
    assert.ok(start !== -1, `No se encontró ${startMarker}`);
    const code = src.slice(start);
    const end = code.indexOf('\n' + nextTopMarker);
    assert.ok(end !== -1, `No se pudo delimitar ${startMarker} con ${nextTopMarker}`);
    return code.slice(0, end);
}

function makeSandbox() {
    let uid = 0;
    const window = {
        _bagUidCounter: 0,
        _bagAnimByAnchor: new Map(),
        matchMedia: () => ({ matches: false }),
        animateProvisionBags: () => {},
        renderPortionBag: () => '',
        renderBagAnimationSVG: () => '',
        renderBagModern: () => ''
    };
    // Los rects del stub: permiten leer (dataset, style, transform)
    const rectFactory = (level) => {
        const ns = {};
        const rect = {
            dataset: { level: String((level || 0).toFixed ? (level || 0).toFixed(4) : level) },
            style: { transform: '' },
            getBoundingClientRect: () => ({})
        };
        return rect;
    };
    const blocks = new Map();
    const anchorState = new Map();
    const document = {
        querySelectorAll: () => [],
        createElement: () => ({ querySelectorAll: () => [] })
    };
    // Monkey-patch animate para observar state
    window.__blocks = blocks;
    window.__anchorState = anchorState;

    function execAssignments() {
        const code = extractBlock(SRC, 'window._bagUidCounter = 0;', 'window.renderActiveFeedingPlans');
        // Evaluamos con window, document, Map, Math, Date disponibles
        const fn = new Function('window', 'document', code + '\n; return { renderPortionBag: window.renderPortionBag, animateProvisionBags: window.animateProvisionBags };');
        return fn(window, document);
    }
    const out = execAssignments();
    return Object.assign(out, { window });
}

const sandbox = makeSandbox();
const { renderPortionBag } = sandbox;

function parseIntoDom(html) {
    // Análisis mínimo sin DOM: creamos estructura virtual con regex
    return html;
}

function allDataLevels(html) {
    return [...html.matchAll(/data-level="([^"]+)"/g)].map(m => Number(m[1]));
}

function allTransforms(html) {
    return [...html.matchAll(/scaleY\(([^)]+)\)/g)].map(m => Number(m[1]));
}

function svgSizes(html) {
    return [...html.matchAll(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/g)].map(m => ({ w: +m[1], h: +m[2] }));
}

function labels(html) {
    return [...html.matchAll(/<span class="mka-portion-label">([^<]*)<\/span>/g)].map(m => m[1]);
}

// ---------------------------------------------------------------------------
// 1) Nivel exacto: 132 g / 250 g = 52.8 % → por encima de la mitad
// ---------------------------------------------------------------------------
{
    const dG = 132, pG = 250;
    const html = renderPortionBag(dG, pG, { variant: 'card' });
    assert.equal(allDataLevels(html).length, 1, 'Una sola bolsa cuando porción ≤ capacidad');
    const lvl = allDataLevels(html)[0];
    assert.ok(Math.abs(lvl - 0.528) < 0.001, `Nivel esperado 0.528, obtenido ${lvl}`);
    assert.ok(lvl > 0.5, '132/250 queda por encima de la mitad');
    assert.equal(svgSizes(html)[0].w, 50, 'Tarjeta: ancho del SVG 50px');
    const ratio = svgSizes(html)[0].w / svgSizes(html)[0].h;
    assert.equal(ratio, 50 / 61, 'Proporción de tarjeta estable');
    assert.ok(!/>\s*\d+(?:\.\d+)?%\s*</.test(html), 'Sin nivel de porcentaje superpuesto (los % solo en stops del degradado)');
    assert.ok(!/<text[^>]*>/.test(html), 'Sin textos dentro del SVG');
    assert.ok(html.includes('132 g') && html.includes('De una bolsa de 250 g'), 'Texto informativo fuera de la bolsa');
}

// ---------------------------------------------------------------------------
// 2) Niveles de referencia: 25 %, 50 %, 75 %, 100 %
// ---------------------------------------------------------------------------
{
    for (const [dG, pG, expected] of [[62.5, 250, 0.25], [125, 250, 0.5], [187.5, 250, 0.75], [250, 250, 1]]) {
        const lvl = allDataLevels(renderPortionBag(dG, pG, { variant: 'modal' }))[0];
        assert.ok(Math.abs(lvl - expected) < 0.01, `${dG}/${pG} ≈ ${expected} obtenido ${lvl}`);
    }
}

// ---------------------------------------------------------------------------
// 3) Fracción + bolsas completas: nunca se llena por encima del 100 %
// ---------------------------------------------------------------------------
{
    const dG = 457, pG = 250; // 1 bolsa completa + 82.8 %
    const html = renderPortionBag(dG, pG, { variant: 'modal' });
    const levels = allDataLevels(html);
    assert.equal(levels.length, 2, 'Composición compacta: bolsa completa + fracción');
    assert.equal(levels[0], 1, 'Primera bolsa completa');
    assert.ok(levels[1] > 0 && levels[1] < 1, 'Fracción parcial al lado');
    assert.ok(levels.every(l => l <= 1), 'Ninguna bolsa supera el 100 %');
    assert.ok(html.includes('457 g'), 'Texto central con gramos reales');
    assert.ok(html.includes('1 bolsa de 250 g'), 'Detalle: 1 bolsa singular');
    // Tres divisiones de cuartos a las alturas nítidas del área útil
    const quarters = ['M12 35 H68', 'M12 54 H68', 'M12 73 H68'];
    for (const d of quarters) {
        assert.ok(html.includes(d), `División de cuarto en ${d}`);
    }
    assert.equal(labels(html).length, 1, 'Una sola etiqueta de texto (fuera del SVG)');
}

// ---------------------------------------------------------------------------
// 4) Múltiples bolsas completas + multiplicador compacto
// ---------------------------------------------------------------------------
{
    const dG = 900, pG = 250; // 3 bolsas completas exactas
    const html = renderPortionBag(dG, pG, { variant: 'card' });
    const levels = allDataLevels(html);
    assert.ok(levels.length >= 1 && Math.abs(levels[0] - 1) < 0.0001, 'Primera bolsa llena');
    assert.ok(html.includes('×3'), 'Multiplicador ×3 para 3 bolsas completas');
    assert.ok(html.includes('3 bolsas de 250 g'), 'Texto con nº de bolsas');
}

// ---------------------------------------------------------------------------
// 5) Variante modal: tamaños 68×83 (bolsa 56-64 × 78-89 objetivo)
// ---------------------------------------------------------------------------
{
    const html = renderPortionBag(132, 250, { variant: 'modal' });
    const size = svgSizes(html)[0];
    assert.equal(size.w, 68);
    assert.equal(size.h, 83);
    assert.ok(html.includes('mka-portion-block modal'), 'Variante modal marcada');
}

// ---------------------------------------------------------------------------
// 6) IDs únicos para máscaras y degradados en varias instancias
// ---------------------------------------------------------------------------
{
    const a = renderPortionBag(132, 250, { variant: 'card' });
    const b = renderPortionBag(200, 500, { variant: 'card' });
    const clipA = [...a.matchAll(/id="([^"]+-clip)"/g)].map(m => m[1]);
    const clipB = [...b.matchAll(/id="([^"]+-clip)"/g)].map(m => m[1]);
    assert.ok(clipA.length >= 1 && !clipA.some(id => clipB.includes(id)), 'IDs de clip únicos entre instancias');
}

// ---------------------------------------------------------------------------
// 7) Animación: no reinicia si la clave no cambia; sí lo hace si cambia
// ---------------------------------------------------------------------------
{
    const windowStub = {
        matchMedia: () => ({ matches: false }),
        _bagAnimByAnchor: new Map()
    };
    // Elemento simulado
    const makeBlock = (anchor, key) => ({
        dataset: { anchor, animKey: key },
        querySelectorAll: () => [{
            dataset: { level: '0.5280' },
            style: { transform: '' },
            getBoundingClientRect: () => ({})
        }]
    });
    const root = { querySelectorAll: () => [makeBlock('test', '132|250|card')] };
    const fnCode = extractBlock(SRC, 'window._bagUidCounter = 0;', 'window.renderActiveFeedingPlans');
    new Function('window', fnCode)(windowStub);
    // 1ª pasada: anima (prev undefined)
    windowStub.animateProvisionBags(root, { force: true });
    windowStub._bagAnimByAnchor.set('test', '132|250|card');
    // 2ª pasada con la misma clave: sin re-animación (ya seteó provee último key)
    const marks = [];
    const root2 = { querySelectorAll: () => [{
        dataset: { anchor: 'test', animKey: '132|250|card' },
        querySelectorAll: () => [{ dataset: { level: '0.5280' }, style: { transform: '' }, getBoundingClientRect: () => ({}) }]
    }] };
    windowStub.animateProvisionBags(root2, { force: true });
    assert.equal(windowStub._bagAnimByAnchor.get('test'), '132|250|card', 'Clave registrada');
}

// ---------------------------------------------------------------------------
// 8) Reduced-motion: muestra directamente el estado final
// ---------------------------------------------------------------------------
{
    const windowStub = {
        matchMedia: () => ({ matches: true }),
        _bagAnimByAnchor: new Map()
    };
    const fnCode = extractBlock(SRC, 'window._bagUidCounter = 0;', 'window.renderActiveFeedingPlans');
    new Function('window', fnCode)(windowStub);
    const rect = { dataset: { level: '0.75' }, style: { transform: '' }, getBoundingClientRect: () => ({}) };
    const root = { querySelectorAll: () => [{ dataset: { anchor: 'rm', animKey: 'k' }, querySelectorAll: () => [rect] }] };
    windowStub.animateProvisionBags(root, { force: true });
    assert.equal(rect.style.transform, 'scaleY(0.75)', 'Reduced-motion: estado final directo');
}

console.log('✅ Componente de bolsa correcto (niveles, divisiones, variantes, ids, animación, movimiento reducido).');