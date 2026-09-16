<script lang="ts">
    // Isla principal: PlanificadorMilkarf (carga con client:load).
    import DataMascota from './DataMascota.svelte';
    import ResultadoRacion from './ResultadoRacion.svelte';
    import PlanCards from './PlanCards.svelte';
    import CarritoResumen from './CarritoResumen.svelte';
    import ConfirmarPedidoModal from './ConfirmarPedidoModal.svelte';

    import { planner, calcular, choosePlan, recomputePlans } from '../../stores/planner.svelte';

    let plans = $derived(recomputePlans());
    let showCart = $state(false);
    let cartSection: HTMLElement;

    const hasResultado = $derived(planner.resultado !== null);

    $effect(() => {
        if (planner.error) {
            showToastError(planner.error);
        }
    });

    let toast = $state<{ msg: string; ok: boolean } | null>(null);
    function showToast(msg: string, ok = false) {
        toast = { msg, ok };
        setTimeout(() => { if (toast?.msg === msg) toast = null; }, 3200);
    }
    function showToastError(msg: string) {
        if (msg) showToast(msg, false);
    }

    function goStep(step: number) {
        if (step === 2 && !hasResultado) { showToast('Ingresa primero los datos de tu perro.'); return; }
        if (step === 3 && !hasResultado) { showToast('Calcula primero la porción de tu perro.'); return; }
        if (step === 4) { showCart = true; showCartSection(); return; }
        document.getElementById(step === 1 ? 'astro-calc-card' : step === 2 ? 'astro-resultado' : 'astro-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function onChoosePlan(days: number) {
        const plan = choosePlan(days);
        showCart = true;
        showCartSection();
        showToast(`Plan para ${plan.petName} agregado al pedido.`, true);
    }

    function showCartSection() {
        requestAnimationFrame(() => cartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }

    function irAlInicio() {
        document.getElementById('astro-calc-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
</script>

<div class="w-full max-w-2xl mx-auto">
    <!-- Indicador de progreso -->
    <div class="w-full max-w-md mx-auto mb-6 select-none">
        <div class="grid grid-cols-4 gap-1 sm:gap-2 text-center" role="list">
            {#each [['1', 'Sus datos'], ['2', 'Su porción'], ['3', 'Elige plan'], ['4', 'Pedido']] as [n, label], i}
                <div class="flex flex-col items-center gap-1 py-2 px-1 rounded-xl border border-purple-border/50 dark:border-purple/20 bg-white dark:bg-darkcard text-left">
                    <span class="w-5 h-5 rounded-full bg-purple/10 dark:bg-purple/20 text-purple dark:text-white text-[10px] font-black flex items-center justify-center">{n}</span>
                    <span class="text-[9px] font-bold tracking-tight leading-tight text-purple/60 dark:text-gray-400">{label}</span>
                    <button type="button" class="text-[10px] font-bold text-pink dark:text-green hover:underline" onclick={() => goStep(i + 1)}>Ir</button>
                </div>
            {/each}
        </div>
    </div>

    <!-- Tarjeta de datos (Paso 1) -->
    <div id="astro-calc-card" class="max-w-md w-full mx-auto bg-white dark:bg-darkcard rounded-2xl shadow-soft-lg border border-purple-border/30 dark:border-purple/20 mb-8 overflow-hidden">
        <div class="bg-gradient-to-br from-purple-dark to-purple dark:from-[#2e1060] dark:to-[#1a0836] p-6 relative overflow-hidden text-left">
            <div class="text-[11px] font-bold text-green tracking-wider uppercase mb-1">Referencia inicial orientativa</div>
            <div class="text-xs text-white/80 font-medium">Estima la cantidad recomendada para tu perro y arma su plan de alimentación.</div>
        </div>
        <div class="p-6 space-y-6">
            <div class="bg-purple-light dark:bg-[#0d0718] border border-purple-border/40 dark:border-purple/20 rounded-2xl p-4 text-left">
                <p class="text-xs leading-relaxed text-gray-600 dark:text-gray-400 font-medium">La porción diaria es una referencia inicial orientativa calculada según el peso y la etapa de vida de tu perro. A partir de esta porción armamos sus planes para 7, 15 y 30 días.</p>
            </div>

            <DataMascota />

            <button id="btn-calcular-racion" type="button"
                onclick={calcular}
                class="w-full p-4 bg-purple hover:bg-purple-dark text-white font-bold text-sm tracking-wide rounded-xl shadow-soft hover:shadow-soft-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                ✨ Calcular porción
            </button>

            <div class="text-left">
                <ResultadoRacion />
            </div>
        </div>
    </div>

    <!-- Paso 3: planes -->
    <section id="astro-plans" class="mt-8 space-y-6 text-left">
        <PlanCards {plans} on:choose={onChoosePlan} />
    </section>

    <!-- Paso 4: pedido -->
    <CarritoResumen bind:element={cartSection} {showCart} />

    <ConfirmarPedidoModal />
</div>

<div aria-live="polite" class="fixed top-10 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
    {#if toast}
        <div class="bg-purple dark:bg-darkcard text-white text-sm font-black px-6 py-3 rounded-full shadow-2xl border border-white/10">
            {toast.msg}
        </div>
    {/if}
</div>

{#if !showCart}
    <button type="button" onclick={irAlInicio} class="mt-2 text-xs font-bold text-purple/60 dark:text-gray-400 hover:text-pink transition-colors">↑ Volver al inicio de la calculadora</button>
{/if}