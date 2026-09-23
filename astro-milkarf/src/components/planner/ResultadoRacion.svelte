<script lang="ts">
    import { planner, equivalenciaDiaria, selectPresentation, subtitleResultado, notaResultado } from '../../stores/planner.svelte';

    const eqDia = $derived(equivalenciaDiaria());
    const pesoUsado = $derived((() => {
        const raw = String(planner.pesoTxt || '').replace(',', '.');
        const p = parseFloat(raw);
        return Number.isFinite(p) && p > 0 ? p : null;
    })());

    const gradiente = $derived(
        planner.etapa === 'cachorro'
            ? 'linear-gradient(135deg,#32147a,#421d8e)'
            : planner.etapa === 'adulto'
                ? 'linear-gradient(135deg,#b81472,#d72b8f)'
                : 'linear-gradient(135deg,#849810,#b9cb25)'
    );
</script>

{#if planner.resultado}
    <div class="bg-purple-light dark:bg-[#0d0718] rounded-2xl border border-purple-border/30 dark:border-purple/20 overflow-hidden shadow-soft-lg">
        <div class="p-4 sm:p-6 text-center text-white" style={`background:${gradiente};border-radius:0`}>
            <div class="text-[9px] sm:text-[10px] font-extrabold tracking-widest uppercase mb-0.5 opacity-80">Porción orientativa para {planner.petName.trim() || 'Mascota'}</div>
            <div class="text-4xl sm:text-6xl font-black tracking-tight leading-none">{planner.resultado.gramos}</div>
            <div class="text-xs sm:text-sm font-extrabold uppercase tracking-wider opacity-70 mt-0.5">gramos al día</div>
            {#if pesoUsado}
                <div class="text-[10px] sm:text-xs font-semibold opacity-80 mt-1 sm:mt-2">{subtitleResultado(pesoUsado)}</div>
            {/if}
        </div>

        <div class="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div class="flex justify-between items-center pb-2 sm:pb-3 border-b border-purple-border/30 dark:border-purple/20 text-[11px] sm:text-sm">
                <span class="font-semibold text-purple/65 dark:text-gray-400">Energía diaria estimada (DER)</span>
                <span class="font-black text-purple dark:text-white">{planner.resultado.kcal} kcal/día</span>
            </div>
            <div class="flex justify-between items-center pb-2 sm:pb-3 border-b border-purple-border/30 dark:border-purple/20 text-[11px] sm:text-sm">
                <span class="font-semibold text-purple/65 dark:text-gray-400">Frecuencia recomendada</span>
                <span class="font-black text-purple dark:text-white">{planner.resultado.comidas} {planner.resultado.comidas === 1 ? 'vez al día' : 'veces al día'}</span>
            </div>
            <div class="flex justify-between items-center pb-2 sm:pb-3 border-b border-purple-border/30 dark:border-purple/20 text-[11px] sm:text-sm">
                <span class="font-semibold text-purple/65 dark:text-gray-400">Porción por comida</span>
                <span class="font-black text-purple dark:text-white">{planner.resultado.porComida}g</span>
            </div>

            <div>
                <span class="text-[8px] sm:text-[9px] font-black tracking-widest text-purple/60 dark:text-gray-400 uppercase block text-left mb-1.5 sm:mb-2">Equivalencia en presentaciones Milkarf (elige la del plan)</span>
                <div class="grid grid-cols-2 gap-2 sm:gap-3">
                    {#each [['250gr', eqDia?.b250], ['500gr', eqDia?.b500]] as [size, valor]}
                        {@const isSelected = planner.activePresentation === size}
                        <label class="pres-radio focus-within:ring-2 focus-within:ring-purple/60 dark:focus-within:ring-green/50 min-h-[44px]">
                            <input
                                type="radio"
                                name="astro-presentacion-racion"
                                value={size}
                                checked={isSelected}
                                onchange={() => selectPresentation(size as '250gr' | '550gr')}
                                class="sr-only"
                            />
                            <span class="block text-base sm:text-lg font-black leading-none text-purple-dark dark:text-white">{valor || '0'}</span>
                            <span class="block text-[8px] sm:text-[9px] font-bold opacity-60 uppercase mt-0.5">Presentación {size.replace('gr', ' g')}</span>
                            {#if isSelected}
                                <span class="block text-[9px] sm:text-[10px] font-black text-green-dark dark:text-green mt-0.5">✓ Elegida para el plan</span>
                            {/if}
                        </label>
                    {/each}
                </div>
            </div>

            <div class="bg-green-light dark:bg-green/10 border-l-4 border-green text-[9px] sm:text-[10px] leading-relaxed text-purple-dark/85 dark:text-gray-300 font-medium p-3 sm:p-4 rounded-r-xl text-left">
                {notaResultado()}
            </div>
        </div>
    </div>

    <div class="mt-3 sm:mt-4 bg-gradient-to-br from-purple-dark via-[#351675] to-purple rounded-2xl p-4 sm:p-5 text-white shadow-soft-lg border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div class="text-left">
            <div class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-green mb-0.5">Paso 3</div>
            <h3 class="text-sm sm:text-lg font-black tracking-tight">Configura su fórmula, presentación y duración</h3>
            <p class="text-[10px] sm:text-xs text-white/80 font-medium mt-0.5">Las bolsas se calculan redondeando hacia arriba para cubrir la porción sin faltantes.</p>
        </div>
        <button type="button" onclick={() => document.getElementById('astro-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            class="shrink-0 w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-green text-purple-dark font-black text-[11px] sm:text-xs uppercase tracking-wider rounded-xl transition-all active:scale-[0.98] min-h-[44px]">
            Elegir plan ↓
        </button>
    </div>
{:else}
    <p class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium text-left">Completa los datos y presiona "Calcular porción" para ver el resultado orientativo.</p>
{/if}