<script lang="ts">
    import { planner, etapas, edadesCachorro, setPetName, selectEtapa, selectCachorroEdad, setPeso, stepPeso } from '../../stores/planner.svelte';

    let pesoRef: HTMLInputElement;
</script>

<!-- PASO 1: Nombre -->
<div>
    <div class="text-xs font-semibold text-purple/70 dark:text-gray-300 tracking-wider uppercase mb-2.5 flex items-center gap-2 text-left">
        <span class="w-5 h-5 bg-purple dark:bg-green dark:text-darkbg text-white text-[10px] font-bold rounded-full flex items-center justify-center">1</span> Nombre de tu perro
    </div>
    <input
        type="text"
        id="astro-calc-nombre"
        autocomplete="off"
        autocapitalize="words"
        placeholder="Ej. Bruno"
        value={planner.petName}
        oninput={(e) => setPetName(e.currentTarget.value)}
        class="w-full bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-xl p-3.5 text-base font-bold text-purple dark:text-white outline-none focus:border-purple transition-all text-center"
    />
</div>

<!-- PASO 2: Etapa -->
<div>
    <div class="text-xs font-semibold text-purple/70 dark:text-gray-300 tracking-wider uppercase mb-2.5 flex items-center gap-2 text-left">
        <span class="w-5 h-5 bg-purple dark:bg-green dark:text-darkbg text-white text-[10px] font-bold rounded-full flex items-center justify-center">2</span> Etapa de vida
    </div>
    <div class="flex gap-2 w-full" role="radiogroup" aria-label="Etapa de vida">
        {#each etapas as e}
            <button
                type="button"
                role="radio"
                aria-checked={planner.etapa === e.value}
                aria-pressed={planner.etapa === e.value}
                onclick={() => selectEtapa(e.value)}
                class="opt-btn flex-1"
            >
                {e.emoji} {e.label}<br /><span class="text-[9px] font-semibold opacity-60">{e.sub}</span>
            </button>
        {/each}
    </div>

    {#if planner.etapa === 'cachorro'}
        <div class="mt-4 text-left">
            <div class="text-xs font-semibold text-purple/70 dark:text-gray-300 tracking-wider uppercase mb-2 flex items-center gap-2">
                <span class="w-5 h-5 bg-green text-purple-dark text-[10px] font-bold rounded-full flex items-center justify-center">↳</span> Edad del cachorro
            </div>
            <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Edad del cachorro">
                {#each edadesCachorro as m}
                    <button
                        type="button"
                        role="radio"
                        aria-checked={planner.cachorroEdad === m}
                        aria-pressed={planner.cachorroEdad === m}
                        onclick={() => selectCachorroEdad(m)}
                        class="opt-btn text-left"
                    >
                        {m} meses
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>

<!-- PASO 3: Peso -->
<div>
    <div class="text-xs font-semibold text-purple/70 dark:text-gray-300 tracking-wider uppercase mb-2.5 flex items-center gap-2 text-left">
        <span class="w-5 h-5 bg-purple dark:bg-green dark:text-darkbg text-white text-[10px] font-bold rounded-full flex items-center justify-center">3</span> Peso actual
    </div>
    <div class="flex items-center gap-3">
        <input
            type="text"
            inputmode="decimal"
            id="astro-pesoInput"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            pattern="[0-9]+([\.,][0-9]+)?"
            placeholder="0"
            bind:this={pesoRef}
            value={planner.pesoTxt}
            oninput={(e) => setPeso(e.currentTarget.value)}
            aria-label="Peso actual en kilogramos"
            class="flex-1 w-full min-w-0 p-3.5 rounded-xl bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 text-xl font-bold text-purple dark:text-white outline-none focus:border-purple transition-all text-center"
        />
        <span class="text-base font-bold text-purple/50 dark:text-gray-400 uppercase shrink-0">kg</span>
    </div>
    <div class="flex gap-2 mt-2.5">
        <button type="button" onclick={() => stepPeso(-1)} aria-label="Restar 1 kg" class="flex-1 bg-white dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 hover:border-purple text-purple dark:text-white font-bold p-2 rounded-xl transition-all text-base shadow-sm hover:bg-purple/5">−</button>
        <button type="button" onclick={() => stepPeso(+1)} aria-label="Sumar 1 kg" class="flex-1 bg-white dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 hover:border-purple text-purple dark:text-white font-bold p-2 rounded-xl transition-all text-base shadow-sm hover:bg-purple/5">+</button>
    </div>
</div>