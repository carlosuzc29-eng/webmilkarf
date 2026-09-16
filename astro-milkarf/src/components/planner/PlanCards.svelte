<script lang="ts">
    import { planner, HELPERS, selectFormula, selectPresentation } from '../../stores/planner.svelte';
    import { MILKARF_CONFIG } from '../../data/catalog';
    import type { FeedingPlan } from '../../domain/plans';

    let { plans, onchoose }: { plans: FeedingPlan[]; onchoose?: (days: number) => void } = $props();

    const formulas = [
        { id: 'pollo', label: 'Pollo', sub: 'Con zanahoria', emoji: '🍗' },
        { id: 'res', label: 'Res', sub: 'Con calabacín', emoji: '🥩' },
        { id: 'mixto', label: 'Plan Mixto', sub: '50% Pollo / 50% Res', emoji: '🥗' }
    ] as const;

    const presList = ['250gr', '500gr'] as const;
    const priceLabel = (formula: string, size: string) => {
        const f = formula === 'mixto' ? 'pollo' : formula;
        const p = MILKARF_CONFIG.catalog[f as 'pollo' | 'res']?.presentations.find(x => x.size === size);
        if (p) return '$' + Number(p.price).toFixed(2);
        return size === '250gr' ? '$2.50–$3.50' : '$5.00–$7.00';
    };
</script>

{#if plans.length}
    <div class="bg-gradient-to-br from-purple-dark via-[#351675] to-purple rounded-3xl p-6 text-white shadow-soft-lg border border-white/10">
        <div class="text-[10px] font-black uppercase tracking-widest text-green">Paso 3: configura su plan</div>
        <h3 class="text-xl md:text-2xl font-black leading-tight">Elige la fórmula y duración para {planner.petName.trim() || 'tu perro'}</h3>

        <!-- Selector de fórmula -->
        <div class="mt-5 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15">
            <span class="text-[10px] font-black uppercase tracking-widest text-green-light block mb-2">Selecciona la fórmula:</span>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {#each formulas as f}
                    <button
                        type="button"
                        aria-pressed={planner.activeFormula === f.id}
                        onclick={() => selectFormula(f.id)}
                        class={`p-3 rounded-xl border flex items-center gap-2.5 font-bold text-xs transition-all ${planner.activeFormula === f.id ? 'bg-white text-purple-dark border-white shadow-sm' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                    >
                        <span class="text-lg">{f.emoji}</span>
                        <span class="text-left">
                            <span class="block leading-tight font-black">{f.label}</span>
                            <span class="text-[9px] font-medium {planner.activeFormula === f.id ? 'text-gray-500' : 'text-white/70'}">{f.sub}</span>
                        </span>
                    </button>
                {/each}
            </div>
        </div>

        <!-- Selector de presentación -->
        <div class="mt-3 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15" role="radiogroup" aria-label="Elige la presentación de bolsa del plan">
            <span class="text-[10px] font-black uppercase tracking-widest text-green-light block mb-2">Elige la presentación de bolsa:</span>
            <div class="grid grid-cols-2 gap-2">
                {#each presList as size}
                    <label class={`cursor-pointer select-none rounded-xl border text-left p-3 transition-all flex items-center gap-2 font-bold text-xs ${planner.activePresentation === size ? 'bg-white/25 border-white/60 text-white' : 'border-white/20 text-white hover:bg-white/20'}`}>
                        <input
                            type="radio"
                            name="astro-peso-plan"
                            value={size}
                            checked={planner.activePresentation === size}
                            onchange={() => selectPresentation(size)}
                            class="sr-only"
                        />
                        <span class={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-black shrink-0 ${planner.activePresentation === size ? 'bg-white border-white text-purple' : 'border-white/40 text-transparent'}`}>{planner.activePresentation === size ? '✓' : ''}</span>
                        <span class="leading-tight">
                            <span class="block font-black">{size.replace('gr', ' g')}</span>
                            <span class="text-[9px] font-medium text-white/70 block">Precio: <span class="font-bold">{priceLabel(planner.activeFormula, size)}</span> c/u</span>
                        </span>
                    </label>
                {/each}
            </div>
        </div>
    </div>

    <!-- Tarjetas de planes -->
    <div class="grid grid-cols-1 gap-5">
        {#each plans as plan}
            {@const isMonthly = plan.days === 30}
            <article class="plan-card {isMonthly ? 'recommended' : ''}">
                <div>
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${isMonthly ? 'bg-pink text-white shadow-sm' : 'bg-green/20 text-green-dark dark:text-green'}`}>
                                {plan.tag || `${plan.days} días`}
                            </span>
                            {#if isMonthly}<span class="text-[9px] font-extrabold uppercase tracking-widest text-pink">Recomendado</span>{/if}
                        </div>
                        <span class="px-2.5 py-1 rounded-xl text-xs font-black bg-purple-light dark:bg-purple/20 text-purple dark:text-white border border-purple-border/60 dark:border-purple/30">
                            {plan.discountPercent}% dcto.
                        </span>
                    </div>

                    <div class="flex items-baseline justify-between gap-2">
                        <h4 class="text-2xl font-black tracking-tight">{plan.label}</h4>
                        <span class="text-xs text-gray-500 dark:text-gray-400 font-semibold">{plan.days} días de alimento</span>
                    </div>
                    {#if plan.split}
                        <span class="text-[10px] font-bold text-pink block mt-1">Composición: {plan.split.polloPct}% Pollo y {plan.split.resPct}% Res</span>
                    {/if}
                    <span class="text-[10px] font-bold text-purple-dark dark:text-white block mt-0.5">Presentación: <b>{plan.presentation.replace('gr', ' g')}</b> · {HELPERS.money(plan.presentationPrice)} c/u · {plan.bagsCount} bolsa(s)</span>

                    <div class="mt-4 p-4 bg-purple-light/70 dark:bg-[#0d0718] rounded-2xl border border-purple-border/40 dark:border-purple/20 space-y-2.5 text-xs">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-500 dark:text-gray-400 font-medium">Cantidad necesaria para {plan.days} días:</span>
                            <span class="font-bold text-purple-dark dark:text-white">{plan.requiredKg} kg ({plan.requiredGrams} g)</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-500 dark:text-gray-400 font-medium">Cantidad total incluida en bolsas:</span>
                            <span class="font-black text-green-dark dark:text-green">{plan.includedKg} kg ({plan.includedGrams} g)</span>
                        </div>
                        <div class="border-t border-purple-border/30 dark:border-purple/20 pt-2 flex items-start gap-1.5 text-[11px] font-bold text-purple/80 dark:text-gray-300">
                            <!-- El excedente por redondeo se presenta como gramos adicionales incluidos, nunca como comida gratis -->
                            {#if plan.surplusGrams > 0}
                                <span class="shrink-0">ℹ️</span>
                                <span>Recibirás <b>{plan.bagsCount} bolsa(s) de {plan.presentation.replace('gr', ' g')}</b> = {plan.includedKg} kg, que cubren los {plan.requiredGrams} g requeridos (+{plan.surplusGrams} g adicionales incluidos por el redondeo de bolsas).</span>
                            {:else}
                                <span class="shrink-0">✅</span>
                                <span>Recibirás <b>{plan.bagsCount} bolsa(s) de {plan.presentation.replace('gr', ' g')}</b> = {plan.includedKg} kg, que cubren los {plan.requiredGrams} g requeridos sin excedente.</span>
                            {/if}
                        </div>
                    </div>

                    <div class="mt-4">
                        <span class="text-[10px] font-black uppercase tracking-widest text-purple/50 dark:text-gray-400 block mb-2">Bolsas calculadas para este plan:</span>
                        <ul class="text-xs space-y-1.5 text-gray-700 dark:text-gray-300 font-semibold">
                            {#each plan.bags as b}
                                <li class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-pink shrink-0"></span><span><b>{b.qty}x</b> presentación de {b.size.replace('gr', ' g')} ({b.formulaName || b.formula})</span></li>
                            {/each}
                        </ul>
                    </div>
                </div>

                <div class="mt-6 pt-4 border-t border-purple-border/30 dark:border-purple/20 space-y-3">
                    <div class="flex items-baseline justify-between">
                        <div>
                            <span class="text-xs text-gray-400 line-through font-bold mr-2">{HELPERS.money(plan.originalPrice)}</span>
                            <span class="text-3xl font-black tracking-tight">{HELPERS.money(plan.finalPrice)}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-xs font-black text-green-dark dark:text-green block">Ahorras {HELPERS.money(plan.savings)}</span>
                            <span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400">~{HELPERS.money(plan.costPerDay)} / día</span>
                        </div>
                    </div>
                    <button type="button" onclick={() => onchoose?.(plan.days)}
                        class={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isMonthly ? 'bg-pink hover:bg-pink-dark shadow-soft-lg' : 'bg-purple hover:bg-purple-dark'}`}>
                        Elegir {plan.label.toLowerCase()}
                    </button>
                </div>
            </article>
        {/each}
    </div>
{:else}
    <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">Calcula primero la porción de tu perro para ver sus planes.</p>
{/if}