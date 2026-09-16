// Cálculos de la calculadora nutricional (misma fórmula que app.js).
// Factor de actividad fijo internamente en "Poco activo" (bajo), como el sitio legacy.

export type Etapa = 'cachorro' | 'adulto' | 'senior';
export type CachorroEdad = '2-4' | '4-6' | '6-9' | '9-12';

export interface RacionInput {
    peso: number;
    etapa: Etapa;
    cachorroEdad?: CachorroEdad | null;
}

export interface RacionResult {
    gramos: number;
    kcal: number;
    comidas: number;
    porComida: number;
    factor: number;
}

export interface EquivalenciaMensual {
    totalGMes: number;
    kilosMes: string;
    porcionesMes: number;
    bolsas250Mes: number;
    bolsas500Mes: number;
    bolsas250Dia: string;
    bolsas500Dia: string;
}

const FACTOR_CACHORRO: Record<CachorroEdad, number> = { '2-4': 3, '4-6': 2.5, '6-9': 2, '9-12': 1.8 };

export function computeRacion({ peso, etapa, cachorroEdad }: RacionInput): RacionResult {
    const etapaCachorro = etapa === 'cachorro';
    const factor = etapaCachorro
        ? (FACTOR_CACHORRO[cachorroEdad as CachorroEdad] || 2)
        : etapa === 'adulto'
            ? 1.4
            : 1.2;

    const gramos = Math.round((70 * Math.pow(peso, 0.75) * factor) / 1.25);
    const kcal = Math.round(70 * Math.pow(peso, 0.75) * factor);
    const comidas = etapaCachorro ? (['2-4', '4-6'] as CachorroEdad[]).includes(cachorroEdad as CachorroEdad) ? 4 : 3 : 2;
    const porComida = Math.round(gramos / comidas);

    return { gramos, kcal, comidas, porComida, factor };
}

export function computeEquivalenciasMensuales(gramos: number, comidas: number): EquivalenciaMensual {
    const totalGMes = gramos * 30;
    return {
        totalGMes,
        kilosMes: (totalGMes / 1000).toFixed(1) + ' kg',
        porcionesMes: comidas * 30,
        bolsas250Mes: Math.ceil(totalGMes / 250),
        bolsas500Mes: Math.ceil(totalGMes / 500),
        bolsas250Dia: ((Math.round((gramos / 250) * 10) / 10)).toFixed(1),
        bolsas500Dia: ((Math.round((gramos / 500) * 10) / 10)).toFixed(1)
    };
}

export function etapaLabel(etapa: Etapa, cachorroEdad?: CachorroEdad | null): string {
    if (etapa === 'cachorro') return `Cachorro (${cachorroEdad} meses)`;
    if (etapa === 'senior') return 'Senior';
    return 'Adulto';
}

export function notaPorEtapa(etapa: Etapa): string {
    if (etapa === 'cachorro') return 'Recomendación para cachorros: revisa su edad periódicamente, ya que sus requerimientos nutricionales cambian durante el crecimiento.';
    if (etapa === 'senior') return 'Perro senior: distribuye la porción en 2 comidas al día para favorecer una digestión ligera.';
    return 'Condición corporal orientativa: esta porción es un punto de partida para tu perro con actividad moderada o habitual en casa.';
}