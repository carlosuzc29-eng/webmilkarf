<script lang="ts">
    import { HELPERS, clearCart, buildCheckout } from '../../stores/planner.svelte';

    let dialog: HTMLDialogElement;
    let tutorName = $state('');
    let phone = $state('');
    let location = $state('');
    let formError = $state('');
    let postOrder = $state<{ orderId: string; finalTotal: number } | null>(null);

    export function abrir() {
        formError = '';
        postOrder = null;
        dialog?.showModal();
    }
    function cerrar() {
        dialog?.close();
    }

    function confirmar() {
        formError = '';
        if (!tutorName.trim()) { formError = 'Ingresa tu nombre para el pedido.'; return; }
        const checkout = buildCheckout({ tutorName, phone, location });
        if (!checkout) { formError = 'El pedido está vacío.'; return; }

        const opened = (() => {
            try {
                const isMobile = /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS|Instagram|FBAN|FBAV/i.test(navigator.userAgent || '');
                if (isMobile) {
                    window.location.href = checkout.url;
                    return true;
                }
                const w = window.open(checkout.url, '_blank', 'noopener,noreferrer');
                return !!w;
            } catch {
                return false;
            }
        })();

        // Tras coordinar por WhatsApp, el carrito local se vacía (el pedido vive en el chat).
        clearCart();
        postOrder = { orderId: checkout.orderId, finalTotal: checkout.finalTotal };
        if (!opened) {
            // El usuario puede tocar el enlace manualmente si el navegador bloqueó la ventana.
            formError = '';
        }
    }
</script>

<dialog
    bind:this={dialog}
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white dark:bg-darkcard p-6 text-left shadow-2xl border border-purple-border/40 dark:border-purple/20 backdrop:bg-purple-dark/60"
    aria-labelledby="confirmar-pedido-title"
>
    {#if postOrder}
        <div class="text-center py-4">
            <div class="w-14 h-14 mx-auto rounded-full bg-green/15 text-green-dark dark:text-green flex items-center justify-center text-2xl">✓</div>
            <h2 class="text-xl font-black text-purple-dark dark:text-white mt-3" id="confirmar-pedido-title">Pedido enviado</h2>
            <p class="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">Recibimos tu solicitud para coordinar por WhatsApp.</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mt-2">Ref pedido: <b class="text-pink">#{postOrder.orderId}</b> · Total: <b>{HELPERS.money(postOrder.finalTotal)}</b></p>
            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">El costo de entrega se cotiza según tu zona; te esperamos en la conversación.</p>
            <button type="button" onclick={cerrar} class="mt-5 w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-purple hover:bg-purple-dark text-white transition-all">Listo</button>
        </div>
    {:else}
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-black text-purple-dark dark:text-white" id="confirmar-pedido-title">Confirmar pedido</h2>
            <button type="button" onclick={cerrar} aria-label="Cerrar" class="w-9 h-9 rounded-full bg-purple-light dark:bg-purple/20 text-purple dark:text-white font-black hover:opacity-70">×</button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-5">Estos datos van en el mensaje que abriremos en WhatsApp para coordinar la entrega.</p>

        <form method="dialog" onsubmit={(e) => { e.preventDefault(); confirmar(); }} class="space-y-4">
            <label class="block">
                <span class="text-[10px] font-black uppercase tracking-widest text-purple/50 dark:text-gray-400 block mb-1.5">Tu nombre *</span>
                <input type="text" bind:value={tutorName} autocomplete="name" placeholder="Ej. María Pérez"
                    class="w-full bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-xl p-3.5 text-base font-bold text-purple-dark dark:text-white outline-none focus:border-purple transition-all" />
            </label>
            <label class="block">
                <span class="text-[10px] font-black uppercase tracking-widest text-purple/50 dark:text-gray-400 block mb-1.5">WhatsApp o teléfono</span>
                <input type="tel" bind:value={phone} autocomplete="tel" placeholder="Ej. +58 412 123 4567" inputmode="tel"
                    class="w-full bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-xl p-3.5 text-base font-bold text-purple-dark dark:text-white outline-none focus:border-purple transition-all" />
            </label>
            <label class="block">
                <span class="text-[10px] font-black uppercase tracking-widest text-purple/50 dark:text-gray-400 block mb-1.5">Dirección o zona de entrega</span>
                <textarea bind:value={location} rows="2" placeholder="Ciudad, sector, referencia…"
                    class="w-full bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-xl p-3.5 text-sm font-semibold text-purple-dark dark:text-white outline-none focus:border-purple transition-all"></textarea>
            </label>

            {#if formError}<p class="text-xs font-bold text-pink" role="alert">{formError}</p>{/if}

            <button type="submit"
                class="w-full py-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-green text-purple-dark hover:bg-green-dark hover:text-white transition-all active:scale-[0.98] shadow-soft-lg flex items-center justify-center gap-2">
                Abrir WhatsApp con mi pedido
            </button>
            <p class="text-[10px] text-gray-400 dark:text-gray-500 font-medium text-center">Al tocar confirmar se abre WhatsApp con el detalle de tu pedido. No se guardan datos de pago.</p>
        </form>
    {/if}
</dialog>