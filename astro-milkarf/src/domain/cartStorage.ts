// Persistencia local versionada y validada para el carrito del nuevo sitio.
// Clave independiente de la legacy (`milkarf_cart_astro_v1`) para no pisar datos
// del sitio actual mientras conviven ambos.

import type { FeedingPlan } from './plans';

export const CART_STORAGE_KEY = 'milkarf_cart_astro_v1';

export interface CartItemPlan extends FeedingPlan {
    type: 'feeding_plan';
    key?: string;
}

export type CartItem = CartItemPlan;

export function loadCartFromStorage(): CartItem[] {
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isValidCartItem);
    } catch {
        return [];
    }
}

function isValidCartItem(item: unknown): item is CartItem {
    if (!item || typeof item !== 'object') return false;
    const it = item as Record<string, unknown>;
    if (it.type !== 'feeding_plan') return false;
    return (
        typeof it.requiredGrams === 'number' &&
        typeof it.totalGramsProvided === 'number' &&
        typeof it.finalPrice === 'number' &&
        typeof it.dailyGrams === 'number' &&
        typeof it.durationDays === 'number' &&
        typeof it.petName === 'string'
    );
}

export function saveCartToStorage(cart: CartItem[]): void {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart || []));
    } catch {
        // Almacenamiento no disponible; el carrito vive solo en memoria.
    }
}

export function clearCartFromStorage(): void {
    try {
        localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
        // nada
    }
}

export function nicknameForKey(petName: string): string {
    if (petName && /^\s*$/.test(petName) === false) {
        return petName.trim().toLowerCase();
    }
    return 'sin-nombre';
}