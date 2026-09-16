<script lang="ts">
    import { planner, HELPERS, selectFormula, selectPresentation } from '../../stores/planner.svelte';
    import { MILKARF_CONFIG } from '../../data/catalog';
    import type { FeedingPlan } from '../../domain/plans';

    let { plans, onchoose }: { plans: FeedingPlan[]; onchoose?: (days: number) => void } = $props();

    let expandedDays = $state<number | null>(null);

    const formulas = [
        { id: 'pollo' as const, label: 'Pollo', sub: 'Con zanahoria', emoji: '🍗' },
        { id: 'res' as const, label: 'Res', sub: 'Con calabacín', emoji: '🥩' },
        { id: 'mixto' as const, label: 'Plan Mixto', sub: '50% Pollo / 50% Res', emoji: '🥗' }
    ];

    const presList = ['250gr', '500gr'] as const;

    function priceLabel(formula: string, size: string) {
        const f = formula === 'mixto' ? 'pollo' : formula;
        const p = MILKARF_CONFIG.catalog[f as 'pollo' | 'res']?.presentations.find(x => x.size === size);
        if (p) return '$' + Number(p.price).toFixed(2);
        return size === '250gr' ? '$2.50–$3.50' : '$5.00–$7.00';
    }

    function toggleExpand(days: number) {
        expandedDays = expandedDays === days ? null : days;
    }

    function getPlanForDays(days: number): FeedingPlan | undefined {
        return plans.find(p => p.days === days);
    }

    function hasChosenPlan(days: number): boolean {
        return planner.cart.some(c => c.durationDays === days && c.petName === planner.petName);
    }

    const planOrder = [7, 15, 30] as const;
    const planNames: Record<number, string> = { 7: 'Semanal', 15: 'Quincenal', 30: 'Mensual' };

    const formulaName = $derived(
        planner.activeFormula === 'pollo' ? 'Pollo con Zanahoria' :
        planner.activeFormula === 'res' ? 'Carne de Res con Calabacín' :
        'Plan Mixto (Pollo y Res)'
    );
</script>

{#snippet planHeaders(hasData: boolean)}
    <div class="grid grid-cols-3 gap-1.5 sm:gap-2">
        {#each planOrder as days}
            {@const plan = getPlanForDays(days)}
            {@const isExpanded = expandedDays === days}
            {@const chosen = hasChosenPlan(days)}
            {@const isMonthly = days === 30}
            {@const discPct = Math.round((MILKARF_CONFIG.planDiscounts[days]?.discountPct || 0) * 100)}

            <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls="plan-detail-{days}"
                onclick={() => toggleExpand(days)}
                class="plan-header-card group relative flex flex-col items-center text-center p-2.5 sm:p-3.5 rounded-xl border transition-all min-h-[44px]
                    {isMonthly
                        ? 'border-pink/40 bg-pink/5 hover:bg-pink/10'
                        : 'border-purple-border/40 dark:border-purple/20 bg-white dark:bg-darkcard hover:bg-purple-light/60 dark:hover:bg-purple/10'}
                    {isExpanded ? 'ring-2 ring-green/50 shadow-md' : ''}
                    {chosen ? 'ring-1 ring-green/30' : ''}"
            >
                <span class="text-[10px] sm:text-[11px] font-black uppercase tracking-wider {isMonthly ? 'text-pink' : 'text-purple/70 dark:text-gray-400'}">
                    {planNames[days]}
                </span>
                {#if hasData && plan}
                    <span class="text-sm sm:text-lg font-black text-green-dark dark:text-green mt-0.5 leading-tight">
                        Ahorras {HELPERS.money(plan.savings)}
                    </span>
                    <span class="text-[8px] sm:text-[9px] font-bold text-purple/50 dark:text-gray-500 mt-0.5">
                        {plan.discountPercent}% dcto.
                    </span>
                {:else}
                    <span class="text-[9px] sm:text-[10px] font-bold text-purple/40 dark:text-gray-500 mt-1">{discPct}% dcto.</span>
                {/if}
                <span class="text-purple/40 dark:text-gray-500 text-[10px] mt-0.5 transition-transform {isExpanded ? 'rotate-180' : ''}">⌄</span>
                {#if chosen}
                    <span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-green shrink-0"></span>
                {/if}
            </button>
        {/each}
    </div>
{/snippet}

{#snippet detailPanel(plan: FeedingPlan | undefined, days: number)}
    {#if plan}
        <div id="plan-detail-{days}" class="mt-2 rounded-2xl border border-purple-border/30 dark:border-purple/20 bg-white dark:bg-darkcard p-4 sm:p-5 shadow-sm text-left"
             role="region" aria-label="Detalle del plan {planNames[days]}">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h4 class="text-base sm:text-lg font-black text-purple-dark dark:text-white">{plan.label}</h4>
                    <p class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold">{plan.days} días de alimento</p>
                </div>
                <span class="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-black bg-purple-light dark:bg-purple/20 text-purple dark:text-white border border-purple-border/60 dark:border-purple/30 shrink-0">
                    {plan.discountPercent}% dcto.
                </span>
            </div>

            {#if plan.split}
                <p class="text-[10px] sm:text-[11px] font-bold text-pink mb-2">
                    Mixto: {plan.bags.filter(b => b.formula === 'pollo').reduce((s, b) => s + b.qty, 0)} bolsas de Pollo + {plan.bags.filter(b => b.formula === 'res').reduce((s, b) => s + b.qty, 0)} bolsas de Res
                    ({plan.split.polloPct}% / {plan.split.resPct}% aprox.)
                </p>
            {/if}

            <div class="space-y-1.5 text-[10px] sm:text-[11px] mb-3">
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Fórmula</span>
                    <span class="font-bold text-purple-dark dark:text-white">{formulaName}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Presentación</span>
                    <span class="font-bold text-purple-dark dark:text-white">{plan.presentation.replace('gr', ' g')} · {HELPERS.money(plan.presentationPrice)} c/u</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Bolsas</span>
                    <span class="font-bold text-purple-dark dark:text-white">{plan.bagsCount} total</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Peso incluido</span>
                    <span class="font-bold text-green-dark dark:text-green">{plan.includedKg} kg ({plan.includedGrams} g)</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500 dark:text-gray-400">Necesario</span>
                    <span class="font-bold text-purple-dark dark:text-white">{plan.requiredKg} kg ({plan.requiredGrams} g)</span>
                </div>
            </div>

            {#if plan.surplusGrams > 0}
                <p class="text-[9px] sm:text-[10px] font-bold text-purple/60 dark:text-gray-400 mb-3">
                    +{plan.surplusGrams} g adicionales incluidos por el redondeo de bolsas.
                </p>
            {/if}

            <div class="border-t border-purple-border/30 dark:border-purple/20 pt-3 space-y-1.5 text-[10px] sm:text-[11px]">
                <div class="flex justify-between items-center">
                    <span class="text-gray-500 dark:text-gray-400 font-medium">Subtotal</span>
                    <span class="font-bold text-gray-400 line-through">{HELPERS.money(plan.originalPrice)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-500 dark:text-gray-400 font-medium">Ahorro ({plan.discountPercent}%)</span>
                    <span class="font-black text-green-dark dark:text-green">−{HELPERS.money(plan.savings)}</span>
                </div>
                <div class="flex justify-between items-center pt-1.5 border-t border-purple-border/30 dark:border-purple/20">
                    <span class="font-black text-purple-dark dark:text-white text-xs sm:text-sm">Total</span>
                    <span class="text-lg sm:text-xl font-black text-purple-dark dark:text-white">{HELPERS.money(plan.finalPrice)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-400 dark:text-gray-500">Costo diario</span>
                    <span class="text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-gray-400">~{HELPERS.money(plan.costPerDay)} / día</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-400 dark:text-gray-500">Entrega</span>
                    <span class="text-[9px] sm:text-[10px] font-semibold text-gray-500 dark:text-gray-400">Por cotizar según zona</span>
                </div>
            </div>

            <button type="button" onclick={() => onchoose?.(plan.days)}
                class="mt-4 w-full py-3 sm:py-3.5 rounded-xl font-bold text-[11px] sm:text-xs uppercase tracking-wider text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 min-h-[44px]
                    {hasChosenPlan(plan.days) ? 'bg-green text-purple-dark' : isMonthly ? 'bg-pink hover:bg-pink-dark shadow-soft-lg' : 'bg-purple hover:bg-purple-dark'}">
                {hasChosenPlan(plan.days) ? '✓ Elegido' : `Elegir plan ${planNames[plan.days].toLowerCase()}`}
            </button>
        </div>
    {/if}
{/snippet}

{#if !planner.resultado}
    <!-- Cabeceras visibles sin datos: solo nombre, % e instrucción (nunca "Ahorras $0") -->
    <div class="text-left">
        <div class="text-[10px] font-black uppercase tracking-widest text-purple/50 dark:text-gray-400 mb-1">Paso 3 · Elige el plan</div>
        {@render planHeaders(false)}
        <p class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium text-center mt-2">Calcula su porción para conocer tu ahorro.</p>
    </div>
{:else}
    <div class="bg-gradient-to-br from-purple-dark via-[#351675] to-purple rounded-3xl p-4 sm:p-6 text-white shadow-soft-lg border border-white/10">
        <div class="text-[10px] font-black uppercase tracking-widest text-green">Paso 3: configura su plan</div>
        <h3 class="text-lg sm:text-xl md:text-2xl font-black leading-tight mt-1">Elige la fórmula y duración para {planner.petName.trim() || 'tu perro'}</h3>

        <!-- Selector de fórmula con radios nativos -->
        <fieldset class="mt-4 bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-white/15">
            <legend class="text-[10px] font-black uppercase tracking-widest text-green-light px-1">Selecciona la fórmula:</legend>
            <div class="grid grid-cols-3 gap-1.5 sm:gap-2" role="radiogroup" aria-label="Fórmula de alimentación">
                {#each formulas as f}
                    {@const isSelected = planner.activeFormula === f.id}
                    <label
                        class="relative flex items-center gap-1.5 sm:gap-2.5 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all min-h-[44px] select-none
                            {isSelected
                                ? 'bg-green/90 text-purple-dark border-green shadow-md ring-1 ring-green/50'
                                : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}"
                    >
                        <input
                            type="radio"
                            name="astro-formula"
                            value={f.id}
                            checked={isSelected}
                            onchange={() => selectFormula(f.id)}
                            class="sr-only"
                        />
                        <span class="text-base sm:text-lg shrink-0">{f.emoji}</span>
                        <span class="text-left min-w-0">
                            <span class="block leading-tight font-black text-[11px] sm:text-xs">{f.label}</span>
                            <span class="block text-[8px] sm:text-[9px] font-medium leading-tight {isSelected ? 'text-purple-dark/60' : 'text-white/60'}">{f.sub}</span>
                        </span>
                        {#if isSelected}
                            <span class="absolute top-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-dark text-white flex items-center justify-center text-[10px] font-black shrink-0">✓</span>
                        {/if}
                    </label>
                {/each}
            </div>
        </fieldset>

        <!-- Selector de presentación con radios nativos -->
        <fieldset class="mt-2.5 sm:mt-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-white/15">
            <legend class="text-[10px] font-black uppercase tracking-widest text-green-light px-1">Elige la presentación de bolsa:</legend>
            <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Presentación de bolsa del plan">
                {#each presList as size}
                    {@const isSelected = planner.activePresentation === size}
                    <label class="relative cursor-pointer select-none rounded-xl border text-left p-2.5 sm:p-3 transition-all flex items-center gap-2 font-bold text-[11px] sm:text-xs min-h-[44px]
                        {isSelected ? 'bg-white/25 border-white/60 text-white' : 'border-white/20 text-white hover:bg-white/20'}">
                        <input
                            type="radio"
                            name="astro-presentacion"
                            value={size}
                            checked={isSelected}
                            onchange={() => selectPresentation(size)}
                            class="sr-only"
                        />
                        <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-full border flex items-center justify-center text-[10px] sm:text-[11px] font-black shrink-0
                            {isSelected ? 'bg-white border-white text-purple' : 'border-white/40 text-transparent'}">{isSelected ? '✓' : ''}</span>
                        <span class="leading-tight">
                            <span class="block font-black">{size.replace('gr', ' g')}</span>
                            <span class="text-[8px] sm:text-[9px] font-medium text-white/70 block">Precio: <span class="font-bold">{priceLabel(planner.activeFormula, size)}</span> c/u</span>
                        </span>
                    </label>
                {/each}
            </div>
        </fieldset>
    </div>

    <div class="mt-4 space-y-0">
        {@render planHeaders(true)}
        {#if expandedDays !== null}
            {@const plan = getPlanForDays(expandedDays)}
            {@render detailPanel(plan, expandedDays)}
        {/if}
    </div>
{/if}