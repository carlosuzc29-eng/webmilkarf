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

Quisiera confirmar recomendaciones de fórmulas, disponibilidad, costo de entrega y siguientes pasos.`;

        case 'newOrder': {
            const items = Array.isArray(data.items) ? data.items : [];
            const hasFeedingPlans = items.some((i: any) => i.type === 'feeding_plan');

            let itemsFormatted = '';
            if (hasFeedingPlans) {
                itemsFormatted = items.map((i: any, index: number) => {
                    if (i.type === 'feeding_plan') {
                        const bagsText = Array.isArray(i.bags) ? i.bags.map((b: any) => `${b.qty}x ${b.weight}`).join(' + ') : '';
                        const reqKg = (Number(i.totalGramsRequired || 0) / 1000).toFixed(2);
                        const provKg = (Number(i.totalGramsProvided || 0) / 1000).toFixed(2);
                        const surplus = Number(i.surplusGrams || 0);
                        const presText = i.presentation ? String(i.presentation).replace('gr', ' g') : (Array.isArray(i.bags) && i.bags[0] ? String(i.bags[0].weight).replace('gr', ' g') : '');
                        const petWeight = Number(i.petWeight) ? ` · ${Number(i.petWeight)} kg` : '';
                        const bagsCount = Number(i.bagsCount) || (Array.isArray(i.bags) ? i.bags.reduce((s: number, b: any) => s + (Number(b.qty) || 0), 0) : 0);
                        const subtotalNum = Number(i.originalSubtotal || i.price);
                        const discNum = Number(i.discountAmount || 0);
                        const discPctNum = Number(i.discountPct || 0) * 100;
                        const totalNum = Number(i.finalPrice || i.price);
                        const excedente = surplus > 0 ? ` (+${surplus} g adicionales por redondeo)` : '';
                        return `${index + 1}. *Plan para ${i.petName || i.forPet || 'Mascota'}*${petWeight}
   • Mascota: ${i.petName || i.forPet || 'Mascota'}${petWeight} · Ración: ${Number(i.dailyGrams) || 0} g/día
   • Fórmula: ${i.formulaName || 'Fórmula'} · Plan ${Number(i.durationDays) || 7} días
   • Presentación: ${presText || '500 g'} · Bolsas: ${bagsText || bagsCount + ' bolsa(s)'}
   • Alimento: ${reqKg} kg requeridos / ${provKg} kg provistos${excedente}
   • Subtotal: ${currency(subtotalNum)} · Descuento (-${discPctNum}%): -${currency(discNum)}
   • Total plan: ${currency(totalNum)}`;
                    }
                    const pet = i.forPet ? ` - Para ${i.forPet}` : '';
                    return `${index + 1}. ${Number(i.qty || 1)}x ${i.name || 'Fórmula'} (${i.weight || ''})${pet} - ${currency((i.price || 0) * (i.qty || 1))}`;
                }).join('\n\n');
            } else if (items.length) {
                itemsFormatted = items.map((i: any, index: number) => {
                    const pet = i.forPet ? ` - Para ${i.forPet}` : '';
                    return `${index + 1}. ${Number(i.qty || 0)}x ${i.name || 'Fórmula'} (${i.weight || 'presentación'})${pet}`;
                }).join('\n');
            } else {
                itemsFormatted = 'Pedido Milkarf';
            }

            let msg = `Hola, equipo Milkarf.

Quisiera confirmar mi pedido ${hasFeedingPlans ? 'de planes de alimentación' : ''} para mi mascota:

👤 *Tutor:* ${userName}${data.contactPhone ? `\n📱 *Teléfono:* ${data.contactPhone}` : ''}

📦 *DETALLE DEL PEDIDO:*
${itemsFormatted}

💵 *RESUMEN DE COMPRA:*
• Subtotal: ${currency(data.subtotal)}`;

            if (Number(data.discountAmount) > 0) {
                const label = data.discountLabel || (data.discountType === 'welcome' ? 'Descuento de bienvenida (-20%)' : 'Descuento de plan');
                msg += `\n• ${label}: -${currency(data.discountAmount)}`;
            }
            msg += `\n• *TOTAL FÓRMULAS:* ${currency(data.finalTotal)}`;
            msg += `\n• *Costo de entrega:* Pendiente por cotizar según zona`;

            if (data.location) {
                msg += `\n\n📍 *Ubicación para la entrega:*\n${data.location}`;
            }
            if (data.orderId) {
                msg += `\n\n🔖 *Ref pedido web:* #${data.orderId}`;
            }
            msg += `\n\nQuedo atento/a para coordinar la confirmación y entrega. ¡Muchas gracias!`;
            return msg;
        }

        default:
            return getWhatsAppTemplate('general', data);
    }
}