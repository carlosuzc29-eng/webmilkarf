<script lang="ts">
    import { planner, HELPERS, cartTotals, removePlan, updatePlanDuration, updatePlanFormula, updatePlanPresentation } from '../../stores/planner.svelte';
    import ConfirmarPedidoModal from './ConfirmarPedidoModal.svelte';

    let { showCart, element }: { showCart: boolean; element?: HTMLElement } = $props();

    const totals = $derived(cartTotals());
    let modal: ConfirmarPedidoModal;

    function abrirConfirmacion() {
        if (!totals.count) return;
        modal?.abrir();
    }
</script>

<section id="astro-carrito" bind:this={element} class="mt-5 sm:mt-8 space-y-4 sm:space-y-6 text-left">
    <div class="bg-gradient-to-br from-purple-dark via-[#351675] to-purple rounded-3xl p-4 sm:p-6 text-white shadow-soft-lg border border-white/10">
        <div class="text-[10px] font-black uppercase tracking-widest text-green">Paso 4: revisa tu pedido</div>
        <h3 class="text-lg sm:text-xl md:text-2xl font-black leading-tight mt-0.5">Tu pedido</h3>
        <p class="text-[10px] sm:text-xs text-white/80 font-medium mt-0.5">Revisa los planes elegidos; al confirmar te contactamos por WhatsApp para coordinar entrega y pago.</p>
    </div>

    {#if totals.count > 0}
        <div class="space-y-3 sm:space-y-4">
            {#each planner.cart as item}
                <article class="bg-white dark:bg-darkcard rounded-3xl p-4 sm:p-5 border border-purple-border/50 dark:border-purple/20 shadow-sm text-left">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-pink">Plan {item.durationDays} días</p>
                            <h4 class="text-base sm:text-lg font-black text-purple-dark dark:text-white">{item.petName}</h4>
                            <p class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">{item.formulaName} · {item.presentation.replace('gr', ' g')} · {item.totalGramsProvided} g provistos</p>
                        </div>
                        <button type="button" aria-label="Quitar plan" onclick={() => removePlan(item.id)}
                            class="text-[10px] font-bold text-pink border border-pink/20 rounded-full px-3 py-1.5 hover:bg-pink/10 transition-colors shrink-0">Quitar</button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 sm:mt-4">
                        <label class="block">
                            <span class="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-purple/50 dark:text-gray-400 block mb-1">Duración</span>
                            <select onchange={(e) => updatePlanDuration(item.id, Number(e.currentTarget.value))} class="w-full bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-xl p-2 text-[11px] sm:text-xs font-bold text-purple-dark dark:text-white outline-none min-h-[44px]">
                                <option value="7" selected={item.durationDays === 7}>7 días</option>
                                <option value="15" selected={item.durationDays === 15}>15 días</option>
                                <option value="30" selected={item.durationDays === 30}>30 días</option>
                            </select>
                        </label>
                        <label class="block">
                            <span class="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-purple/50 dark:text-gray-400 block mb-1">Fórmula</span>
                            <select onchange={(e) => updatePlanFormula(item.id, e.currentTarget.value)} class="w-full bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-xl p-2 text-[11px] sm:text-xs font-bold text-purple-dark dark:text-white outline-none min-h-[44px]">
                                <option value="pollo" selected={item.formula === 'pollo'}>Pollo con Zanahoria</option>
                                <option value="res" selected={item.formula === 'res'}>Res con Calabacín</option>
                                <option value="mixto" selected={item.formula === 'mixto'}>Plan Mixto 50/50</option>
                            </select>
                        </label>
                        <label class="block">
                            <span class="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-purple/50 dark:text-gray-400 block mb-1">Presentación</span>
                            <select onchange={(e) => updatePlanPresentation(item.id, e.currentTarget.value as '250gr' | '500gr')} class="w-full bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-xl p-2 text-[11px] sm:text-xs font-bold text-purple-dark dark:text-white outline-none min-h-[44px]">
                                <option value="250gr" selected={item.presentation === '250gr'}>250 g</option>
                                <option value="500gr" selected={item.presentation === '500gr'}>500 g</option>
                            </select>
                        </label>
                    </div>

                    <div class="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-purple-border/30 dark:border-purple/20 flex items-center justify-between text-xs sm:text-sm">
                        <span class="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400">
                            Subtotal <span class="line-through">{HELPERS.money(item.originalSubtotal)}</span>
                            <span class="ml-1 text-green">−{(item.discountPct || 0) * 100}%</span>
                        </span>
                        <span class="font-black text-purple-dark dark:text-white text-sm sm:text-base">{HELPERS.money(item.finalPrice)}</span>
                    </div>
                </article>
            {/each}
        </div>

        <div class="bg-white dark:bg-darkcard rounded-3xl p-4 sm:p-5 border border-purple-border/50 dark:border-purple/20 shadow-soft-lg text-left">
            <div class="space-y-2 text-xs sm:text-sm">
                <div class="flex justify-between items-center">
                    <span class="font-semibold text-gray-600 dark:text-gray-300">Subtotal</span>
                    <span class="font-bold text-purple-dark dark:text-white">{HELPERS.money(totals.totalOriginalSubtotal)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="font-semibold text-gray-600 dark:text-gray-300">Descuento de plan</span>
                    <span class="font-black text-green-dark dark:text-green">−{HELPERS.money(totals.totalPlanDiscount)}</span>
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-purple-border/30 dark:border-purple/20">
                    <span class="font-black text-purple-dark dark:text-white">Total fórmulas</span>
                    <span class="text-lg sm:text-2xl font-black text-purple-dark dark:text-white">{HELPERS.money(totals.finalTotal)}</span>
                </div>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Costo de entrega: pendiente por cotizar según zona.</p>
            </div>
            <button type="button" onclick={abrirConfirmacion}
                class="mt-3 sm:mt-4 w-full py-3 sm:py-4 rounded-xl font-bold text-[11px] sm:text-xs uppercase tracking-wider bg-pink hover:bg-pink-dark text-white transition-all active:scale-[0.98] shadow-soft-lg flex items-center justify-center gap-2 min-h-[44px]">
                Confirma tu pedido por WhatsApp
            </button>
        </div>
    {:else}
        <div class="bg-white dark:bg-darkcard rounded-3xl p-5 sm:p-6 border border-purple-border/50 dark:border-purple/20 shadow-sm text-center">
            {#if showCart}
                <p class="text-xs sm:text-sm font-bold text-purple-dark dark:text-white">Tu pedido está vacío.</p>
                <p class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">Elige un plan en el Paso 3 para agregarlo al pedido.</p>
            {:else}
                <p class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Tus planes aparecerán aquí para revisarlos antes de confirmar.</p>
            {/if}
        </div>
    {/if}

    <ConfirmarPedidoModal bind:this={modal} />
</section>