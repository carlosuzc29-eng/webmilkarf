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
        <div class="p-6 text-center text-white" style={`background:${gradiente};border-radius:0`}>
            <div class="text-[10px] font-extrabold tracking-widest uppercase mb-1 opacity-80">Porción orientativa para {planner.petName.trim() || 'Mascota'}</div>
            <div class="text-6xl font-black tracking-tight">{planner.resultado.gramos}</div>
            <div class="text-sm font-extrabold uppercase tracking-wider opacity-70 mt-1">gramos al día</div>
            {#if pesoUsado}
                <div class="text-xs font-semibold opacity-80 mt-2">{subtitleResultado(pesoUsado)}</div>
            {/if}
        </div>

        <div class="p-6 space-y-4">
            <div class="flex justify-between items-center pb-3 border-b border-purple-border/30 dark:border-purple/20 text-xs md:text-sm">
                <span class="font-semibold text-purple/65 dark:text-gray-400">Energía diaria estimada (DER)</span>
                <span class="font-black text-purple dark:text-white">{planner.resultado.kcal} kcal/día</span>
            </div>
            <div class="flex justify-between items-center pb-3 border-b border-purple-border/30 dark:border-purple/20 text-xs md:text-sm">
                <span class="font-semibold text-purple/65 dark:text-gray-400">Frecuencia recomendada</span>
                <span class="font-black text-purple dark:text-white">{planner.resultado.comidas} {planner.resultado.comidas === 1 ? 'vez al día' : 'veces al día'}</span>
            </div>
            <div class="flex justify-between items-center pb-3 border-b border-purple-border/30 dark:border-purple/20 text-xs md:text-sm">
                <span class="font-semibold text-purple/65 dark:text-gray-400">Porción por comida</span>
                <span class="font-black text-purple dark:text-white">{planner.resultado.porComida}g</span>
            </div>

            <div>
                <span class="text-[9px] font-black tracking-widest text-purple/60 dark:text-gray-400 uppercase block text-left mb-2">Equivalencia en presentaciones Milkarf (elige la del plan)</span>
                <div class="grid grid-cols-2 gap-3">
                    {#each [['250gr', eqDia?.b250], ['500gr', eqDia?.b500]] as [size, valor]}
                        <button
                            type="button"
                            aria-pressed={planner.activePresentation === size}
                            onclick={() => selectPresentation(size as '250gr' | '500gr')}
                            class="pres-radio"
                        >
                            <span class="block text-lg font-black">{valor || '0'}</span>
                            <span class="block text-[9px] font-bold opacity-60 uppercase mt-1">Presentación {size.replace('gr', ' g')}</span>
                            {#if planner.activePresentation === size}
                                <span class="block text-[10px] font-black text-green dark:text-green mt-1">✓ Elegida para el plan</span>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>

            {#if planner.equivalencia}
                <div class="bg-green/10 dark:bg-green/5 rounded-2xl p-4 space-y-3 border border-green/20 dark:border-green/10">
                    <div class="text-[9px] font-black tracking-widest text-green-dark dark:text-green uppercase flex items-center gap-2">📅 Estimación mensual de consumo</div>
                    <div class="grid grid-cols-2 gap-2 text-left">
                        <div class="bg-white dark:bg-darkcard rounded-xl p-3 shadow-sm border border-green/10">
                            <span class="text-[9px] font-bold text-purple/40 dark:text-gray-500 uppercase block leading-tight mb-1">Kilos al mes</span>
                            <span class="text-base font-black text-purple-dark dark:text-white leading-none">{planner.equivalencia.kilosMes}</span>
                        </div>
                        <div class="bg-white dark:bg-darkcard rounded-xl p-3 shadow-sm border border-green/10">
                            <span class="text-[9px] font-bold text-purple/40 dark:text-gray-500 uppercase block leading-tight mb-1">Porciones al mes</span>
                            <span class="text-base font-black text-purple-dark dark:text-white leading-none">{planner.equivalencia.porcionesMes}</span>
                        </div>
                    </div>
                    <div class="text-[8px] font-black tracking-widest text-purple/40 dark:text-gray-500 uppercase">Presentaciones estimadas para 30 días:</div>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-white dark:bg-darkcard rounded-xl p-2 text-center shadow-sm border border-green/10">
                            <div class="text-sm font-black text-purple dark:text-white leading-none">{planner.equivalencia.bolsas250Mes}</div>
                            <div class="text-[7px] font-bold text-purple/45 dark:text-gray-500 uppercase mt-1 leading-tight">De 250 g</div>
                        </div>
                        <div class="bg-white dark:bg-darkcard rounded-xl p-2 text-center shadow-sm border border-green/10">
                            <div class="text-sm font-black text-purple dark:text-white leading-none">{planner.equivalencia.bolsas500Mes}</div>
                            <div class="text-[7px] font-bold text-purple/45 dark:text-gray-500 uppercase mt-1 leading-tight">De 500 g</div>
                        </div>
                    </div>
                </div>
            {/if}

            <div class="bg-green-light dark:bg-green/10 border-l-4 border-green text-[10px] leading-relaxed text-purple-dark/85 dark:text-gray-300 font-medium p-4 rounded-r-xl text-left">
                {notaResultado()}
            </div>
        </div>
    </div>

    <div class="mt-4 bg-gradient-to-br from-purple-dark via-[#351675] to-purple rounded-2xl p-5 text-white shadow-soft-lg border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="text-left">
            <div class="text-[10px] font-black uppercase tracking-widest text-green mb-1">Paso 3</div>
            <h3 class="text-lg font-black tracking-tight">Configura su fórmula, presentación y duración</h3>
            <p class="text-xs text-white/80 font-medium mt-1">Las bolsas se calculan redondeando hacia arriba para cubrir la porción sin faltantes.</p>
        </div>
        <button type="button" onclick={() => document.getElementById('astro-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            class="shrink-0 px-5 py-3 bg-green text-purple-dark font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-[0.98]">
            Elegir plan ↓
        </button>
    </div>
{:else}
    <p class="text-xs text-gray-500 dark:text-gray-400 font-medium text-left">Completa los datos y presiona "Calcular porción" para ver el resultado orientativo.</p>
{/if}