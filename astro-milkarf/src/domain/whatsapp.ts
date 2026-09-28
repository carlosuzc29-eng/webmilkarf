// Plantillas y enlaces de WhatsApp (misma lógica que app.js, sin dependencia de window).
// Diferencia intencional de copy: el excedente por redondeo de bolsas se presenta
// como "gramos adicionales por redondeo", nunca como comida gratis/«sin costo».

import { WA_NUMBER } from '../data/catalog';

export function capitalizeName(value = '') {
    if (!value) return '';
    return String(value)
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function normalizePhone(value = '') {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = '58' + digits.slice(1);
    if (digits.length === 10 && digits.startsWith('4')) digits = '58' + digits;
    if (digits.length === 11 && digits.startsWith('04')) digits = '58' + digits.slice(1);
    return digits;
}

export function formatPhoneForDisplay(value = '') {
    const digits = normalizePhone(value);
    if (!digits) return '';
    if (digits.startsWith('58') && digits.length >= 12) {
        return '+58 ' + digits.slice(2, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
    }
    return '+' + digits;
}

export function sanitizeWhatsAppMessage(text = '') {
    return String(text)
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function buildWhatsAppLinks(message: string, phone = WA_NUMBER) {
    const cleanPhone = normalizePhone(phone || WA_NUMBER);
    const cleanMessage = sanitizeWhatsAppMessage(message || '');
    const encoded = encodeURIComponent(cleanMessage);
    const phonePart = cleanPhone ? `phone=${cleanPhone}&` : '';
    return {
        phone: cleanPhone,
        message: cleanMessage,
        app: `whatsapp://send?${phonePart}text=${encoded}`,
        api: `https://api.whatsapp.com/send?${phonePart}text=${encoded}`,
        wa: cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`,
        web: cleanPhone ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}` : `https://web.whatsapp.com/send?text=${encoded}`
    };
}

export function isMobileCheckoutBrowser(ua = '') {
    const userAgent = ua || (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
    return !!(/Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS|Instagram|FBAN|FBAV/i.test(userAgent));
}

export function getCheckoutWhatsAppUrl(message: string, phone = WA_NUMBER, ua = '') {
    const links = buildWhatsAppLinks(message, phone);
    const mobile = isMobileCheckoutBrowser(ua);

    // En celulares, wa.me es el flujo más estable para Safari, Chrome iOS,
    // Android Chrome y navegadores internos de Instagram/Facebook.
    if (mobile) return links.wa || links.api || links.app;

    // En escritorio priorizamos WhatsApp Web.
    return links.web || links.api || links.wa;
}

export type WhatsAppTemplateType = 'general' | 'quickHelp' | 'newOrder';

export function getWhatsAppTemplate(type: WhatsAppTemplateType | string = 'general', data: Record<string, unknown> = {}): string {
    const currency = (value: unknown) => '$' + Number(value || 0).toFixed(2);
    const userName = capitalizeName(String(data.userName || data.email || 'Cliente Milkarf'));

    switch (type) {
        case 'general':
            return `Hola, equipo Milkarf.

Me gustaría recibir información sobre la alimentación fisiológica para mi mascota.

Quisiera conocer las fórmulas disponibles, presentaciones recomendadas y los pasos adecuados para iniciar la transición.`;

        case 'quickHelp':
            return `Hola, equipo Milkarf.

Estoy revisando su tienda web y deseo orientación antes de completar mi pedido.

Quisiera confirmar recomendaciones de fórmulas, costo de entrega y siguientes pasos.`;

        case 'newOrder': {
            const items = Array.isArray(data.items) ? data.items : [];
            const hasFeedingPlans = items.some((i: any) => i.type === 'feeding_plan');

            let itemsFormatted = '';
            if (hasFeedingPlans) {
                itemsFormatted = items.map((i: any, index: number) => {
                    if (i.type === 'feeding_plan') {
                        const bagsText = Array.isArray(i.bags) ? i.bags.map((b: any) => `${b.qty}x ${b.size || b.weight}`).join(' + ') : '';
                        const provKg = (Number(i.totalGramsProvided || 0) / 1000).toFixed(2);
                        const presText = i.presentation ? String(i.presentation).replace('gr', ' g') : (Array.isArray(i.bags) && i.bags[0] ? String(i.bags[0].weight || i.bags[0].size).replace('gr', ' g') : '550 g');
                        const bagsCount = Number(i.bagsCount) || (Array.isArray(i.bags) ? i.bags.reduce((s: number, b: any) => s + (Number(b.qty) || 0), 0) : 0);
                        const totalNum = Number(i.finalPrice || i.price || 0);
                        const days = Number(i.durationDays) || 7;
                        const formula = i.formula === 'res' ? 'Carne de Res' : (i.formula === 'mixto' ? 'Mixto' : (i.formulaName || 'Pollo'));
                        const formulaTag = formula ? `${formula} · ` : '';
                        const pet = i.petName || i.forPet || 'Mascota';
                        return `${index + 1}. *Plan para ${pet}* (${formulaTag}${days} días)
   • Presentación: ${presText} · Bolsas: ${bagsText || (bagsCount + ' bolsa(s)')} (${provKg} kg provistos)
   • Total plan: ${currency(totalNum)}`;
                    }
                    const pet = i.forPet ? ` (para ${i.forPet})` : '';
                    return `${index + 1}. ${Number(i.qty || 1)}x ${i.name || 'Fórmula'} (${i.weight || 'presentación'})${pet} - ${currency((i.price || 0) * (i.qty || 1))}`;
                }).join('\n\n');
            } else if (items.length) {
                itemsFormatted = items.map((i: any, index: number) => {
                    const pet = i.forPet ? ` (para ${i.forPet})` : '';
                    return `${index + 1}. ${Number(i.qty || 1)}x ${i.name || 'Fórmula'} (${i.weight || 'presentación'})${pet} - ${currency((i.price || 0) * (i.qty || 1))}`;
                }).join('\n');
            } else {
                itemsFormatted = 'Pedido Milkarf';
            }

            let msg = `¡Hola, equipo Milkarf! Quiero realizar el siguiente pedido:
👤 *Cliente:* ${userName}
📦 *PEDIDO:*
${itemsFormatted}
💰 *TOTAL A PAGAR:* ${currency(data.finalTotal)}`;

            if (Number(data.discountAmount) > 0) {
                const label = data.discountLabel || (data.discountType === 'welcome' ? 'Descuento de bienvenida (-20%)' : 'Descuento de plan');
                msg += `\n• ${label}: -${currency(data.discountAmount)}`;
            }

            msg += `\n📍 *Dirección de entrega:*`;
            if (data.location) {
                msg += `\n${data.location}`;
            }

            return msg;
        }

        default:
            return getWhatsAppTemplate('general', data);
    }
}