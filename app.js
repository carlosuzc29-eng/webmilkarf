import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, linkWithCredential, EmailAuthProvider, signOut, signInWithCustomToken, signInAnonymously, setPersistence, browserLocalPersistence, updateProfile, sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, getDocs, serverTimestamp, onSnapshot, deleteDoc, query, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        // =========================================================================================
// CONFIGURACIÓN FIREBASE
// =========================================================================================
const manualConfig = {
    apiKey: "AIzaSyAeojblQAbiM6mo6H6KsNNdJE_00LQIKTE",
    authDomain: "milkarf-app.firebaseapp.com",
    projectId: "milkarf-app",
    storageBucket: "milkarf-app.firebasestorage.app",
    messagingSenderId: "679165501514",
    appId: "1:679165501514:web:4f43bf63d6945f9c9806b3"
};

const configToUse = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : manualConfig;
let db = null;
let auth = null;
let appId = typeof __app_id !== 'undefined' ? __app_id : 'milkarf-app';
const ADMIN_EMAILS = [
    'milkarffood@gmail.com',
    'carlosauv11@gmail.com'
];
window.ADMIN_EMAILS = ADMIN_EMAILS;

window.checkIsAdminDynamic = async function (email) {
    if (!email) return false;
    if (ADMIN_EMAILS.includes(email)) return true;
    if (!db) return false;
    try {
        const adminDoc = typeof __firebase_config !== 'undefined'
            ? await getDoc(doc(db, 'artifacts', appId, 'admins', email))
            : await getDoc(doc(db, 'admins', email));
        if (adminDoc.exists()) return true;
    } catch (e) {
        console.warn('Error verificando admin dinámico en Firestore:', e);
    }
    return false;
};

window.loadDynamicStoreConfig = async function () {
    if (!db) return;
    try {
        const configDocRef = typeof __firebase_config !== 'undefined'
            ? doc(db, 'artifacts', appId, 'config', 'tienda')
            : doc(db, 'config', 'tienda');
        const snap = await getDoc(configDocRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.PRICES_POLLO) window.PRICES_POLLO = data.PRICES_POLLO;
            if (data.PRICES_RES) window.PRICES_RES = data.PRICES_RES;
            if (Array.isArray(data.REDEEM_ITEMS)) window.REDEEM_ITEMS = data.REDEEM_ITEMS;
            
            const pricePollo = document.getElementById('price-pollo');
            if (pricePollo && window.PRICES_POLLO && window.PRICES_POLLO[window.currentWeightPollo]) {
                pricePollo.textContent = window.PRICES_POLLO[window.currentWeightPollo];
            }
            const priceRes = document.getElementById('price-res');
            if (priceRes && window.PRICES_RES && window.PRICES_RES[window.currentWeightRes]) {
                priceRes.textContent = window.PRICES_RES[window.currentWeightRes];
            }
            if (typeof window.renderCanjesCatalog === 'function') {
                window.renderCanjesCatalog();
            }
        }
    } catch (error) {
        console.warn('No se pudo cargar config dinámica de tienda (usando fallback estático):', error);
    }
};

if (configToUse.apiKey) {
    const app = initializeApp(configToUse);
    db = getFirestore(app);
    auth = getAuth(app);
    window.loadDynamicStoreConfig?.();
    setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.warn('No se pudo fijar persistencia local de sesión:', error);
    });

    const initEnvAuth = async () => {
        try {
            await signInAnonymously(auth);
        } catch (e) { console.warn("Init auth anon error"); }
    };

    // OPTIMIZACIÓN: 1 sola lectura por sesión (no consume extra en free tier)
    onAuthStateChanged(auth, async user => {
        window.authReady = true;
        window.currentUser = user;
        window.loadDynamicStoreConfig?.();
        const userEmail = user?.email?.toLowerCase?.() || '';
        const isAdminPage = window.location.pathname.endsWith('admin.html');

        if (isAdminPage) {
            const adminView = document.getElementById('view-admin');
            const adminAuthScreen = document.getElementById('admin-auth-screen');
            const preloader = document.getElementById('preloader');
            if (preloader) { preloader.classList.add('opacity-0', 'pointer-events-none'); setTimeout(() => preloader.classList.add('hidden'), 280); }

            const isUserAdmin = user && await window.checkIsAdminDynamic(userEmail);
            if (isUserAdmin) {
                window.isAdmin = true;
                if (adminAuthScreen) adminAuthScreen.classList.add('hidden');
                if (adminView) {
                    adminView.classList.remove('hidden');
                    adminView.classList.add('active');
                }
                window.updateAdminProfileUI?.(user);
                window.cerrarModalAdmin?.();
                setTimeout(() => window.enterAdminMode?.({ navigate: false, load: true }), 50);
            } else {
                window.isAdmin = false;
                if (adminView) {
                    adminView.classList.add('hidden');
                    adminView.classList.remove('active');
                }
                if (adminAuthScreen) adminAuthScreen.classList.remove('hidden');
            }
            return;
        }

        if (user && (!user.isAnonymous || user.email)) {
            try {
                const pendingGoogle = sessionStorage.getItem('milkarf_google_redirect_pending') === '1' ||
                    localStorage.getItem('milkarf_google_login_in_progress') === '1';
                if (pendingGoogle) {
                    try { sessionStorage.removeItem('milkarf_google_redirect_pending'); } catch (e) { }
                    try { localStorage.removeItem('milkarf_google_login_in_progress'); } catch (e) { }
                    if (window._finishGoogleLoginProcessing !== user.uid) {
                        setTimeout(() => window.finishGoogleLogin?.(user), 50);
                    }
                }
            } catch (error) { }
        }

        if (user && db && (!user.isAnonymous || user.email)) {
            // En index.html, un administrador navega de forma normal como cliente
            window.isAdmin = false;
            window.currentUser = user;
            if (!window.currentUser.data) {
                window.currentUser.data = { puntos: 0, puntos_historicos: 0, mascotas: [] };
            }

            const mainNav = document.getElementById('main-nav-links');
            const adminNav = document.getElementById('admin-nav-links');
            const topAuth = document.getElementById('top-auth-btn-wrap');
            if (mainNav) mainNav.classList.remove('hidden');
            if (adminNav) adminNav.classList.add('hidden');
            if (topAuth) topAuth.style.display = 'block';
            window.actualizarUIAuth();

            try {
                if (window._loadedProfileUid === user.uid && window.currentUser?.data?.puntos !== undefined) {
                    if (window.currentUser.data.descuento_usado) window.descuentoAplicado = false;
                    window.syncCartOnLogin?.(window.currentUser.data);
                } else {
                    const userRef = typeof __firebase_config !== 'undefined'
                        ? doc(db, 'artifacts', appId, 'users', user.uid)
                        : doc(db, 'usuarios', user.uid);

                    const docSnap = await getDoc(userRef);
                    if (docSnap.exists()) {
                        let data = docSnap.data();
                        // Fix legacy data sin arrays
                        if (data.mascota_nombre && !data.mascotas) {
                            data.mascotas = [{
                                id: Date.now().toString(),
                                tipo: data.mascota_tipo || 'perro',
                                nombre: data.mascota_nombre,
                                edad: data.mascota_edad || '',
                                peso: data.mascota_peso || '',
                                raza: data.mascota_raza || 'Mestizo',
                                cumple: ''
                            }];
                            setDoc(userRef, { mascotas: data.mascotas }, { merge: true });
                        }
                        // Init hist points if missing
                        data.puntos_historicos = data.puntos_historicos || data.puntos || 0;
                        window.currentUser = user;
                        window.currentUser.data = data;
                        window._loadedProfileUid = user.uid;
                        if (data.descuento_usado) window.descuentoAplicado = false;
                        window.syncCartOnLogin?.(data);
                    } else {
                        window.currentUser = user;
                        window.currentUser.data = { puntos: 0, puntos_historicos: 0, mascotas: [] };
                        window._loadedProfileUid = user.uid;
                        window.saveCartToStorage?.();
                    }
                    window.actualizarUIAuth();
                }
            } catch (e) { console.warn(e); }
            return;
        }

        if (!user) {
            window.isAdmin = false;
            const mainNav = document.getElementById('main-nav-links');
            const adminNav = document.getElementById('admin-nav-links');
            const topAuth = document.getElementById('top-auth-btn-wrap');
            if (mainNav) mainNav.classList.remove('hidden');
            if (adminNav) adminNav.classList.add('hidden');
            if (topAuth) topAuth.style.display = 'block';

            let isPendingGoogle = false;
            try {
                isPendingGoogle = sessionStorage.getItem('milkarf_google_redirect_pending') === '1' ||
                    localStorage.getItem('milkarf_google_login_in_progress') === '1';
            } catch (e) { }

            if (!isPendingGoogle) {
                initEnvAuth();
            } else {
                // Hay un login de Google en progreso — no iniciar sesión anónima.
                // Limpiar banderas después de un tiempo prudente si no se completó.
                setTimeout(() => {
                    try { localStorage.removeItem('milkarf_google_login_in_progress'); } catch (e) { }
                    try { sessionStorage.removeItem('milkarf_google_redirect_pending'); } catch (e) { }
                }, 8000);
            }
        }
        window.actualizarUIAuth();
    });
}

window.getUserPath = function (uid) {
    return typeof __firebase_config !== 'undefined'
        ? doc(db, 'artifacts', appId, 'users', uid)
        : doc(db, 'usuarios', uid);
};

window.getUsersCollectionRef = function () {
    return typeof __firebase_config !== 'undefined'
        ? collection(db, 'artifacts', appId, 'users')
        : collection(db, 'usuarios');
};

window.getOrdersCollectionRef = function () {
    return typeof __firebase_config !== 'undefined'
        ? collection(db, 'artifacts', appId, 'public', 'data', 'pedidos')
        : collection(db, 'pedidos');
};

window.getOrderDocRef = function (orderId) {
    return typeof __firebase_config !== 'undefined'
        ? doc(db, 'artifacts', appId, 'public', 'data', 'pedidos', orderId)
        : doc(db, 'pedidos', orderId);
};

window.getRedeemsCollectionRef = function () {
    return typeof __firebase_config !== 'undefined'
        ? collection(db, 'artifacts', appId, 'public', 'data', 'canjes')
        : collection(db, 'canjes');
};

window.getSecureCollectionRef = function (name) {
    return typeof __firebase_config !== 'undefined'
        ? collection(db, 'artifacts', appId, name)
        : collection(db, name);
};

// =========================================================================================
// CONSULTAS FIRESTORE SEGURAS (compatibles con reglas cerradas)
// =========================================================================================
window.ADMIN_QUERY_LIMIT = 50;
window.USER_QUERY_LIMIT = 20;

window.secureAdminQuery = function (ref, max = window.ADMIN_QUERY_LIMIT) {
    return query(ref, limit(Math.min(Number(max) || window.ADMIN_QUERY_LIMIT, window.ADMIN_QUERY_LIMIT)));
};

window.secureUserQuery = function (ref, uid, max = window.USER_QUERY_LIMIT) {
    return query(ref, where('uid', '==', uid), limit(Math.min(Number(max) || window.USER_QUERY_LIMIT, window.USER_QUERY_LIMIT)));
};

window.getSafeAuthUid = function () {
    return auth?.currentUser?.uid || window.currentUser?.uid || null;
};

window.sanitizeClientOrderForWrite = function (order = {}) {
    const clean = { ...order };
    // Estos campos solo deben crearlos/modificarlos administradores.
    delete clean.pointsAwarded;
    delete clean.pointsGranted;
    delete clean.pointsMultiplier;
    delete clean.confirmedAt;
    delete clean.completedAt;
    delete clean.cancelledAt;
    delete clean.deliveryCost;
    delete clean.totalWithDelivery;
    delete clean.deliveryDate;
    delete clean.deliveryNoteMessage;
    delete clean.deliveryNoteSentAt;
    return clean;
};

window.normalizeUserProfileForWrite = function (data = {}) {
    const clean = { ...data };
    // Campos que el cliente no debe escribir con reglas seguras.
    delete clean.descuento_usado;
    delete clean.puntos;
    delete clean.points;
    delete clean.pointsAvailable;
    delete clean.puntosDisponibles;
    delete clean.pointsHistorical;
    delete clean.puntosHistoricos;
    delete clean.puntos_historicos;
    delete clean.level;
    delete clean.nivel;
    delete clean.pointsMultiplier;
    delete clean.fecha_actualizacion;
    clean.updatedAt = clean.updatedAt || serverTimestamp();
    return clean;
};

// =========================================================================================
// LÓGICA DE INTERFAZ Y NAVEGACIÓN
// =========================================================================================
window.WA_NUMBER = '584121791137';
window.PRICES_POLLO = { '250gr': '$2.50', '500gr': '$5.00' };
window.PRICES_RES = { '250gr': '$3.50', '500gr': '$7.00' };

window.MILKARF_CONFIG = {
    calcEngineVersion: 'v2.0_plan_based_low_activity',
    catalog: {
        pollo: {
            id: 'pollo',
            name: 'Pollo con Zanahoria',
            shortName: 'Pollo',
            emoji: '🍗',
            available: true,
            presentations: [
                { size: '250gr', grams: 250, price: 2.50, available: true },
                { size: '500gr', grams: 500, price: 5.00, available: true }
            ]
        },
        res: {
            id: 'res',
            name: 'Carne de Res con Calabacín',
            shortName: 'Res',
            emoji: '🥩',
            available: true,
            presentations: [
                { size: '250gr', grams: 250, price: 3.50, available: true },
                { size: '500gr', grams: 500, price: 7.00, available: true }
            ]
        }
    },
    planDiscounts: {
        7: { days: 7, label: 'Plan semanal', discountPct: 0.05, tag: '7 días de alimentación' },
        15: { days: 15, label: 'Plan quincenal', discountPct: 0.075, tag: '15 días de alimentación' },
        30: { days: 30, label: 'Plan mensual', discountPct: 0.10, tag: 'Mayor ahorro' }
    },
    welcomeDiscountPct: 0.20
};

// Algoritmo de optimización de bolsas para fórmula individual
window.optimizeBagsSingle = function (formula, requiredGrams) {
    const prod = window.MILKARF_CONFIG.catalog[formula];
    if (!prod || !prod.available) throw new Error(`Fórmula ${formula} no disponible.`);
    const activePres = prod.presentations.filter(p => p.available);
    if (!activePres.length) throw new Error(`No hay presentaciones activas para ${formula}`);

    const pres = [...activePres].sort((a, b) => b.grams - a.grams);
    const validCombinations = [];

    if (pres.length === 2) {
        const [p1, p2] = pres;
        const maxP1 = Math.ceil(requiredGrams / p1.grams) + 1;
        for (let c1 = 0; c1 <= maxP1; c1++) {
            const rem = Math.max(0, requiredGrams - (c1 * p1.grams));
            const c2 = Math.ceil(rem / p2.grams);
            const totalGrams = (c1 * p1.grams) + (c2 * p2.grams);
            if (totalGrams >= requiredGrams) {
                validCombinations.push({
                    bags: [
                        ...(c1 > 0 ? [{ formula, formulaName: prod.name, size: p1.size, weight: p1.size, grams: p1.grams, qty: c1, unitPrice: p1.price }] : []),
                        ...(c2 > 0 ? [{ formula, formulaName: prod.name, size: p2.size, weight: p2.size, grams: p2.grams, qty: c2, unitPrice: p2.price }] : [])
                    ],
                    totalGrams,
                    surplus: totalGrams - requiredGrams,
                    cost: (c1 * p1.price) + (c2 * p2.price),
                    totalBags: c1 + c2
                });
            }
        }
    } else {
        function search(idx, currentGrams, currentCost, currentBags) {
            if (idx === pres.length) {
                if (currentGrams >= requiredGrams) {
                    validCombinations.push({
                        bags: currentBags.filter(b => b.qty > 0),
                        totalGrams: currentGrams,
                        surplus: currentGrams - requiredGrams,
                        cost: currentCost,
                        totalBags: currentBags.reduce((s, b) => s + b.qty, 0)
                    });
                }
                return;
            }
            const p = pres[idx];
            const maxNeeded = Math.ceil(Math.max(0, requiredGrams - currentGrams) / p.grams) + 1;
            for (let q = 0; q <= maxNeeded; q++) {
                currentBags.push({ formula, formulaName: prod.name, size: p.size, weight: p.size, grams: p.grams, qty: q, unitPrice: p.price });
                search(idx + 1, currentGrams + (q * p.grams), currentCost + (q * p.price), currentBags);
                currentBags.pop();
            }
        }
        search(0, 0, 0, []);
    }

    if (!validCombinations.length) throw new Error("No se pudo generar combinación de bolsas.");

    validCombinations.sort((a, b) => {
        if (a.surplus !== b.surplus) return a.surplus - b.surplus;
        if (Math.abs(a.cost - b.cost) > 0.001) return a.cost - b.cost;
        return a.totalBags - b.totalBags;
    });

    return validCombinations[0];
};

// Algoritmo de optimización de bolsas para fórmula mixta (Pollo + Res ~50/50 minimizando excedente)
window.optimizeBagsMixed = function (requiredGrams) {
    const polloProd = window.MILKARF_CONFIG.catalog.pollo;
    const resProd = window.MILKARF_CONFIG.catalog.res;

    function getBestBagsForGrams(formula, targetGrams) {
        const prod = window.MILKARF_CONFIG.catalog[formula];
        const [p1, p2] = prod.presentations.sort((a, b) => b.grams - a.grams);
        const combos = [];
        const maxP1 = Math.floor(targetGrams / p1.grams);
        for (let c1 = 0; c1 <= maxP1; c1++) {
            const rem = targetGrams - (c1 * p1.grams);
            if (rem % p2.grams === 0) {
                const c2 = rem / p2.grams;
                combos.push({
                    bags: [
                        ...(c1 > 0 ? [{ formula, formulaName: prod.name, size: p1.size, weight: p1.size, grams: p1.grams, qty: c1, unitPrice: p1.price }] : []),
                        ...(c2 > 0 ? [{ formula, formulaName: prod.name, size: p2.size, weight: p2.size, grams: p2.grams, qty: c2, unitPrice: p2.price }] : [])
                    ],
                    totalGrams: targetGrams,
                    cost: (c1 * p1.price) + (c2 * p2.price),
                    totalBags: c1 + c2
                });
            }
        }
        combos.sort((a, b) => {
            if (Math.abs(a.cost - b.cost) > 0.001) return a.cost - b.cost;
            return a.totalBags - b.totalBags;
        });
        return combos[0] || null;
    }

    const validMixed = [];
    const minGrams = Math.min(250, requiredGrams);
    for (let gPollo = 250; gPollo <= requiredGrams; gPollo += 250) {
        const minGRes = Math.max(250, Math.ceil((requiredGrams - gPollo) / 250) * 250);
        for (let gRes = minGRes; gRes <= minGRes + 500; gRes += 250) {
            const totalGrams = gPollo + gRes;
            if (totalGrams >= requiredGrams) {
                const polloOpt = getBestBagsForGrams('pollo', gPollo);
                const resOpt = getBestBagsForGrams('res', gRes);
                if (polloOpt && resOpt) {
                    const surplus = totalGrams - requiredGrams;
                    const diffFromHalf = Math.abs(gPollo - gRes);
                    const cost = polloOpt.cost + resOpt.cost;
                    const totalBags = polloOpt.totalBags + resOpt.totalBags;
                    validMixed.push({
                        bags: [...polloOpt.bags, ...resOpt.bags],
                        totalGrams,
                        surplus,
                        diffFromHalf,
                        cost,
                        totalBags,
                        split: {
                            polloGrams: gPollo,
                            resGrams: gRes,
                            polloPct: Math.round((gPollo / totalGrams) * 100),
                            resPct: Math.round((gRes / totalGrams) * 100)
                        }
                    });
                }
            }
        }
    }

    if (!validMixed.length) throw new Error("No se pudo generar combinación mixta.");

    validMixed.sort((a, b) => {
        if (a.surplus !== b.surplus) return a.surplus - b.surplus;
        if (a.diffFromHalf !== b.diffFromHalf) return a.diffFromHalf - b.diffFromHalf;
        if (Math.abs(a.cost - b.cost) > 0.001) return a.cost - b.cost;
        return a.totalBags - b.totalBags;
    });

    return validMixed[0];
};

window.recommendPresentation = function (dailyGrams, formula = 'pollo') {
    const dG = Math.max(0, Number(dailyGrams) || 0);
    const recSize = (dG > 0 && dG <= 250) ? '250gr' : '500gr';
    const pres = window.getPresentationBySize(formula, recSize);
    const available = !!(pres && (window.MILKARF_CONFIG?.catalog?.[formula]?.available !== false));
    return {
        size: recSize,
        grams: recSize === '250gr' ? 250 : 500,
        label: recSize === '250gr' ? '250 g' : '500 g',
        available,
        price: pres ? pres.price : (recSize === '250gr' ? 2.50 : 5.00),
        reason: 'La elegimos según su porción diaria y el tiempo de conservación después de abrirla.'
    };
};

window.calculatePlanConsumption = function (dailyGrams, days, formula = 'pollo', presentationSize = null, mealSchedule = null) {
    const pts = Math.max(1, Number(days) || 7);
    const dG = Math.max(0, Number(dailyGrams) || 0);
    const requiredGrams = Math.round(dG * pts);

    const rec = window.recommendPresentation(dG, formula);
    const bagSize = presentationSize || rec.size;
    const bagGrams = bagSize === '250gr' ? 250 : 500;

    let totalBags = 0;
    let bags = [];
    let split = null;
    let totalGramsProvided = 0;
    let discardedSurplusGrams = 0;
    let usableRemainingGrams = 0;
    let subtotalCost = 0;
    let basisText = 'Estimación con apertura diaria; puede generar sobrantes';

    if (formula === 'mixto') {
        const polloDailyGrams = Math.round((dG / 2) * 10) / 10;
        const resDailyGrams = Math.round((dG - polloDailyGrams) * 10) / 10;

        const polloPres = window.getPresentationBySize('pollo', bagSize);
        const resPres = window.getPresentationBySize('res', bagSize);

        if (!polloPres || !resPres) {
            throw new Error('Configuración pendiente para plan mixto: falta presentación en catálogo.');
        }

        const polloBagsPerDay = polloDailyGrams > 0 ? Math.ceil(polloDailyGrams / bagGrams) : 0;
        const resBagsPerDay = resDailyGrams > 0 ? Math.ceil(resDailyGrams / bagGrams) : 0;

        const polloBagsCount = polloBagsPerDay * pts;
        const resBagsCount = resBagsPerDay * pts;

        const totalPolloGrams = polloBagsCount * bagGrams;
        const totalResGrams = resBagsCount * bagGrams;

        const requiredPolloGrams = Math.round(polloDailyGrams * pts);
        const requiredResGrams = Math.round(resDailyGrams * pts);

        const discardedPollo = Math.max(0, totalPolloGrams - requiredPolloGrams);
        const discardedRes = Math.max(0, totalResGrams - requiredResGrams);

        totalBags = polloBagsCount + resBagsCount;
        totalGramsProvided = totalPolloGrams + totalResGrams;
        discardedSurplusGrams = discardedPollo + discardedRes;
        usableRemainingGrams = 0;

        subtotalCost = (polloBagsCount * polloPres.price) + (resBagsCount * resPres.price);

        if (polloBagsCount > 0) {
            bags.push({
                formula: 'pollo',
                formulaName: window.MILKARF_CONFIG?.catalog?.pollo?.name || 'Pollo con Zanahoria',
                size: bagSize,
                weight: bagSize,
                grams: bagGrams,
                qty: polloBagsCount,
                unitPrice: polloPres.price
            });
        }
        if (resBagsCount > 0) {
            bags.push({
                formula: 'res',
                formulaName: window.MILKARF_CONFIG?.catalog?.res?.name || 'Carne de Res con Calabacín',
                size: bagSize,
                weight: bagSize,
                grams: bagGrams,
                qty: resBagsCount,
                unitPrice: resPres.price
            });
        }

        const polloPct = totalGramsProvided > 0 ? Math.round((totalPolloGrams / totalGramsProvided) * 100) : 50;
        const resPct = 100 - polloPct;
        split = { polloGrams: requiredPolloGrams, resGrams: requiredResGrams, polloPct, resPct };
    } else {
        const pres = window.getPresentationBySize(formula, bagSize);
        const unitPrice = pres ? pres.price : (bagSize === '250gr' ? 2.50 : 5.00);

        if (mealSchedule && Array.isArray(mealSchedule) && mealSchedule.length > 0) {
            basisText = 'Simulación basada en pauta de comidas (conservación 24h)';
            let openBags = [];
            let discarded = 0;
            let totalBagsOpened = 0;

            for (const event of mealSchedule) {
                let toEat = event.grams;
                const currentTime = event.time;

                for (const openBag of openBags) {
                    if (openBag.remainingGrams > 0) {
                        if (currentTime - openBag.openTime <= 24 * 3600 * 1000) {
                            const take = Math.min(toEat, openBag.remainingGrams);
                            openBag.remainingGrams -= take;
                            toEat -= take;
                        } else {
                            discarded += openBag.remainingGrams;
                            openBag.remainingGrams = 0;
                        }
                    }
                    if (toEat <= 0) break;
                }

                while (toEat > 0) {
                    totalBagsOpened++;
                    const newBag = { openTime: currentTime, remainingGrams: bagGrams };
                    const take = Math.min(toEat, bagGrams);
                    newBag.remainingGrams -= take;
                    toEat -= take;
                    openBags.push(newBag);
                }
            }

            const endTime = mealSchedule[mealSchedule.length - 1]?.time || 0;
            let usableRem = 0;
            for (const openBag of openBags) {
                if (openBag.remainingGrams > 0) {
                    if (endTime - openBag.openTime <= 24 * 3600 * 1000) {
                        usableRem += openBag.remainingGrams;
                    } else {
                        discarded += openBag.remainingGrams;
                    }
                }
            }

            totalBags = totalBagsOpened;
            totalGramsProvided = totalBags * bagGrams;
            discardedSurplusGrams = discarded;
            usableRemainingGrams = usableRem;
            subtotalCost = totalBags * unitPrice;
        } else {
            const bagsPerDay = dG > 0 ? Math.ceil(dG / bagGrams) : 0;
            totalBags = bagsPerDay * pts;
            totalGramsProvided = totalBags * bagGrams;
            discardedSurplusGrams = Math.max(0, totalGramsProvided - requiredGrams);
            usableRemainingGrams = 0;
            subtotalCost = totalBags * unitPrice;
        }

        if (totalBags > 0) {
            bags.push({
                formula,
                formulaName: window.MILKARF_CONFIG?.catalog?.[formula]?.name || formula,
                size: bagSize,
                weight: bagSize,
                grams: bagGrams,
                qty: totalBags,
                unitPrice
            });
        }
    }

    const calculatedProvided = requiredGrams + discardedSurplusGrams + usableRemainingGrams;
    if (calculatedProvided !== totalGramsProvided) {
        discardedSurplusGrams = Math.max(0, totalGramsProvided - requiredGrams - usableRemainingGrams);
    }

    const discountInfo = window.MILKARF_CONFIG?.planDiscounts?.[pts] || { discountPct: pts === 7 ? 0.05 : (pts === 15 ? 0.075 : 0.10), label: `Plan ${pts} días`, tag: `${pts} días de alimentación` };
    const subtotal = Math.round(subtotalCost * 100) / 100;
    const discountAmount = Math.round(subtotal * (Number(discountInfo.discountPct) || 0) * 100) / 100;
    const finalPrice = Math.round((subtotal - discountAmount) * 100) / 100;
    const costPerDay = pts > 0 ? Math.round((finalPrice / pts) * 100) / 100 : 0;

    return {
        requiredGrams,
        totalGrams: totalGramsProvided,
        totalGramsProvided,
        surplusGrams: discardedSurplusGrams,
        discardedSurplusGrams,
        usableRemainingGrams,
        totalBags,
        bagsCount: totalBags,
        includedGrams: totalGramsProvided,
        bags,
        split,
        subtotal,
        originalSubtotal: subtotal,
        discountInfo,
        discountPct: discountInfo.discountPct || 0,
        discountPercent: Math.round((discountInfo.discountPct || 0) * 100),
        discountAmount,
        finalPrice,
        costPerDay,
        presentation: (bags[0] && bags[0].size) || String(bagSize || '500gr'),
        recommendedPresentation: rec.size,
        presentationGrams: bagGrams,
        presentationPrice: bags[0]?.unitPrice || (bagSize === '250gr' ? 2.50 : 5.00),
        basisText,
        wasteExplanation: discardedSurplusGrams > 0 ? 'La estimación considera la conservación de 24 horas tras abrir cada bolsa, descartando el sobrante no consumido a tiempo.' : ''
    };
};

window.getPresentationBySize = function (formula, bagSize) {
    const prod = window.MILKARF_CONFIG?.catalog?.[formula];
    if (!prod) return null;
    const list = prod.presentations || [];
    return list.find(p => p.size === bagSize) || list.find(p => p.available) || list[0] || null;
};

window.computePlanPricing = function (dailyGrams, days, formula, bagSize = null) {
    const pts = Number(days) > 0 ? Number(days) : 7;
    const dG = Math.max(0, Number(dailyGrams) || 0);
    const targetSize = bagSize || window.recommendPresentation(dG, formula).size;
    return window.calculatePlanConsumption(dG, pts, formula, targetSize);
};

window.buildFeedingPlan = function (dailyGrams, days, formula, petName = '', bagSize = null) {
    const pts = Number(days) || 7;
    const dG = Math.max(0, Number(dailyGrams) || 0);
    const targetSize = bagSize || window.recommendPresentation(dG, formula).size;
    const pricing = window.calculatePlanConsumption(dG, pts, formula, targetSize);
    const discountInfo = pricing.discountInfo;

    const formulaLabel = formula === 'pollo' ? 'Pollo con Zanahoria' : (formula === 'res' ? 'Carne de Res con Calabacín' : 'Plan Mixto (Pollo y Res)');

    return {
        id: 'plan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        petName: petName || window.state.nombreMascota || 'Tu perro',
        petWeight: window.lastCalcResult?.peso || null,
        petId: window.state.petId || null,
        calcVersion: window.MILKARF_CONFIG?.calcEngineVersion || '2.0.0',
        days: pts,
        durationDays: pts,
        label: discountInfo.label,
        tag: discountInfo.tag,
        formula,
        formulaLabel,
        formulaName: formulaLabel,
        dailyGrams: dG,
        requiredGrams: pricing.requiredGrams,
        totalGramsRequired: pricing.requiredGrams,
        requiredKg: (pricing.requiredGrams / 1000).toFixed(2),
        includedGrams: pricing.totalGramsProvided,
        totalGramsProvided: pricing.totalGramsProvided,
        includedKg: (pricing.totalGramsProvided / 1000).toFixed(2),
        surplusGrams: pricing.discardedSurplusGrams,
        discardedSurplusGrams: pricing.discardedSurplusGrams,
        usableRemainingGrams: pricing.usableRemainingGrams,
        surplusKg: (pricing.discardedSurplusGrams / 1000).toFixed(2),
        bags: pricing.bags,
        split: pricing.split || null,
        presentation: pricing.presentation,
        recommendedPresentation: pricing.recommendedPresentation,
        presentationGrams: pricing.presentationGrams,
        presentationPrice: pricing.presentationPrice,
        bagsCount: pricing.totalBags,
        presentationBreakdown: {
            bagSize: pricing.presentation,
            bagGrams: pricing.presentationGrams,
            bagPrice: pricing.presentationPrice,
            bagsCount: pricing.totalBags,
            requiredGrams: pricing.requiredGrams,
            providedGrams: pricing.totalGramsProvided,
            surplusGrams: pricing.discardedSurplusGrams
        },
        originalPrice: pricing.subtotal,
        originalSubtotal: pricing.subtotal,
        discountPct: pricing.discountPct,
        discountPercent: pricing.discountPercent,
        discountAmount: pricing.discountAmount,
        finalPrice: pricing.finalPrice,
        price: pricing.finalPrice,
        savings: pricing.discountAmount,
        costPerDay: pricing.costPerDay,
        basisText: pricing.basisText,
        wasteExplanation: pricing.wasteExplanation,
        createdAt: new Date().toISOString()
    };
};

window.generateFeedingPlans = function (dailyGrams, formula = 'pollo', petName = '') {
    const recSize = window.recommendPresentation(dailyGrams, formula).size;
    return [7, 15, 30].map(days => window.buildFeedingPlan(dailyGrams, days, formula, petName, recSize));
};

window.state = { nombreMascota: '', etapa: null, cachorroEdad: null, actividad: 'bajo' };
window.activePlanFormula = 'pollo';
window.activePlanPresentation = '500gr';
window.__presentationUserTouched = false;
window.currentWeightPollo = '250gr';
window.currentWeightRes = '250gr';
window.menuOpen = false;
window.descuentoAplicado = false;
window.userLocation = null;
window.cart = [];
window.qtys = { pollo: 0, res: 0 };
window.isRegisteringPet = false;
window.editingPetIndex = null;
window.isAdmin = window.isAdmin || false;
window.authReady = window.authReady || false;
window.entryReady = window.entryReady || false;
window.welcomeModalScheduled = window.welcomeModalScheduled || false;
window.lastOrderId = null;
window.lastCalcResult = null;
window.REDEEM_ITEMS = [
    { id: 'snack-natural', name: 'Snack natural Milkarf', benefit: 'Producto de cortesía sujeto a disponibilidad', points: 100 },
    { id: 'bolsa-250-pollo', name: 'Bolsa 250g Pollo con Zanahoria', benefit: 'Producto Milkarf para canje', points: 300 },
    { id: 'bolsa-250-res', name: 'Bolsa 250g Res con Calabacín', benefit: 'Producto Milkarf para canje', points: 350 },
    { id: 'delivery-urbano', name: 'Delivery gratis urbano', benefit: 'Aplica en zonas urbanas y pedidos elegibles', points: 200 }
];
let unsubAdmin = null;
let unsubUserOrders = null;
let unsubUserRedeems = null;

window.vibrate = function (ms = 50) { if (navigator.vibrate) navigator.vibrate(ms); };

window.showToast = function (msg, type = 'error') {
    const t = document.createElement('div');
    const isError = type === 'error';
    t.className = `fixed top-10 left-1/2 -translate-x-1/2 z-[9999] ${isError ? 'bg-pink text-white' : 'bg-green text-purple-dark'} text-sm font-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 transition-all duration-300 translate-y-[-20px] opacity-0`;
    t.innerHTML = isError ? msg : `<i data-lucide="check-circle" class="w-4 h-4"></i> ${msg}`;
    document.body.appendChild(t);
    if (window.lucide) window.lucide.createIcons({ root: t });
    requestAnimationFrame(() => {
        t.classList.remove('translate-y-[-20px]', 'opacity-0');
        t.classList.add('translate-y-0', 'opacity-100');
    });
    setTimeout(() => {
        t.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => t.remove(), 300);
    }, 3500);
};

window.refreshIcons = function (root = document) {
    try {
        const iconLib = window.lucide || globalThis.lucide;
        if (iconLib && typeof iconLib.createIcons === 'function') {
            iconLib.createIcons(root === document ? undefined : { root });
        }
    } catch (error) {
        console.warn('No se pudieron refrescar los íconos Lucide:', error);
    }
};

window.hasRealUserSession = function () {
    return !!(window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email));
};

window.capitalizeName = function (value = '') {
    if (!value) return '';
    return String(value)
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

window.escapeHTML = function (value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

window.normalizePhone = function (value = '') {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = '58' + digits.slice(1);
    if (digits.length === 10 && digits.startsWith('4')) digits = '58' + digits;
    if (digits.length === 11 && digits.startsWith('04')) digits = '58' + digits.slice(1);
    return digits;
};

window.formatPhoneForDisplay = function (value = '') {
    const digits = window.normalizePhone(value);
    if (!digits) return '';
    if (digits.startsWith('58') && digits.length >= 12) {
        return '+58 ' + digits.slice(2, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
    }
    return '+' + digits;
};


window.sanitizeWhatsAppMessage = function (text = '') {
    return String(text)
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

window.isMobileDevice = function () {
    return /Android|iPhone|iPad|iPod|Mobile|Instagram|FBAN|FBAV/i.test(navigator.userAgent || '');
};

window.buildWhatsAppLinks = function (message, phone = window.WA_NUMBER) {
    const cleanPhone = window.normalizePhone ? window.normalizePhone(phone || window.WA_NUMBER) : String(phone || window.WA_NUMBER || '').replace(/\D/g, '');
    const cleanMessage = window.sanitizeWhatsAppMessage ? window.sanitizeWhatsAppMessage(message || '') : String(message || '').trim();
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
};

window.buildWhatsAppUrl = function (message, phone = window.WA_NUMBER) {
    return window.buildWhatsAppLinks(message, phone).api;
};

window.showWhatsAppManualFallback = function (url) {
    if (!url) return;
    let fallback = document.getElementById('whatsapp-manual-fallback');
    if (!fallback) {
        fallback = document.createElement('div');
        fallback.id = 'whatsapp-manual-fallback';
        fallback.className = 'fixed left-4 right-4 bottom-24 md:left-auto md:right-6 md:bottom-6 md:w-[360px] z-[1200] bg-white dark:bg-darkcard border border-green/30 rounded-2xl shadow-2xl p-4 text-left';
        fallback.innerHTML = `
                    <button type="button" aria-label="Cerrar" class="absolute top-3 right-3 text-gray-400 hover:text-pink" onclick="this.closest('#whatsapp-manual-fallback')?.remove()"><i data-lucide="x" class="w-4 h-4"></i></button>
                    <p class="text-sm font-black text-purple-dark dark:text-white pr-6">No se abrió WhatsApp automáticamente.</p>
                    <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">Toca el botón para continuar con la atención en WhatsApp.</p>
                    <a id="whatsapp-manual-fallback-link" class="mt-3 flex items-center justify-center gap-2 w-full bg-[#25D366] text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>`;
        document.body.appendChild(fallback);
    }
    const link = fallback.querySelector('#whatsapp-manual-fallback-link');
    if (link) link.href = url;
    window.refreshIcons?.();
    setTimeout(() => fallback?.remove(), 12000);
};

window.isIOSDevice = function () {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

window.isSafariBrowser = function () {
    const ua = navigator.userAgent || '';
    return /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/i.test(ua);
};

window.__legacyOpenWhatsAppMessageUnused = function (message, phone = window.WA_NUMBER, options = {}) {
    const links = window.buildWhatsAppLinks(message, phone);
    const isMobile = window.isMobileDevice?.() || false;
    const isIOS = window.isIOSDevice?.() || false;
    const isSafari = window.isSafariBrowser?.() || false;
    const useWaMe = !!options.preferWaMe || (isIOS && isSafari);
    const mainUrl = isMobile ? (useWaMe ? links.wa : links.api) : links.web;
    let opened = false;

    try {
        if (isMobile) {
            // iPhone Safari suele ser más confiable con una navegación directa a wa.me/api,
            // ejecutada dentro del mismo gesto del usuario y sin esperar Firebase.
            if (options.tryAppScheme && !isSafari) {
                window.location.href = links.app;
                setTimeout(() => {
                    if (document.visibilityState === 'visible') window.location.href = mainUrl;
                }, 650);
            } else {
                window.location.href = mainUrl;
            }
            opened = true;
        } else {
            const a = document.createElement('a');
            a.href = mainUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            opened = true;
            setTimeout(() => a.remove(), 800);
        }
    } catch (error) {
        try {
            if (isMobile) {
                window.location.href = links.wa;
                opened = true;
            } else {
                const win = window.open(mainUrl, '_blank', 'noopener,noreferrer');
                opened = !!win;
            }
        } catch (e) {
            try { window.location.href = links.api; opened = true; } catch (_) { }
        }
    }

    if (options.showFallback !== false) {
        setTimeout(() => {
            if (!opened || document.visibilityState === 'visible') {
                window.showWhatsAppManualFallback?.(links.wa || links.api);
            }
        }, options.fallbackDelay || 1600);
    }
    return mainUrl;
};

window.getWhatsAppTemplate = function (type = 'general', data = {}) {
    const currency = (value) => '$' + Number(value || 0).toFixed(2);
    const userName = window.capitalizeName(data.userName || data.email || 'Cliente Milkarf');

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
            const hasFeedingPlans = Array.isArray(data.items) && data.items.some(i => i.type === 'feeding_plan');

            let itemsFormatted = '';
            if (hasFeedingPlans) {
                itemsFormatted = data.items.map((i, index) => {
                    if (i.type === 'feeding_plan') {
                        const bagsText = Array.isArray(i.bags) ? i.bags.map(b => `${b.qty}x ${b.weight}`).join(' + ') : '';
                        const reqKg = (Number(i.totalGramsRequired || 0) / 1000).toFixed(2);
                        const provKg = (Number(i.totalGramsProvided || 0) / 1000).toFixed(2);
                        const surplus = Number(i.surplusGrams || 0);
                        const presText = i.presentation ? String(i.presentation).replace('gr', ' g') : (Array.isArray(i.bags) && i.bags[0] ? String(i.bags[0].weight).replace('gr', ' g') : '');
                        const petWeight = Number(i.petWeight) ? ` · ${Number(i.petWeight)} kg` : '';
                        const bagsCount = Number(i.bagsCount) || (Array.isArray(i.bags) ? i.bags.reduce((s, b) => s + (Number(b.qty) || 0), 0) : 0);
                        const subtotalNum = Number(i.originalSubtotal || i.price);
                        const discNum = Number(i.discountAmount || 0);
                        const totalNum = Number(i.finalPrice || i.price);
                        return `${index + 1}. *Plan para ${i.petName || i.forPet || 'Mascota'}*${petWeight}
   • Mascota: ${i.petName || i.forPet || 'Mascota'}${petWeight} · Ración: ${Number(i.dailyGrams) || 0} g/día
   • Fórmula: ${i.formulaName || 'Fórmula'} · Plan ${Number(i.durationDays) || 7} días
   • Presentación: ${presText || '500 g'} · Bolsas: ${bagsText || bagsCount + ' bolsa(s)'}
   • Alimento: ${reqKg} kg requeridos / ${provKg} kg provistos${surplus > 0 ? ` (+${surplus} g sin costo)` : ''}
   • Subtotal: ${currency(subtotalNum)} · Descuento (-${Number(i.discountPercent) || 0}%): -${currency(discNum)}
   • Total plan: ${currency(totalNum)}`;
                    }
                    const pet = i.forPet ? ` - Para ${i.forPet}` : '';
                    return `${index + 1}. ${Number(i.qty || 1)}x ${i.name || 'Fórmula'} (${i.weight || ''})${pet} - ${currency((i.price || 0) * (i.qty || 1))}`;
                }).join('\n\n');
            } else if (Array.isArray(data.items)) {
                itemsFormatted = data.items.map((i, index) => {
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

            if (data.discountAmount > 0) {
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

        case 'userRedeem':
            return `Hola, equipo Milkarf.

Deseo solicitar el canje de mis puntos acumulados.

Beneficio: ${data.itemName || 'Beneficio Milkarf'}
Detalle: ${data.benefit || 'Beneficio disponible'}
Puntos a descontar: ${Number(data.points || 0)} puntos
Tutor: ${userName}

Por favor, confirmen disponibilidad para coordinar la entrega.`;

        case 'adminOrderContact':
            return `Hola, te escribimos de Milkarf para confirmar tu pedido.

Recibimos tu solicitud y estamos revisando disponibilidad, costo de entrega según tu zona y formas de pago.

Por favor, indícanos si deseas proceder con la confirmación.`;

        case 'adminOrderContactFallback':
            return `Hola, equipo Milkarf.

Este pedido no cuenta con un número de WhatsApp registrado para contactar directamente al tutor.

Tutor: ${data.userName || data.email || 'Usuario'}
Pedido: ${data.orderId || 'sin referencia visible'}

Por favor, revisar el pedido desde el panel de administración.`;

        case 'deliveryNote': {
            const order = data.order || {};
            const noteItems = Array.isArray(data.items) ? data.items : (Array.isArray(order.items) ? order.items : []);
            const productTotal = Number(data.productTotal ?? order.total ?? 0);
            const deliveryCost = Number(data.deliveryCost || 0);
            const finalTotal = Number(data.finalTotal ?? (productTotal + deliveryCost));
            const clientName = window.capitalizeName(data.clientName || order.userName || order.nombre || order.email || 'Tutor Milkarf');
            const petName = data.petName || order.selectedPet || (noteItems.find(i => i.forPet)?.forPet) || 'tu mascota';
            const petText = petName && petName !== 'tu mascota' ? petName : 'tu mascota';
            const deliveryDate = data.deliveryDateLabel || 'Por confirmar';
            const orderIdShort = order.id ? `#${String(order.id).slice(-8).toUpperCase()}` : '#PEDIDO';
            const direccion = order.direccion || order.address || order.dir || 'A convenir';
            const ptsSumados = Number(order.pointsAwarded || order.pointsGranted || Math.floor(finalTotal));

            return `Hola, ${clientName}. Te compartimos la nota de entrega correspondiente a tu pedido en Milkarf para ${petText}.

Total a pagar: $${finalTotal.toFixed(2)}
Fecha de entrega: ${deliveryDate}
Puntos acumulados: +${ptsSumados} puntos

Adjuntamos el resumen detallado para su verificación. Si tienes alguna duda, estamos a tu disposición.`;
        }

        case 'birthday':
            return `Hola, te escribimos de Milkarf.

Sabemos que se acerca el cumpleaños de ${data.petName || 'tu mascota'} y queremos acompañarte a celebrarlo con una alternativa especial de nutrición natural.

Si lo deseas, podemos brindarte recomendaciones personalizadas según su perfil.`;

        case 'adminRedeemContact':
            return `Hola, te escribimos de Milkarf respecto a tu solicitud de canje.

Beneficio solicitado: ${data.itemName || data.benefit || 'Beneficio Milkarf'}
Puntos aplicados: ${Number(data.points || 0)} puntos

Nos comunicamos para validar disponibilidad y coordinar la entrega.`;

        default:
            return window.getWhatsAppTemplate('general', data);
    }
};

window.openWhatsApp = function (type = 'general', data = {}) {
    window.openWhatsAppMessage(window.getWhatsAppTemplate(type, data), data.phone || window.WA_NUMBER);
};

window.getClientToken = function () {
    try {
        let token = localStorage.getItem('milkarf_client_token');
        if (!token) {
            token = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            localStorage.setItem('milkarf_client_token', token);
        }
        return token;
    } catch (e) {
        if (!window.__fallbackClientToken) window.__fallbackClientToken = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        return window.__fallbackClientToken;
    }
};

window.resetAppStateForLogout = function () {
    window.currentUser = null;
    window.isAdmin = false;
    window.isRegisteringPet = false;
    window.descuentoAplicado = false;
    window.userLocation = null;
    window.lastOrderId = null;
    window.state = { nombreMascota: '', etapa: null, cachorroEdad: null, actividad: null };
    window.cart = [];
    try { localStorage.removeItem('milkarf_cart'); } catch (e) { }
    try { window.saveCartToStorage?.(); } catch (e) { }
    window.qtys = { pollo: 0, res: 0 };
    window.currentWeightPollo = '250gr';
    window.currentWeightRes = '250gr';
    if (unsubUserOrders) { unsubUserOrders(); unsubUserOrders = null; }
    if (typeof unsubUserRedeems !== 'undefined' && unsubUserRedeems) { unsubUserRedeems(); unsubUserRedeems = null; }
    ['calc-nombre', 'pesoInput', 'auth-email-login', 'auth-pass-login', 'auth-email-reg', 'auth-phone-reg', 'auth-pass-reg', 'auth-name-reg', 'pet-contact-name', 'pet-contact-whatsapp', 'reg-pet-nombre', 'reg-pet-edad', 'reg-pet-peso', 'reg-pet-raza', 'reg-pet-cumple', 'pet-nombre', 'pet-edad', 'pet-peso', 'pet-raza', 'pet-cumple', 'desc-nombre', 'desc-telefono', 'desc-mascota'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['errorMsg', 'auth-error', 'pet-error', 'desc-error', 'admin-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.classList.add('hidden'); el.classList.remove('visible'); }
    });
    const result = document.getElementById('tu-resultado');
    if (result) result.classList.remove('show', 'visible');
    const locationStatus = document.getElementById('location-status');
    if (locationStatus) { locationStatus.classList.add('hidden'); locationStatus.innerHTML = ''; }
    const locationText = document.getElementById('location-btn-text');
    if (locationText) locationText.textContent = 'Marcar mi ubicación en el mapa';
    const orderList = document.getElementById('user-orders-list');
    if (orderList) orderList.innerHTML = '<p class="text-xs text-gray-500 font-medium">Cuando realices un pedido, podrás ver aquí si está en proceso, confirmado o completado.</p>';
    const redeemList = document.getElementById('redeem-items-list');
    if (redeemList) redeemList.innerHTML = '<p class="text-xs text-gray-500 font-medium">Inicia sesión para ver beneficios disponibles.</p>';
    window.updateCartUI?.();
    window.updateCalcSaveCTA?.();
};

window.shouldShowWelcomeModal = function () {
    const activeView = document.querySelector('.view.active');
    if (window.isAdmin === true || activeView?.id === 'view-admin') return false;
    if (window.hasRealUserSession && window.hasRealUserSession()) return false;
    try {
        if (sessionStorage.getItem('milkarf_welcome_seen') === '1') return false;
    } catch (e) { }
    return true;
};
window.getTodayISO = function () {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

window.prepareBirthdayInput = function (input) {
    if (!input) return;
    input.type = 'date';
    input.max = window.getTodayISO();
};

window.setMaxBirthdayDates = function () {
    ['reg-pet-cumple', 'pet-cumple'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.max = window.getTodayISO();
    });
};

window.isFutureBirthday = function (dateStr) {
    if (!dateStr) return false;
    return dateStr > window.getTodayISO();
};

window.showAuthInfo = function (message) {
    const err = document.getElementById('auth-error');
    if (err) {
        err.innerHTML = message;
        err.className = "mt-3 text-xs font-bold text-purple-dark bg-green/20 border border-green/30 p-2.5 rounded-lg text-center leading-tight";
        err.classList.remove('hidden');
    }
};

window.prepareCalculatorInputs = function (clearWeight = false) {
    const nameInput = document.getElementById('calc-nombre');
    const pesoInput = document.getElementById('pesoInput');
    const err = document.getElementById('errorMsg');
    const result = document.getElementById('tu-resultado');

    if (nameInput) {
        nameInput.setAttribute('autocomplete', 'off');
        nameInput.setAttribute('name', 'calc_pet_name');
    }

    if (pesoInput) {
        pesoInput.setAttribute('autocomplete', 'off');
        pesoInput.setAttribute('name', 'calc_pet_weight_kg');
        pesoInput.setAttribute('inputmode', 'decimal');
        pesoInput.setAttribute('autocorrect', 'off');
        pesoInput.setAttribute('spellcheck', 'false');

        const currentValue = String(pesoInput.value || '');
        if (clearWeight || /[a-zA-Z@]/.test(currentValue)) {
            pesoInput.value = '';
            if (result) result.classList.remove('visible', 'show');
            if (/[a-zA-Z@]/.test(currentValue) && err) {
                err.textContent = 'Ingresa el peso en kg, solo números.';
                err.classList.add('visible');
            }
        }
    }
};


window.repairViewState = function (preferredId = 'view-home') {
    const views = Array.from(document.querySelectorAll('.view'));
    if (!views.length) return;
    let active = document.querySelector('.view.active');
    if (!active || !document.body.contains(active)) {
        const preferred = document.getElementById(preferredId) || document.getElementById('view-home') || views[0];
        views.forEach(view => {
            view.classList.remove('active', 'prev', 'next');
            view.classList.add(view === preferred ? 'active' : 'next');
        });
        active = preferred;
    }
    const activeViews = views.filter(view => view.classList.contains('active'));
    if (activeViews.length > 1) {
        activeViews.slice(1).forEach(view => { view.classList.remove('active'); view.classList.add('next'); });
    }
};

window.navigateTo = function (targetId) {
    if (window.location.pathname.endsWith('admin.html')) {
        const adminView = document.getElementById('view-admin');
        if (adminView) adminView.classList.add('active');
        return true;
    }
    if (!targetId) return;
    const target = document.getElementById(targetId);
    const views = Array.from(document.querySelectorAll('.view'));
    if (!target || !target.classList.contains('view')) {
        console.warn('Vista no encontrada:', targetId);
        window.repairViewState?.('view-home');
        window.isNavigating = false;
        if (window.menuOpen) window.forceCloseMenu?.();
        window.showToast?.('No pudimos abrir esa sección. Volvimos al inicio.');
        return;
    }

    let currentActive = document.querySelector('.view.active');
    if (!currentActive) {
        window.repairViewState?.('view-home');
        currentActive = document.querySelector('.view.active');
    }
    if (window.isNavigating && currentActive?.id !== targetId) return;

    if (currentActive?.id === targetId) {
        try { currentActive.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { currentActive.scrollTop = 0; }
        if (window.menuOpen) window.forceCloseMenu?.();
        return;
    }

    window.isNavigating = true;
    try { window.vibrate?.(18); } catch (e) { }
    const authWrap = document.getElementById('top-auth-btn-wrap');
    if (authWrap) authWrap.style.display = targetId === 'view-admin' ? 'none' : 'block';

    views.forEach(view => {
        view.classList.remove('active', 'prev', 'next');
        if (view.id === targetId) view.classList.add('active');
        else if (targetId === 'view-home') view.classList.add('next');
        else view.classList.add(view.id === 'view-home' ? 'prev' : 'next');
        try { view.scrollTop = 0; } catch (e) { }
    });
    window.lastScrollY = 0;
    if (targetId === 'view-calc') window.prepareCalculatorInputs?.(true);
    if (['view-perros', 'view-gatos', 'view-snacks'].includes(targetId)) {
        window.renderMenuPetSelector?.();
    }
    if (targetId === 'view-redeems') {
        window.renderRedeemItems?.();
        window.startUserRedeemsListener?.(true);
    }
    window.setMaxBirthdayDates?.();
    if (window.menuOpen) window.forceCloseMenu?.();

    const authMenu = document.getElementById('auth-dropdown-menu');
    if (authMenu && !authMenu.classList.contains('hidden')) {
        authMenu.classList.remove('opacity-100', 'scale-100');
        authMenu.classList.add('opacity-0', 'scale-95');
        setTimeout(() => authMenu.classList.add('hidden'), 160);
    }
    if (window.__navSafetyTimer) clearTimeout(window.__navSafetyTimer);
    window.__navSafetyTimer = setTimeout(() => { window.isNavigating = false; }, 600);
    setTimeout(() => {
        window.isNavigating = false;
        window.repairViewState?.(targetId);
    }, 420);
};

window.forceCloseMenu = function () {
    window.menuOpen = false;
    const btn = document.getElementById('menu-toggle-btn');
    const overlay = document.getElementById('nav-overlay');

    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        const bars = btn.querySelectorAll('.bar');
        if (bars.length >= 3) {
            bars[0].classList.remove('rotate-45', 'translate-y-2');
            bars[1].classList.remove('opacity-0');
            bars[2].classList.remove('-rotate-45', '-translate-y-2.5');
        }
    }

    if (overlay) {
        overlay.setAttribute('aria-hidden', 'true');
        overlay.classList.add('opacity-0', 'pointer-events-none');
        overlay.classList.remove('opacity-100', 'pointer-events-auto');
    }

    document.querySelectorAll('#main-nav-links li, #admin-nav-links li').forEach(li => {
        li.classList.add('opacity-0', '-translate-y-4');
        li.classList.remove('opacity-100', 'translate-y-0');
    });
};

window.toggleMenu = function () {
    window.vibrate?.(30);
    window.menuOpen = !window.menuOpen;
    const btn = document.getElementById('menu-toggle-btn');
    const overlay = document.getElementById('nav-overlay');
    if (!btn || !overlay) return;

    const bars = btn.querySelectorAll('.bar');

    btn.setAttribute('aria-expanded', window.menuOpen);
    overlay.setAttribute('aria-hidden', !window.menuOpen);

    const cl = overlay.classList;
    cl.toggle('opacity-0'); cl.toggle('pointer-events-none');
    cl.toggle('opacity-100'); cl.toggle('pointer-events-auto');

    if (bars.length >= 3) {
        bars[0].classList.toggle('rotate-45');
        bars[0].classList.toggle('translate-y-2');
        bars[1].classList.toggle('opacity-0');
        bars[2].classList.toggle('-rotate-45');
        bars[2].classList.toggle('-translate-y-2.5');
    }

    // Animación dinámica seleccionando solo la lista activa (normal o admin)
    const activeList = window.isAdmin ? document.getElementById('admin-nav-links') : document.getElementById('main-nav-links');
    const links = activeList ? activeList.querySelectorAll('li') : [];

    links.forEach((li, i) => {
        setTimeout(() => {
            li.classList.toggle('-translate-y-4');
            li.classList.toggle('opacity-0');
        }, window.menuOpen ? i * 25 : 0);
    });
};

window.toggleAccordion = function (btn) {
    window.vibrate?.(20);
    const content = btn.nextElementSibling, icon = btn.querySelector('i, svg, [data-lucide], [data-lucide-icon]');
    if (!content) return;
    const isOpen = content.classList.contains('max-h-[400px]');
    content.classList.toggle('max-h-0', isOpen); content.classList.toggle('opacity-0', isOpen);
    content.classList.toggle('max-h-[400px]', !isOpen); content.classList.toggle('opacity-100', !isOpen);
    if (icon) icon.style.transform = isOpen ? '' : 'rotate(180deg)';
};

// Acordeón de pasos ("Cómo empezar con Milkarf"): un único paso abierto en móvil.
window.initMkaStepsAccordion = function () {
    const container = document.getElementById('mka-steps');
    if (!container || container.dataset.mkaReady === '1') return;
    container.dataset.mkaReady = '1';

    const headers = Array.from(container.querySelectorAll('.mka-step-head'));
    const isCompact = window.matchMedia('(max-width: 639px)');

    const applyState = (head, open) => {
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
        head.parentElement.classList.toggle('mka-step-open', open);
    };

    headers.forEach((head, idx) => {
        const body = document.getElementById(head.getAttribute('aria-controls'));
        if (body) body.setAttribute('role', 'region');
        head.addEventListener('click', () => {
            if (!isCompact.matches) return;
            if (typeof window.vibrate === 'function') window.vibrate(20);
            const wasOpen = head.getAttribute('aria-expanded') === 'true';
            headers.forEach(other => applyState(other, other === head ? !wasOpen : false));
        });
        applyState(head, idx === 0);
    });
};

// =========================================================================================
// LÓGICA DE AUTENTICACIÓN Y NIVELES (HISTÓRICOS)
// =========================================================================================
window.getLevelInfo = function (ptsHist) {
    ptsHist = Number(ptsHist) || 0;
    if (ptsHist <= 100) return { nombre: "Cachorro 🐶", color: "text-green", bg: "bg-green" };
    if (ptsHist < 500) return { nombre: "Consentido 💛", color: "text-pink", bg: "bg-pink" };
    return { nombre: "Milkarf VIP 👑", color: "text-purple", bg: "bg-purple" };
};


// =========================================================================================
// PERFIL CLIENTE: MASCOTAS, RACIONES GUARDADAS Y ACCESO RÁPIDO A CALCULADORA
// =========================================================================================
window.selectedDashboardPetIndex = Number.isInteger(window.selectedDashboardPetIndex) ? window.selectedDashboardPetIndex : 0;

window.getPetCalcData = function (pet = {}) {
    const calc = pet.calculatedResult || pet.racion || pet.calculo || null;
    return calc && typeof calc === 'object' ? calc : null;
};

window.inferEtapaFromAgeText = function (ageText = '') {
    const raw = String(ageText || '').toLowerCase().trim();
    const num = parseFloat(raw.replace(',', '.'));
    if (raw.includes('mes')) {
        if (num && num < 12) return { etapa: 'cachorro', cachorroEdad: num <= 4 ? '2-4' : num <= 6 ? '4-6' : num <= 9 ? '6-9' : '9-12' };
    }
    if (Number.isFinite(num)) {
        if (num < 1) return { etapa: 'cachorro', cachorroEdad: '9-12' };
        if (num >= 7) return { etapa: 'senior', actividad: 'normal' };
        return { etapa: 'adulto', actividad: 'normal' };
    }
    if (raw.includes('cachorro')) return { etapa: 'cachorro', cachorroEdad: '9-12' };
    if (raw.includes('senior') || raw.includes('viejo') || raw.includes('mayor')) return { etapa: 'senior', actividad: 'normal' };
    if (raw.includes('adult')) return { etapa: 'adulto', actividad: 'normal' };
    return { etapa: null, cachorroEdad: null, actividad: null };
};

window.getCalculatorPayloadFromPet = function (pet = {}) {
    const calc = window.getPetCalcData(pet);
    const inferred = window.inferEtapaFromAgeText(pet.edad || pet.etapa || '');
    return {
        nombre: pet.nombre || calc?.nombre || '',
        tipo: pet.tipo || calc?.tipo || 'perro',
        peso: parseFloat(String(pet.peso || calc?.peso || '').replace(',', '.')) || '',
        etapa: pet.etapa || calc?.etapa || inferred.etapa || null,
        cachorroEdad: pet.cachorroEdad || calc?.cachorroEdad || inferred.cachorroEdad || null,
        actividad: pet.actividad || calc?.actividad || inferred.actividad || null,
        calculatedResult: calc
    };
};

window.selectCalcButtonByValue = function (kind, value) {
    if (!value) return;
    const selector = kind === 'etapa' ? '.calc-etapa-btn' : '.calc-sub-btn';
    const buttons = Array.from(document.querySelectorAll(selector));
    const btn = buttons.find(b => {
        const attr = b.getAttribute('onclick') || '';
        return attr.includes(`'${value}'`) || attr.includes(`\"${value}\"`);
    });
    if (btn) {
        if (kind === 'etapa') window.selectEtapa(value, btn);
        else {
            const field = ['2-4', '4-6', '6-9', '9-12'].includes(value) ? 'cachorroEdad' : 'actividad';
            window.selectSubOpt(field, value, btn);
        }
    }
};

window.selectDashboardPet = function (index) {
    const pets = window.currentUser?.data?.mascotas || [];
    if (!pets[index]) return;
    window.selectedDashboardPetIndex = index;
    window.state.nombreMascota = pets[index].nombre || '';
    window.actualizarUIAuth?.();
    window.showToast(`${pets[index].nombre || 'Mascota'} seleccionado/a para pedidos y cálculos.`, 'success');
};

window.cargarMascotaEnCalculadora = function (index) {
    const pets = window.currentUser?.data?.mascotas || [];
    const pet = pets[index];
    if (!pet) {
        window.showToast('No se encontró esa mascota en tu perfil.');
        return;
    }
    const payload = window.getCalculatorPayloadFromPet(pet);
    window.selectedDashboardPetIndex = index;
    window.state.nombreMascota = payload.nombre;
    window.state.etapa = null;
    window.state.cachorroEdad = null;
    window.state.actividad = null;

    window.navigateTo?.('view-calc');
    setTimeout(() => {
        const nameInput = document.getElementById('calc-nombre');
        const pesoInput = document.getElementById('pesoInput');
        const result = document.getElementById('tu-resultado');
        const err = document.getElementById('errorMsg');
        if (nameInput) nameInput.value = payload.nombre || '';
        if (pesoInput) pesoInput.value = payload.peso || '';
        if (result) result.classList.remove('show', 'visible');
        if (err) err.classList.remove('visible');
        document.querySelectorAll('.calc-etapa-btn, .calc-sub-btn').forEach(b => { b.classList.remove('active'); b.classList.add('opacity-60'); });
        const subC = document.getElementById('sub-cachorro');
        const subA = document.getElementById('sub-actividad');
        if (subC) subC.classList.add('hidden');
        if (subA) subA.classList.add('hidden');

        if (payload.etapa) window.selectCalcButtonByValue('etapa', payload.etapa);
        if (payload.etapa === 'cachorro' && payload.cachorroEdad) window.selectCalcButtonByValue('sub', payload.cachorroEdad);
        if (payload.etapa && payload.etapa !== 'cachorro' && payload.actividad) window.selectCalcButtonByValue('sub', payload.actividad);

        const readyToCalc = !!(payload.nombre && payload.peso && payload.etapa && ((payload.etapa === 'cachorro' && payload.cachorroEdad) || (payload.etapa !== 'cachorro' && payload.actividad)));
        if (readyToCalc) {
            window.calcularRacion?.();
            window.showToast(`Calculadora cargada con los datos de ${payload.nombre}.`, 'success');
        } else {
            window.showToast(`Datos de ${payload.nombre} cargados. Completa etapa/actividad para calcular.`, 'success');
        }
    }, 420);
};

window.buildDashboardPetCard = function (p = {}, idx = 0) {
    const safeName = window.escapeHTML(p.nombre || 'Mascota');
    const safePeso = window.escapeHTML(p.peso || '-');
    const safeEdad = window.escapeHTML(p.edad || p.etapa || 'Sin etapa registrada');
    const calc = window.getPetCalcData(p);
    const selected = idx === window.selectedDashboardPetIndex;
    const avatarContent = (p.tipo === 'gato' ? '🐱' : '🐶');
    const calcSummary = calc ? `
                <div class="mt-3 grid grid-cols-3 gap-2">
                    <div class="bg-white dark:bg-darkcard rounded-xl p-3 border border-purple-border/30 text-center"><p class="text-[9px] font-black text-gray-400 uppercase">Diario</p><p class="text-base font-black text-purple-dark dark:text-white">${Number(calc.gramos || 0)}g</p></div>
                    <div class="bg-white dark:bg-darkcard rounded-xl p-3 border border-purple-border/30 text-center"><p class="text-[9px] font-black text-gray-400 uppercase">Porción</p><p class="text-base font-black text-purple-dark dark:text-white">${Number(calc.porComida || 0)}g</p></div>
                    <div class="bg-white dark:bg-darkcard rounded-xl p-3 border border-purple-border/30 text-center"><p class="text-[9px] font-black text-gray-400 uppercase">Comidas</p><p class="text-base font-black text-purple-dark dark:text-white">${Number(calc.comidas || 0)}</p></div>
                </div>
                <p class="text-[9px] text-gray-400 font-bold mt-2">Último cálculo: ${calc.calculatedAt ? new Date(calc.calculatedAt).toLocaleDateString('es-VE') : 'guardado'}</p>` : `
                <div class="mt-3 bg-purple-light dark:bg-[#0d0718] rounded-xl p-3 border border-purple-border/30">
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">Aún no tienes una porción orientativa guardada para ${safeName}. Puedes calcularla y guardarla en su perfil.</p>
                </div>`;
    return `
                <div class="rounded-2xl border ${selected ? 'border-green shadow-md shadow-green/10 bg-green/5 dark:bg-green/10' : 'border-purple-border/30 dark:border-purple/20 bg-white dark:bg-darkcard'} p-4 relative overflow-hidden">
                    <div class="flex items-start gap-4">
                        <button type="button" onclick="window.selectDashboardPet(${idx})" class="w-12 h-12 rounded-full ${selected ? 'bg-green text-purple-dark' : 'bg-purple-light dark:bg-[#0d0718] text-purple dark:text-white'} flex items-center justify-center text-2xl shadow-sm border border-purple/10 shrink-0 active:scale-95 overflow-hidden" aria-label="Seleccionar mascota">${avatarContent}</button>
                        <div class="min-w-0 flex-1 pr-9">
                            <div class="flex flex-wrap items-center gap-2">
                                <h5 class="font-black text-purple-dark dark:text-white text-base truncate">${safeName}</h5>
                                ${selected ? '<span class="text-[8px] font-black uppercase tracking-widest bg-green text-purple-dark px-2 py-1 rounded-full">Seleccionada</span>' : ''}
                            </div>
                            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5 truncate">${safePeso}kg · ${safeEdad}${p.cumple ? ` · Nac: ${window.escapeHTML(p.cumple)}` : ''}</p>
                            ${calcSummary}
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                                <button type="button" onclick="window.cargarMascotaEnCalculadora(${idx})" class="bg-purple hover:bg-pink text-white text-[10px] font-black uppercase tracking-widest rounded-xl py-3 px-3 flex items-center justify-center gap-2 transition-all active:scale-95"><i data-lucide="calculator" class="w-4 h-4"></i> Calcular</button>
                                <button type="button" onclick="window.selectDashboardPet(${idx})" class="bg-purple-light dark:bg-purple/20 text-purple dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl py-3 px-3 flex items-center justify-center gap-2 transition-all active:scale-95"><i data-lucide="check-circle" class="w-4 h-4"></i> Usar</button>
                                <button type="button" onclick="window.abrirModalEditarMascota(${idx})" class="bg-white dark:bg-darkbg border border-purple-border/40 dark:border-purple/20 text-purple dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl py-3 px-3 flex items-center justify-center gap-2 transition-all active:scale-95"><i data-lucide="pencil" class="w-4 h-4"></i> Modificar</button>
                            </div>
                        </div>
                    </div>
                    <button type="button" onclick="window.eliminarMascota(${idx})" aria-label="Eliminar mascota" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white dark:bg-darkcard border border-pink/20 text-pink hover:bg-pink hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>`;
};


window.actualizarFotoMascota = async function (index) {
    window.vibrate?.(20);
    if (!window.currentUser || !window.currentUser.data || !db) {
        window.showToast('Inicia sesión para editar la foto de tu mascota.');
        return;
    }
    const mascotas = Array.isArray(window.currentUser.data.mascotas) ? [...window.currentUser.data.mascotas] : [];
    const pet = mascotas[index];
    if (!pet) return;
    const current = pet.fotoUrl || '';
    const url = prompt(`Pega el enlace de la foto de ${pet.nombre || 'tu mascota'}.

Debe ser una URL que comience con https://.
Deja el campo vacío para quitar la foto.`, current);
    if (url === null) return;
    const clean = String(url || '').trim();
    if (clean && !/^https:\/\//i.test(clean)) {
        window.showToast('La foto debe ser un enlace seguro que comience con https://');
        return;
    }
    try {
        mascotas[index] = { ...pet, fotoUrl: clean };
        await setDoc(window.getUserPath(window.currentUser.uid), {
            uid: window.currentUser.uid,
            mascotas,
            updatedAt: serverTimestamp()
        }, { merge: true });
        window.currentUser.data.mascotas = mascotas;
        window.actualizarUIAuth?.();
        window.showToast(clean ? 'Foto de mascota actualizada.' : 'Foto de mascota eliminada.', 'success');
    } catch (error) {
        console.error('Error actualizando foto de mascota:', error);
        window.showToast('No se pudo guardar la foto. Inténtalo de nuevo.');
    }
};

window.resetPetProfileFormForMode = function (mode = 'add') {
    const form = document.getElementById('form-pet-profile');
    if (!form) return;
    const title = form.querySelector('h4');
    const desc = form.querySelector('p');
    const btn = document.getElementById('btn-guardar-perfil');
    const err = document.getElementById('pet-error');
    if (err) { err.classList.add('hidden'); err.textContent = ''; }
    if (mode === 'edit') {
        if (title) title.textContent = 'Modificar mascota';
        if (desc) desc.textContent = 'Actualiza la información de tu mascota para mantener sus porciones orientativas y pedidos personalizados.';
        if (btn) btn.textContent = 'Guardar cambios';
    } else {
        if (title) title.textContent = 'Datos de tu mascota';
        if (desc) desc.textContent = 'Completa los datos de tu mascota para calcular sus porciones orientativas y asociarla a tus pedidos.';
        if (btn) btn.textContent = 'Guardar perfil y continuar';
    }
};

window.clearPetProfileFields = function ({ keepContact = true } = {}) {
    const ids = ['pet-nombre', 'pet-edad', 'pet-peso', 'pet-raza', 'pet-cumple'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (!keepContact) {
        const name = document.getElementById('pet-contact-name');
        const phone = document.getElementById('pet-contact-whatsapp');
        if (name) name.value = '';
        if (phone) phone.value = '';
    }
    const tipo = document.getElementById('pet-tipo');
    if (tipo) tipo.value = 'perro';
    window.selectPetType?.('perro');
};

window.fillPetProfileForm = function (pet = {}) {
    const contactNameEl = document.getElementById('pet-contact-name');
    const phoneEl = document.getElementById('pet-contact-whatsapp');
    if (contactNameEl) contactNameEl.value = window.currentUser?.data?.nombre || window.currentUser?.data?.nombre_persona || window.currentUser?.displayName || '';
    if (phoneEl) phoneEl.value = window.currentUser?.data?.telefono || window.currentUser?.data?.phone || window.currentUser?.data?.whatsapp || '';
    const tipo = pet.tipo || 'perro';
    window.selectPetType?.(tipo);
    const fields = {
        'pet-nombre': pet.nombre || '',
        'pet-edad': pet.edad || pet.etapa || '',
        'pet-peso': pet.peso || '',
        'pet-raza': pet.raza || '',
        'pet-cumple': pet.cumple || ''
    };
    Object.entries(fields).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
};

window.abrirModalEditarMascota = function (index) {
    window.vibrate?.(20);
    if (!window.currentUser || !window.currentUser.data) {
        window.showToast('Inicia sesión para modificar la información de tu mascota.');
        return;
    }
    const mascotas = Array.isArray(window.currentUser.data.mascotas) ? window.currentUser.data.mascotas : [];
    const pet = mascotas[index];
    if (!pet) {
        window.showToast('No encontramos esa mascota para modificar.');
        return;
    }
    window.editingPetIndex = index;
    window.setMaxBirthdayDates();
    window.abrirModalAuth();
    window.mostrarFormularioMascota('edit');
    window.fillPetProfileForm(pet);
    window.resetPetProfileFormForMode('edit');
};

window.abrirModalAgregarMascota = function () {
    window.editingPetIndex = null;
    window.setMaxBirthdayDates();
    window.abrirModalAuth();
    window.mostrarFormularioMascota('add');
    window.clearPetProfileFields({ keepContact: true });
    const contactNameEl = document.getElementById('pet-contact-name');
    const phoneEl = document.getElementById('pet-contact-whatsapp');
    if (contactNameEl && !contactNameEl.value) contactNameEl.value = window.currentUser?.data?.nombre || window.currentUser?.data?.nombre_persona || window.currentUser?.displayName || '';
    if (phoneEl && !phoneEl.value) phoneEl.value = window.currentUser?.data?.telefono || window.currentUser?.data?.phone || window.currentUser?.data?.whatsapp || '';
    window.resetPetProfileFormForMode('add');
};

window.abrirModalAuth = function () {
    window.vibrate?.(20);
    window.setMaxBirthdayDates();
    window.isRegisteringPet = false;

    const formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.classList.remove('hidden');
    const formRegister = document.getElementById('form-register');
    if (formRegister) formRegister.classList.add('hidden');
    const formPetProfile = document.getElementById('form-pet-profile');
    if (formPetProfile) formPetProfile.classList.add('hidden');
    const authTabs = document.getElementById('auth-tabs');
    if (authTabs) authTabs.classList.remove('hidden');
    const authGoogleBtn = document.getElementById('auth-google-btn');
    if (authGoogleBtn) authGoogleBtn.classList.remove('hidden');
    const authSeparator = document.getElementById('auth-separator');
    if (authSeparator) authSeparator.classList.remove('hidden');
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');
    if (tabLogin) tabLogin.className = "flex-1 pb-2 text-sm font-black border-b-2 border-purple text-purple dark:text-white transition-colors";
    if (tabReg) tabReg.className = "flex-1 pb-2 text-sm font-bold text-gray-400 dark:text-gray-500 border-b-2 border-transparent transition-colors hover:text-purple";
    const err = document.getElementById('auth-error');
    if (err) {
        err.className = "hidden mt-3 text-xs font-bold text-pink bg-pink/10 border border-pink/20 p-2.5 rounded-lg text-center leading-tight";
        err.textContent = "";
    }

    const modal = document.getElementById('modal-auth');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const box = document.getElementById('modal-auth-box');
        if (box) box.classList.remove('scale-95');
    }, 10);
    if (window.menuOpen) {
        if (typeof window.forceCloseMenu === 'function') window.forceCloseMenu();
        else window.toggleMenu();
    }
};

window.cerrarModalAuth = function () {
    const modal = document.getElementById('modal-auth');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const box = document.getElementById('modal-auth-box');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        window.isRegisteringPet = false;

        const formLogin = document.getElementById('form-login');
        if (formLogin) formLogin.classList.remove('hidden');

        const formRegister = document.getElementById('form-register');
        if (formRegister) formRegister.classList.add('hidden');

        const formPetProfile = document.getElementById('form-pet-profile');
        if (formPetProfile) formPetProfile.classList.add('hidden');

        const authTabs = document.getElementById('auth-tabs');
        if (authTabs) authTabs.classList.remove('hidden');

        const authGoogleBtn = document.getElementById('auth-google-btn');
        if (authGoogleBtn) authGoogleBtn.classList.remove('hidden');

        const authSeparator = document.getElementById('auth-separator');
        if (authSeparator) authSeparator.classList.remove('hidden');

        const err = document.getElementById('auth-error');
        if (err) {
            err.className = "hidden mt-3 text-xs font-bold text-pink bg-pink/10 border border-pink/20 p-2.5 rounded-lg text-center leading-tight";
            err.textContent = "";
        }

        const tabLogin = document.getElementById('tab-login');
        if (tabLogin) tabLogin.className = "flex-1 pb-2 text-sm font-black border-b-2 border-purple text-purple dark:text-white transition-colors";

        const tabRegister = document.getElementById('tab-register');
        if (tabRegister) tabRegister.className = "flex-1 pb-2 text-sm font-bold text-gray-400 dark:text-gray-500 border-b-2 border-transparent transition-colors hover:text-purple";

        window.actualizarUIAuth();
    }, 300);
};

window.switchAuthTab = function (tab) {
    window.vibrate?.(20);
    const btnLogin = document.getElementById('tab-login');
    const btnReg = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formReg = document.getElementById('form-register');
    const err = document.getElementById('auth-error');

    if (err) err.classList.add('hidden');

    if (tab === 'login') {
        if (btnLogin) btnLogin.className = "flex-1 pb-2 text-sm font-black border-b-2 border-purple text-purple dark:text-white transition-colors";
        if (btnReg) btnReg.className = "flex-1 pb-2 text-sm font-bold text-gray-400 dark:text-gray-500 border-b-2 border-transparent transition-colors hover:text-purple";
        if (formLogin) formLogin.classList.remove('hidden');
        if (formReg) formReg.classList.add('hidden');
    } else {
        if (btnReg) btnReg.className = "flex-1 pb-2 text-sm font-black border-b-2 border-purple text-purple dark:text-white transition-colors";
        if (btnLogin) btnLogin.className = "flex-1 pb-2 text-sm font-bold text-gray-400 dark:text-gray-500 border-b-2 border-transparent transition-colors hover:text-purple";
        if (formReg) formReg.classList.remove('hidden');
        if (formLogin) formLogin.classList.add('hidden');
    }
};

window.traductorErrores = function (code) {
    switch (code) {
        case 'auth/email-already-in-use': return "Este correo ya se encuentra registrado. Inicia sesión en la pestaña Ingresar.";
        case 'auth/invalid-email': return "Ingresa un correo electrónico válido.";
        case 'auth/weak-password': return "La contraseña debe tener al menos 6 caracteres.";
        case 'auth/user-not-found':
        case 'auth/wrong-password': return "El correo electrónico o la contraseña son incorrectos.";
        default: return "Ocurrió un error al procesar la solicitud. Por favor, intenta de nuevo.";
    }
};

window.actualizarUIAuth = function () {
    if (window.isRegisteringPet) return;

    const loggedOutMenu = document.getElementById('dropdown-logged-out');
    const loggedInMenu = document.getElementById('dropdown-logged-in');
    const dropName = document.getElementById('dropdown-user-name');
    const topText = document.getElementById('top-auth-text');
    const topPts = document.getElementById('top-auth-pts');
    const topPetsIcons = document.getElementById('top-pets-icons');
    const topLoggedOut = document.getElementById('top-auth-logged-out');
    const topLoggedIn = document.getElementById('top-auth-logged-in');
    const dText = document.getElementById('desktop-auth-text');
    const dPts = document.getElementById('desktop-auth-pts');
    const dLoggedOut = document.getElementById('desktop-auth-logged-out');
    const dLoggedIn = document.getElementById('desktop-auth-logged-in');

    if (window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email)) {

        if (window.isAdmin) {
            if (topText) topText.textContent = 'Panel Admin';
            if (topLoggedOut) topLoggedOut.classList.add('hidden');
            if (topLoggedIn) topLoggedIn.classList.remove('hidden');
            if (loggedOutMenu) loggedOutMenu.classList.add('hidden');
            if (loggedInMenu) loggedInMenu.classList.add('hidden');
            if (dText) dText.textContent = 'Admin';
            if (dLoggedOut) dLoggedOut.classList.add('hidden');
            if (dLoggedIn) dLoggedIn.classList.remove('hidden');
            return;
        }


        const primerNombre = window.currentUser.displayName ? window.currentUser.displayName.split(' ')[0] : (window.currentUser.email ? window.currentUser.email.split('@')[0] : 'Usuario');
        const puntosDisp = window.currentUser.data?.puntos || 0;
        const puntosHist = window.currentUser.data?.puntos_historicos || puntosDisp;
        const levelInfo = window.getLevelInfo(puntosHist);
        const mascotas = window.currentUser.data?.mascotas || [];

        if (loggedOutMenu) loggedOutMenu.classList.add('hidden');
        if (loggedInMenu) loggedInMenu.classList.remove('hidden');

        if (topLoggedOut) topLoggedOut.classList.add('hidden');
        if (topLoggedIn) topLoggedIn.classList.remove('hidden');
        if (dLoggedOut) dLoggedOut.classList.add('hidden');
        if (dLoggedIn) dLoggedIn.classList.remove('hidden');

        if (dropName) dropName.textContent = primerNombre;
        if (topText) topText.textContent = primerNombre;
        if (dText) dText.textContent = primerNombre;

        if (topPts) {
            topPts.textContent = puntosDisp + ' ptos';
            topPts.classList.remove('hidden');
        }
        if (dPts) {
            dPts.textContent = puntosDisp + ' pts';
        }

        if (topPetsIcons) {
            if (mascotas.length > 0) {
                topPetsIcons.innerHTML = mascotas.slice(0, 2).map(p => p.tipo === 'gato' ? '🐱' : '🐶').join('');
                if (mascotas.length > 2) topPetsIcons.innerHTML += '<span class="text-[8px] font-black pl-0.5">+</span>';
            } else {
                topPetsIcons.innerHTML = '🐾';
            }
        }

        const benUserName = document.getElementById('ben-user-name');
        if (benUserName) benUserName.textContent = primerNombre;
        const benUserLevel = document.getElementById('ben-user-level');
        if (benUserLevel) benUserLevel.textContent = levelInfo.nombre;
        const benUserPts = document.getElementById('ben-user-pts');
        if (benUserPts) benUserPts.textContent = puntosDisp;

        let nextMilestone = puntosHist >= 500 ? "Max" : (puntosHist > 100 ? 500 : 101);
        const benProgress = document.getElementById('ben-progress');
        const benPtsNext = document.getElementById('ben-pts-next');

        if (nextMilestone !== "Max") {
            if (benProgress) benProgress.style.width = Math.min((puntosHist / nextMilestone) * 100, 100) + '%';
            if (benPtsNext) benPtsNext.textContent = `Puntos Históricos: ${puntosHist} (Faltan ${nextMilestone - puntosHist} para subir de nivel)`;
        } else {
            if (benProgress) benProgress.style.width = '100%';
            if (benPtsNext) benPtsNext.textContent = `Puntos Históricos: ${puntosHist} (¡Nivel Máximo Alcanzado!)`;
        }

        const dashboardPetsList = document.getElementById('dashboard-pets-list');
        const btnAddPetView = document.getElementById('btn-add-pet-view');
        if (btnAddPetView) btnAddPetView.classList.remove('hidden');

        if (mascotas.length > 0) {
            if (dashboardPetsList) {
                if (!Number.isInteger(window.selectedDashboardPetIndex) || !mascotas[window.selectedDashboardPetIndex]) window.selectedDashboardPetIndex = 0;
                dashboardPetsList.innerHTML = `
                            <div class="bg-purple-light/70 dark:bg-purple/10 border border-purple-border/40 dark:border-purple/20 rounded-2xl p-4 mb-3">
                                <p class="text-[10px] font-black text-purple/60 dark:text-gray-400 uppercase tracking-widest mb-1">Mascota activa</p>
                                <p class="text-sm font-black text-purple-dark dark:text-white">${window.escapeHTML(mascotas[window.selectedDashboardPetIndex]?.nombre || mascotas[0]?.nombre || 'Mascota')}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">Selecciona una mascota para usarla en pedidos o cargar sus datos en la calculadora.</p>
                            </div>
                        ` + mascotas.map((p, idx) => window.buildDashboardPetCard(p, idx)).join('');
                window.refreshIcons?.(dashboardPetsList);
            }
        } else if (dashboardPetsList) {
            dashboardPetsList.innerHTML = `<p class="text-xs text-gray-500 font-medium">Aún no tienes mascotas registradas. Agrega una para personalizar pedidos y raciones.</p>`;
        }

        const banner = document.getElementById('descuento-banner');
        if (banner) {
            if (window.currentUser.data?.descuento_usado) {
                banner.classList.add('hidden');
                window.descuentoAplicado = false;
            } else {
                banner.classList.remove('hidden');
            }
        }
        window.renderRedeemItems?.();
        window.startUserOrdersListener?.(false);

    } else {
        if (loggedOutMenu) loggedOutMenu.classList.remove('hidden');
        if (loggedInMenu) loggedInMenu.classList.add('hidden');
        if (topLoggedOut) topLoggedOut.classList.remove('hidden');
        if (topLoggedIn) topLoggedIn.classList.add('hidden');
        if (dLoggedOut) dLoggedOut.classList.remove('hidden');
        if (dLoggedIn) dLoggedIn.classList.add('hidden');

        const benUserName = document.getElementById('ben-user-name');
        if (benUserName) benUserName.textContent = 'Usuario Invitado';
        const benUserLevel = document.getElementById('ben-user-level');
        if (benUserLevel) benUserLevel.textContent = 'Cachorro 🐾';
        const benUserPts = document.getElementById('ben-user-pts');
        if (benUserPts) benUserPts.textContent = '0';
        const benPtsNext = document.getElementById('ben-pts-next');
        if (benPtsNext) benPtsNext.textContent = 'Inicia sesión para ganar puntos';
        const benProgress = document.getElementById('ben-progress');
        if (benProgress) benProgress.style.width = '0%';

        const dashboardPetsList = document.getElementById('dashboard-pets-list');
        if (dashboardPetsList) dashboardPetsList.innerHTML = `<p class="text-xs text-gray-500 font-medium">Inicia sesión para ver y registrar a tus mascotas.</p>`;

        const btnAddPetView = document.getElementById('btn-add-pet-view');
        if (btnAddPetView) btnAddPetView.classList.add('hidden');

        const banner = document.getElementById('descuento-banner');
        if (banner) banner.classList.remove('hidden');
    }
    window.renderRedeemItems?.();
    window.updateCalcSaveCTA?.();
    if (window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email)) {
        window.startUserOrdersListener?.();
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    window.updateCartUI();
};

window.eliminarMascota = async function (index) {
    window.vibrate(20);
    if (!window.currentUser || !window.currentUser.data || !db) {
        window.showToast('Inicia sesión para editar tus mascotas.');
        return;
    }

    const mascotas = Array.isArray(window.currentUser.data.mascotas) ? [...window.currentUser.data.mascotas] : [];
    const pet = mascotas[index];
    if (!pet) return;

    const ok = confirm(`¿Seguro que deseas eliminar a ${pet.nombre || 'esta mascota'} de tu familia?`);
    if (!ok) return;

    try {
        const updatedMascotas = mascotas.filter((_, i) => i !== index);
        await setDoc(window.getUserPath(window.currentUser.uid), {
            mascotas: updatedMascotas,
            updatedAt: serverTimestamp()
        }, { merge: true });

        window.currentUser.data.mascotas = updatedMascotas;
        if (window.state.nombreMascota && pet.nombre && window.state.nombreMascota.toLowerCase() === pet.nombre.toLowerCase()) {
            window.state.nombreMascota = '';
            const calcNombre = document.getElementById('calc-nombre');
            if (calcNombre) calcNombre.value = '';
        }

        window.showToast('Mascota eliminada correctamente.', 'success');
        window.actualizarUIAuth();
    } catch (error) {
        console.error('Error eliminando mascota:', error);
        window.showToast('No se pudo eliminar la mascota. Intenta nuevamente.');
    }
};

window.loginConEmail = async function () {
    window.vibrate(20);
    if (!auth) { window.showToast("Base de datos no configurada."); return; }
    const emailEl = document.getElementById('auth-email-login');
    const passEl = document.getElementById('auth-pass-login');
    const email = emailEl ? emailEl.value.trim() : '';
    const pass = passEl ? passEl.value : '';
    const err = document.getElementById('auth-error');

    if (!email || !pass) {
        if (err) {
            err.textContent = "Ingresa tu correo y contraseña.";
            err.classList.remove('hidden');
        }
        return;
    }
    try {
        if (err) err.classList.add('hidden');
        const btn = document.getElementById('btn-login-email');
        if (btn) { btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-1"></i> Verificando...'; btn.disabled = true; }

        await signInWithEmailAndPassword(auth, email, pass);

        if (btn) { btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 inline mr-1"></i> ¡Conectado!'; }
        setTimeout(() => {
            if (btn) { btn.textContent = "Iniciar Sesión"; btn.disabled = false; }
            window.cerrarModalAuth();
        }, 150);
    } catch (error) {
        if (err) {
            err.textContent = window.traductorErrores(error.code);
            err.classList.remove('hidden');
        }
        const btn = document.getElementById('btn-login-email');
        if (btn) { btn.textContent = "Iniciar Sesión"; btn.disabled = false; }
    }
};

window.recuperarPassword = async function () {
    window.vibrate(20);
    if (!auth) { window.showToast("Base de datos no configurada."); return; }
    
    const emailInput = document.getElementById('auth-email-login');
    const email = emailInput ? emailInput.value.trim() : '';
    const err = document.getElementById('auth-error');

    if (!email) {
        if (err) {
            err.textContent = "Ingresa tu correo en el campo de arriba para restablecer la contraseña.";
            err.className = "mt-3 text-xs font-bold text-pink bg-pink/10 border border-pink/30 p-2.5 rounded-lg text-center leading-tight";
            err.classList.remove('hidden');
        } else {
            window.showToast("Ingresa tu correo para restablecer la contraseña.", "error");
        }
        if (emailInput) emailInput.focus();
        return;
    }

    try {
        if (err) err.classList.add('hidden');
        const btn = document.activeElement;
        const originalText = btn && btn.tagName === 'BUTTON' ? btn.innerHTML : '¿Olvidaste tu contraseña?';
        
        if (btn && btn.tagName === 'BUTTON') { 
            btn.innerHTML = '<i data-lucide="loader-2" class="w-3 h-3 animate-spin inline mr-1"></i>Enviando...'; 
            btn.disabled = true; 
            window.refreshIcons?.();
        }

        const actionCodeSettings = {
            url: window.location.origin + window.location.pathname,
            handleCodeInApp: false
        };
        await sendPasswordResetEmail(auth, email, actionCodeSettings);

        if (err) {
            err.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 inline mr-1 text-green-dark"></i> Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.`;
            err.className = "mt-3 text-xs font-bold text-purple-dark bg-green/20 border border-green/30 p-2.5 rounded-lg text-center leading-tight flex justify-center items-center";
            err.classList.remove('hidden');
            window.refreshIcons?.();
        } else {
            window.showToast("Enlace enviado. Revisa tu correo.", "success");
        }

        if (btn && btn.tagName === 'BUTTON') {
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 500);
        }
    } catch (error) {
        console.warn('Error al recuperar contraseña:', error);
        
        let mensaje = "No se pudo enviar el enlace. Verifica que el correo esté bien escrito.";
        if (error.code === 'auth/invalid-email') {
            mensaje = "El formato del correo no es válido.";
        }
        
        if (err) {
            err.textContent = mensaje;
            err.className = "mt-3 text-xs font-bold text-pink bg-pink/10 border border-pink/30 p-2.5 rounded-lg text-center leading-tight";
            err.classList.remove('hidden');
        } else {
            window.showToast(mensaje, "error");
        }
        
        const btn = document.activeElement;
        if (btn && btn.tagName === 'BUTTON') {
            btn.innerHTML = "¿Olvidaste tu contraseña?";
            btn.disabled = false;
        }
    }
};

window.currentOobCode = null;

window.handleResetPasswordUrl = async function() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode === 'resetPassword' && oobCode) {
        window.currentOobCode = oobCode;
        window.showToast("Verificando enlace...", "success");
        try {
            await verifyPasswordResetCode(auth, oobCode);
            // Open modal
            const modal = document.getElementById('modal-reset-password');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    const box = document.getElementById('modal-reset-password-box');
                    if (box) box.classList.remove('scale-95');
                }, 10);
            }
            // Clean url so it doesn't stay there if user reloads
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
            window.showToast("El enlace es inválido o ha expirado. Solicita uno nuevo.", "error");
        }
    }
};

window.cerrarModalResetPassword = function() {
    const modal = document.getElementById('modal-reset-password');
    const box = document.getElementById('modal-reset-password-box');
    if (modal) {
        modal.classList.add('opacity-0');
        if (box) box.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            window.currentOobCode = null;
        }, 300);
    }
};

window.guardarNuevaPassword = async function() {
    window.vibrate(20);
    const pass = document.getElementById('reset-new-pass')?.value;
    const confirm = document.getElementById('reset-confirm-pass')?.value;
    const err = document.getElementById('reset-error');

    if (!pass || pass.length < 6) {
        if (err) { err.textContent = "La contraseña debe tener al menos 6 caracteres."; err.classList.remove('hidden'); }
        return;
    }
    if (pass !== confirm) {
        if (err) { err.textContent = "Las contraseñas no coinciden."; err.classList.remove('hidden'); }
        return;
    }

    try {
        if (err) err.classList.add('hidden');
        const btn = document.getElementById('btn-save-new-pass');
        const originalText = btn ? btn.innerHTML : 'Guardar Contraseña';
        if (btn) { btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-1"></i> Guardando...'; btn.disabled = true; window.refreshIcons?.(); }

        await confirmPasswordReset(auth, window.currentOobCode, pass);

        window.showToast("Contraseña actualizada con éxito. Ya puedes iniciar sesión.", "success");
        window.cerrarModalResetPassword();
        
        // Open the login modal
        const loginModal = document.getElementById('modal-auth');
        if (loginModal) {
            loginModal.classList.remove('hidden');
            loginModal.classList.add('flex');
            setTimeout(() => {
                loginModal.classList.remove('opacity-0');
                const box = document.getElementById('modal-auth-box');
                if (box) box.classList.remove('scale-95');
                window.switchAuthTab?.('login');
            }, 10);
        }
        
        if (btn) {
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 500);
        }
    } catch (error) {
        console.warn(error);
        if (err) {
            err.textContent = "Ocurrió un error. El enlace puede haber expirado.";
            err.classList.remove('hidden');
        }
        const btn = document.getElementById('btn-save-new-pass');
        if (btn) { btn.innerHTML = 'Guardar Contraseña'; btn.disabled = false; }
    }
};

// NUEVO REGISTRO UNIFICADO
window.registrarYGuardarMascota = async function () {
    window.vibrate(20);
    if (!auth || !db) { window.showToast("Base de datos no configurada."); return; }

    const emailEl = document.getElementById('auth-email-reg');
    const passEl = document.getElementById('auth-pass-reg');
    const tipoEl = document.getElementById('reg-pet-tipo');
    const nombreEl = document.getElementById('reg-pet-nombre');
    const edadEl = document.getElementById('reg-pet-edad');
    const pesoEl = document.getElementById('reg-pet-peso');
    const razaEl = document.getElementById('reg-pet-raza');
    const cumpleEl = document.getElementById('reg-pet-cumple');
    const err = document.getElementById('auth-error');

    const email = emailEl ? emailEl.value.trim() : '';
    const pass = passEl ? passEl.value : '';
    const tipo = tipoEl ? tipoEl.value : 'perro';
    const nombre = nombreEl ? nombreEl.value.trim() : '';
    const edad = edadEl ? edadEl.value.trim() : '';
    const peso = pesoEl ? pesoEl.value.trim() : '';
    const raza = razaEl ? razaEl.value.trim() : '';
    const cumple = cumpleEl ? cumpleEl.value : '';

    if (!email || pass.length < 6 || !nombre || !edad || !peso) {
        if (err) {
            err.textContent = "Completa los campos obligatorios: correo, contraseña (mínimo 6 caracteres), nombre, edad y peso de tu mascota.";
            err.classList.remove('hidden');
        }
        return;
    }

    if (cumple && window.isFutureBirthday(cumple)) {
        if (err) {
            err.textContent = "La fecha de cumpleaños no puede ser una fecha futura.";
            err.classList.remove('hidden');
        }
        return;
    }

    try {
        if (err) err.classList.add('hidden');
        const btn = document.getElementById('btn-reg-email');
        if (btn) { btn.textContent = "Creando cuenta..."; btn.disabled = true; }

        // 1. Crear cuenta
        const cred = await createUserWithEmailAndPassword(auth, email, pass);

        // 2. Guardar mascota y datos
        const nuevaMascota = {
            id: Date.now().toString(),
            tipo: tipo,
            nombre: nombre,
            edad: edad,
            peso: peso,
            raza: raza || 'Mestizo',
            cumple: cumple
        };

        await setDoc(window.getUserPath(cred.user.uid), {
            uid: cred.user.uid,
            mascotas: [nuevaMascota],
            puntos: 0,
            puntos_historicos: 0,
            email: cred.user.email || '',
            updatedAt: serverTimestamp()
        }, { merge: true });

        window.state.nombreMascota = nombre;

        // Limpiar inputs
        if (emailEl) emailEl.value = '';
        if (passEl) passEl.value = '';
        if (nombreEl) nombreEl.value = '';
        if (edadEl) edadEl.value = '';
        if (pesoEl) pesoEl.value = '';
        if (razaEl) razaEl.value = '';
        if (cumpleEl) cumpleEl.value = '';

        window.showToast("Cuenta creada y mascota registrada con éxito.", 'success');
        window.cerrarModalAuth();
        if (btn) { btn.textContent = "Crear cuenta"; btn.disabled = false; }
    } catch (error) {
        if (err) {
            err.textContent = window.traductorErrores(error.code);
            err.classList.remove('hidden');
        }
        const btn = document.getElementById('btn-reg-email');
        if (btn) { btn.textContent = "Crear cuenta"; btn.disabled = false; }
    }
};

window.cerrarSesion = async function () {
    window.vibrate(20);
    const authMenu = document.getElementById('auth-dropdown-menu');
    if (authMenu) {
        authMenu.classList.remove('opacity-100', 'scale-100');
        authMenu.classList.add('opacity-0', 'scale-95');
        setTimeout(() => authMenu.classList.add('hidden'), 200);
    }
    try {
        if (auth) await signOut(auth);
    } catch (error) {
        console.warn('Error cerrando sesión:', error);
    } finally {
        window.resetAppStateForLogout?.();
        window.actualizarUIAuth?.();
        window.navigateTo?.('view-home');
        window.showToast('Sesión cerrada. La página volvió a su estado inicial.', 'success');
        if (auth) {
            try { await signInAnonymously(auth); } catch (e) { console.warn('No se pudo restaurar sesión invitada:', e); }
        }
    }
};

// Selectores de tipo de mascota para el formulario UNIFICADO
window.selectRegPetType = function (type) {
    const petTipo = document.getElementById('reg-pet-tipo');
    if (petTipo) petTipo.value = type;
    const btnPerro = document.getElementById('btn-reg-tipo-perro');
    const btnGato = document.getElementById('btn-reg-tipo-gato');
    if (!btnPerro || !btnGato) return;

    if (type === 'perro') {
        btnPerro.className = "flex-1 bg-purple text-white py-2 rounded-lg text-xs font-bold transition-colors";
        btnGato.className = "flex-1 bg-white dark:bg-[#0d0718] text-purple dark:text-white border border-purple-border/50 dark:border-purple/30 py-2 rounded-lg text-xs font-bold transition-colors";
    } else {
        btnGato.className = "flex-1 bg-purple text-white py-2 rounded-lg text-xs font-bold transition-colors";
        btnPerro.className = "flex-1 bg-white dark:bg-[#0d0718] text-purple dark:text-white border border-purple-border/50 dark:border-purple/30 py-2 rounded-lg text-xs font-bold transition-colors";
    }
};

// Selectores para el formulario EXCLUSIVO post-Google Login
window.selectPetType = function (type) {
    const petTipo = document.getElementById('pet-tipo');
    if (petTipo) petTipo.value = type;
    const btnPerro = document.getElementById('btn-tipo-perro');
    const btnGato = document.getElementById('btn-tipo-gato');
    if (!btnPerro || !btnGato) return;

    if (type === 'perro') {
        btnPerro.className = "flex-1 bg-purple text-white py-2.5 rounded-xl text-xs font-bold transition-colors";
        btnGato.className = "flex-1 bg-white dark:bg-[#0d0718] text-purple dark:text-white border border-purple-border/50 dark:border-purple/30 py-2.5 rounded-xl text-xs font-bold transition-colors";
    } else {
        btnGato.className = "flex-1 bg-purple text-white py-2.5 rounded-xl text-xs font-bold transition-colors";
        btnPerro.className = "flex-1 bg-white dark:bg-[#0d0718] text-purple dark:text-white border border-purple-border/50 dark:border-purple/30 py-2.5 rounded-xl text-xs font-bold transition-colors";
    }
};

window.mostrarFormularioMascota = function (mode = 'add') {
    window.isRegisteringPet = true;

    const authLoggedOut = document.getElementById('auth-logged-out');
    if (authLoggedOut) authLoggedOut.classList.add('hidden');

    const authTabs = document.getElementById('auth-tabs');
    if (authTabs) authTabs.classList.add('hidden');

    const authGoogleBtn = document.getElementById('auth-google-btn');
    if (authGoogleBtn) authGoogleBtn.classList.add('hidden');

    const authSeparator = document.getElementById('auth-separator');
    if (authSeparator) authSeparator.classList.add('hidden');

    const contactNameEl = document.getElementById('pet-contact-name');
    if (contactNameEl && !contactNameEl.value) contactNameEl.value = window.currentUser?.displayName || window.currentUser?.data?.nombre || '';

    const formPetProfile = document.getElementById('form-pet-profile');
    if (formPetProfile) formPetProfile.classList.remove('hidden');
    window.resetPetProfileFormForMode?.(mode);
};

window.guardarPerfilMascota = async function () {
    const contactNameEl = document.getElementById('pet-contact-name');
    const phoneEl = document.getElementById('pet-contact-whatsapp');
    const tipoEl = document.getElementById('pet-tipo');
    const nombreEl = document.getElementById('pet-nombre');
    const edadEl = document.getElementById('pet-edad');
    const pesoEl = document.getElementById('pet-peso');
    const razaEl = document.getElementById('pet-raza');
    const cumpleEl = document.getElementById('pet-cumple');
    const err = document.getElementById('pet-error');

    if (!tipoEl || !nombreEl || !edadEl || !pesoEl || !err) return;

    const contactName = contactNameEl ? contactNameEl.value.trim() : (window.currentUser?.displayName || '');
    const rawPhone = phoneEl ? phoneEl.value.trim() : '';
    const phone = window.normalizePhone(rawPhone);
    const tipo = tipoEl.value;
    const nombre = nombreEl.value.trim();
    const edad = edadEl.value.trim();
    const peso = pesoEl.value.trim();
    const raza = razaEl ? razaEl.value.trim() : '';
    const cumple = cumpleEl ? cumpleEl.value : '';

    if (!contactName) {
        err.textContent = "Ingresa tu nombre para personalizar tus pedidos y notas de entrega.";
        err.classList.remove('hidden');
        return;
    }

    if (!phone || phone.length < 10) {
        err.textContent = "Ingresa un número de WhatsApp válido para coordinar pedidos y notas de entrega.";
        err.classList.remove('hidden');
        return;
    }

    if (!nombre || !edad || !peso) {
        err.textContent = "Completa el nombre, edad y peso de tu mascota para continuar.";
        err.classList.remove('hidden');
        return;
    }

    if (cumple && window.isFutureBirthday(cumple)) {
        err.textContent = "La fecha de cumpleaños no puede ser una fecha futura.";
        err.classList.remove('hidden');
        return;
    }

    try {
        err.classList.add('hidden');
        const btn = document.getElementById('btn-guardar-perfil');
        if (btn) { btn.textContent = "Guardando..."; btn.disabled = true; }

        const nuevaMascota = {
            id: (Number.isInteger(window.editingPetIndex) && window.currentUser?.data?.mascotas?.[window.editingPetIndex]?.id) ? window.currentUser.data.mascotas[window.editingPetIndex].id : Date.now().toString(),
            tipo: tipo,
            nombre: nombre,
            edad: edad,
            peso: peso,
            raza: raza || 'Mestizo',
            cumple: cumple
        };

        const data = window.currentUser.data || { puntos: 0, puntos_historicos: 0, descuento_usado: false };
        if (!Array.isArray(data.mascotas)) data.mascotas = [];
        const editIndex = Number.isInteger(window.editingPetIndex) ? window.editingPetIndex : null;
        if (editIndex !== null && data.mascotas[editIndex]) {
            data.mascotas[editIndex] = { ...data.mascotas[editIndex], ...nuevaMascota };
        } else {
            data.mascotas.push(nuevaMascota);
        }

        await setDoc(window.getUserPath(window.currentUser.uid), {
            uid: window.currentUser.uid,
            mascotas: data.mascotas,
            puntos: data.puntos || 0,
            puntos_historicos: data.puntos_historicos || data.puntos || 0,
            email: window.currentUser.email || '',
            nombre: contactName,
            nombre_persona: contactName,
            userName: contactName,
            displayName: contactName,
            telefono: phone,
            phone: phone,
            whatsapp: phone,
            updatedAt: serverTimestamp()
        }, { merge: true });

        try { localStorage.setItem('milkarf_contact_phone', phone); } catch (e) { }
        window.currentUser.data = { ...data, mascotas: data.mascotas, nombre: contactName, nombre_persona: contactName, userName: contactName, displayName: contactName, telefono: phone, phone: phone, whatsapp: phone };
        window.state.nombreMascota = nombre;

        window.actualizarUIAuth();
        window.cerrarModalAuth();
        window.showToast(editIndex !== null ? 'Información de mascota actualizada con éxito.' : 'Datos de contacto y mascota guardados con éxito.', 'success');
        window.editingPetIndex = null;

        if (btn) { btn.textContent = (editIndex !== null ? 'Guardar cambios' : 'Guardar perfil y continuar'); btn.disabled = false; }
    } catch (e) {
        err.textContent = "Error al guardar perfil. Intenta de nuevo.";
        err.classList.remove('hidden');
        const btn = document.getElementById('btn-guardar-perfil');
        if (btn) { btn.textContent = (Number.isInteger(window.editingPetIndex) ? 'Guardar cambios' : 'Guardar perfil y continuar'); btn.disabled = false; }
    }
};

window.updateCalcSaveCTA = function () {
    const title = document.getElementById('calc-save-title');
    const text = document.getElementById('calc-save-text');
    const btn = document.getElementById('btn-save-calc-pet');
    if (!title || !text || !btn) return;
    const hasResult = !!window.lastCalcResult;
    if (!hasResult) {
        title.textContent = 'Guarda esta referencia';
        text.textContent = 'Calcula la porción orientativa para guardarla en el perfil de tu mascota.';
        btn.textContent = 'Guardar referencia';
        btn.disabled = true;
        btn.classList.add('opacity-60', 'cursor-not-allowed');
        return;
    }
    btn.disabled = false;
    btn.classList.remove('opacity-60', 'cursor-not-allowed');
    if (window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email) && !window.isAdmin) {
        title.textContent = 'Guardar en mi perfil';
        text.textContent = `Guarda los datos de ${window.lastCalcResult.nombre} y consulta su porción orientativa cuando lo necesites.`;
        btn.textContent = 'Guardar referencia';
    } else if (window.isAdmin) {
        title.textContent = 'Resultado listo';
        text.textContent = 'El administrador puede usar la calculadora como referencia sin guardar datos en un perfil.';
        btn.textContent = 'Uso interno';
        btn.disabled = true;
        btn.classList.add('opacity-60', 'cursor-not-allowed');
    } else {
        title.textContent = 'Crea tu cuenta y guarda esta porción';
        text.textContent = `Guarda los datos de ${window.lastCalcResult.nombre}, acumula puntos y valida tu 20% de descuento de bienvenida.`;
        btn.textContent = 'Crear cuenta';
    }
};

window.prefillRegisterFromCalc = function () {
    if (!window.lastCalcResult) return;
    const r = window.lastCalcResult;
    const regName = document.getElementById('reg-pet-nombre');
    const regWeight = document.getElementById('reg-pet-peso');
    const regEdad = document.getElementById('reg-pet-edad');
    if (regName) regName.value = r.nombre || '';
    if (regWeight) regWeight.value = r.peso || '';
    if (regEdad && r.etapa) regEdad.value = r.etapa === 'cachorro' ? (r.cachorroEdad + ' meses') : r.etapa;
    window.selectRegPetType?.('perro');
};

window.guardarMascotaDesdeCalculadora = async function () {
    window.vibrate(20);
    if (!window.lastCalcResult) {
        window.showToast('Primero calcula la porción orientativa de tu mascota.');
        return;
    }
    if (window.isAdmin) {
        window.showToast('Resultado calculado para uso interno del administrador.', 'success');
        return;
    }
    const isLogged = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email);
    if (!isLogged) {
        window.abrirModalAuth();
        window.switchAuthTab('register');
        window.prefillRegisterFromCalc();
        window.showAuthInfo('Crea tu cuenta para guardar la porción orientativa de tu mascota y validar tu <b>20% de descuento</b>.');
        return;
    }
    if (!db) {
        window.showToast('No se pudo guardar porque Firebase no está disponible.');
        return;
    }

    const r = window.lastCalcResult;
    const data = window.currentUser.data || { puntos: 0, puntos_historicos: 0, mascotas: [] };
    const mascotas = Array.isArray(data.mascotas) ? [...data.mascotas] : [];
    const petPayload = {
        id: 'calc_' + Date.now(),
        tipo: 'perro',
        nombre: r.nombre,
        edad: r.etapa === 'cachorro' ? (r.cachorroEdad + ' meses') : r.etapa,
        peso: r.peso,
        raza: '',
        cumple: '',
        racion: {
            gramos: r.gramos,
            comidas: r.comidas,
            porComida: r.porComida,
            etapa: r.etapa,
            actividad: r.actividad || r.cachorroEdad || '',
            calculatedAt: r.calculatedAt
        }
    };
    const existingIndex = mascotas.findIndex(m => String(m.nombre || '').toLowerCase() === String(r.nombre || '').toLowerCase());
    if (existingIndex >= 0) mascotas[existingIndex] = { ...mascotas[existingIndex], ...petPayload, id: mascotas[existingIndex].id || petPayload.id };
    else mascotas.push(petPayload);

    // Primero se guarda en Firebase. Las actualizaciones visuales van fuera del catch para no mostrar
    // un error falso cuando el guardado sí se completó pero alguna función de UI falla después.
    try {
        await setDoc(window.getUserPath(window.currentUser.uid), { uid: window.currentUser.uid, mascotas, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
        console.error('Error real guardando mascota desde calculadora:', error);
        window.showToast('No se pudieron guardar los datos. Revisa tu conexión e intenta nuevamente.');
        return;
    }

    window.currentUser.data = { ...data, mascotas };
    window.selectedDashboardPetIndex = Math.max(0, mascotas.findIndex(m => String(m.nombre || '').toLowerCase() === String(r.nombre || '').toLowerCase()));
    window.state.nombreMascota = r.nombre;

    const title = document.getElementById('calc-save-title');
    const text = document.getElementById('calc-save-text');
    const btn = document.getElementById('btn-save-calc-pet');
    if (title) title.textContent = 'Datos guardados con éxito';
    if (text) text.textContent = `La porción orientativa de ${r.nombre} ya está guardada en tu perfil.`;
    if (btn) btn.textContent = 'Ver en mi perfil';

    try { window.actualizarUIAuth?.(); } catch (uiError) { console.warn('La mascota se guardó, pero hubo un aviso actualizando el perfil:', uiError); }
    window.showToast('Datos guardados con éxito.', 'success');
    setTimeout(() => {
        try { window.navigateTo?.('view-dashboard'); } catch (navError) { console.warn('No se pudo navegar al perfil después de guardar:', navError); }
    }, 450);
};

window.abrirModalBienvenida = function () {
    if (typeof window.shouldShowWelcomeModal === 'function' && !window.shouldShowWelcomeModal()) return;
    const modal = document.getElementById('modal-bienvenida');
    if (modal) {
        try { sessionStorage.setItem('milkarf_welcome_seen', '1'); } catch (e) { }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            const box = document.getElementById('modal-bienvenida-box');
            if (box) box.classList.remove('scale-95');
        }, 50);
    }
};

window.cerrarModalBienvenida = function () {
    window.vibrate(20);
    const modal = document.getElementById('modal-bienvenida');
    if (modal) {
        modal.classList.add('opacity-0');
        const box = document.getElementById('modal-bienvenida-box');
        if (box) box.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 500);
    }
};

window.entendidoBienvenida = function () {
    window.vibrate(20);
    const isLoggedIn = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email);
    window.cerrarModalBienvenida();

    setTimeout(() => {
        if (isLoggedIn) {
            window.navigateTo('view-dashboard');
            return;
        }
        window.abrirModalAuth();
        window.switchAuthTab('register');
        window.showAuthInfo('Crea tu cuenta para validar tu <b>20% de descuento</b> en tu primer pedido de fórmulas.');
    }, 520);
};

window.abrirModalDescuento = function () {
    if (window.descuentoAplicado) return;

    if (!window.currentUser || window.currentUser.isAnonymous || !window.currentUser.email) {
        window.abrirModalAuth();
        window.switchAuthTab('register');
        const err = document.getElementById('auth-error');
        if (err) {
            err.innerHTML = "Crea tu cuenta para validar tu <b>20% de descuento</b> en tu primer pedido.";
            err.className = "mt-4 text-xs font-bold text-purple-dark bg-green/20 border border-green/30 p-2.5 rounded-lg text-center leading-tight";
            err.classList.remove('hidden');
        }
        return;
    }

    if (window.currentUser.data && window.currentUser.data.descuento_usado) {
        window.showToast("Tu cuenta ya utilizó el descuento de bienvenida.");
        return;
    }

    if (window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email)) {
        const primerNombre = window.currentUser.displayName ? window.currentUser.displayName.split(' ')[0] : (window.currentUser.email ? window.currentUser.email.split('@')[0] : '');
        const descNombre = document.getElementById('desc-nombre');
        if (descNombre) descNombre.value = primerNombre;

        const descMascota = document.getElementById('desc-mascota');
        if (descMascota) {
            if (window.currentUser.data && window.currentUser.data.mascotas && window.currentUser.data.mascotas.length > 0) {
                descMascota.value = window.currentUser.data.mascotas[0].nombre;
            } else if (window.state.nombreMascota) {
                descMascota.value = window.state.nombreMascota;
            }
        }
    }

    const modal = document.getElementById('modal-descuento');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            const box = document.getElementById('modal-descuento-box');
            if (box) box.classList.remove('scale-95');
        }, 10);
    }
};

window.cerrarModalDescuento = function () {
    const modal = document.getElementById('modal-descuento');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const box = document.getElementById('modal-descuento-box');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        const err = document.getElementById('desc-error'); if (err) err.classList.add('hidden');
        const dNombre = document.getElementById('desc-nombre'); if (dNombre) dNombre.classList.remove('border-pink', 'border-2');
        const dTel = document.getElementById('desc-telefono'); if (dTel) dTel.classList.remove('border-pink', 'border-2');
        const dMasc = document.getElementById('desc-mascota'); if (dMasc) dMasc.classList.remove('border-pink', 'border-2');
    }, 300);
};

window.verificarDescuento = async function () {
    window.vibrate(20);
    const inputNombre = document.getElementById('desc-nombre');
    const inputTelefono = document.getElementById('desc-telefono');
    const inputMascota = document.getElementById('desc-mascota');
    const err = document.getElementById('desc-error');

    if (!inputNombre || !inputTelefono || !inputMascota || !err) return;

    const nombre = inputNombre.value.trim().toLowerCase();
    const telefono = inputTelefono.value.trim();
    try { localStorage.setItem('milkarf_contact_phone', telefono); } catch (e) { }
    const mascota = inputMascota.value.trim().toLowerCase();

    inputNombre.classList.remove('border-pink', 'border-2');
    inputTelefono.classList.remove('border-pink', 'border-2');
    inputMascota.classList.remove('border-pink', 'border-2');

    if (!nombre || !telefono || !mascota) {
        err.textContent = "Completa todos los campos para validar el descuento.";
        err.classList.remove('hidden');
        if (!nombre) inputNombre.classList.add('border-pink', 'border-2');
        if (!telefono) inputTelefono.classList.add('border-pink', 'border-2');
        if (!mascota) inputMascota.classList.add('border-pink', 'border-2');
        return;
    }

    if (!window.currentUser || window.currentUser.isAnonymous) {
        err.innerHTML = "Sesión inválida. Por favor, recarga la página e inicia sesión.";
        err.classList.remove('hidden');
        return;
    }

    if (window.currentUser.data?.descuento_usado) {
        err.textContent = "Tu cuenta ya utilizó el descuento de bienvenida.";
        err.classList.remove('hidden');
        return;
    }

    const btn = document.getElementById('btn-verificar');
    const oldText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = "Verificando...";
        btn.disabled = true;
    }

    const uid = window.currentUser.uid;

    if (db && configToUse.apiKey) {
        try {
            const docSnap = await getDoc(window.getUserPath(uid));
            if (docSnap.exists() && docSnap.data().descuento_usado) {
                err.textContent = "Tu cuenta ya utilizó el descuento de bienvenida.";
                err.classList.remove('hidden');
                if (btn) { btn.innerHTML = oldText; btn.disabled = false; }
                return;
            }
        } catch (e) { console.warn("Aviso de red", e); }
    }

    window.descuentoAplicado = true;
    if (db && window.currentUser?.uid) {
        try {
            const cleanPhone = telefono.replace(/\D/g, '');
            await setDoc(window.getUserPath(window.currentUser.uid), {
                uid: window.currentUser.uid,
                telefono: cleanPhone,
                phone: cleanPhone,
                whatsapp: cleanPhone,
                nombre: nombre,
                nombre_persona: nombre,
                userName: nombre,
                updatedAt: serverTimestamp()
            }, { merge: true });
            window.currentUser.data = { ...(window.currentUser.data || {}), telefono: cleanPhone, phone: cleanPhone, whatsapp: cleanPhone, nombre, nombre_persona: nombre, userName: nombre };
        } catch (e) { console.warn('No se pudo guardar el teléfono de contacto:', e); }
    }
    window.cerrarModalDescuento();
    const banner = document.getElementById('descuento-banner');
    if (banner) banner.innerHTML = `<div class="bg-green/20 text-green-dark p-3 rounded-lg text-center text-xs font-black flex items-center justify-center gap-2"><i data-lucide="check-circle" class="w-4 h-4"></i> Descuento del 20% aplicado al pedido</div>`;
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    window.updateCartUI();

    if (btn) { btn.innerHTML = oldText; btn.disabled = false; }
};

// =========================================================================================
// LÓGICA EXCLUSIVA DEL ADMINISTRADOR (PEDIDOS, USUARIOS Y CANJES)
// =========================================================================================

window.abrirModalAdmin = function () {
    window.vibrate(30);
    const modal = document.getElementById('modal-admin-login');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const box = document.getElementById('modal-admin-box');
        if (box) box.classList.remove('scale-95');
    }, 10);
};

window.cerrarModalAdmin = function () {
    const modal = document.getElementById('modal-admin-login');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const box = document.getElementById('modal-admin-box');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};

window.updateAdminProfileUI = function (user) {
    if (!user) return;
    const nameEl = document.getElementById('admin-header-name');
    const avatarEl = document.getElementById('admin-header-avatar');
    const iconEl = document.getElementById('admin-header-icon');
    const profName = document.getElementById('admin-profile-name');
    const profEmail = document.getElementById('admin-profile-email');
    const profAvatar = document.getElementById('admin-profile-avatar');

    const displayName = user.displayName || user.email?.split('@')[0] || 'Administrador';
    const firstName = displayName.split(' ')[0];
    const email = user.email || '';
    const photo = user.photoURL;

    if (nameEl) nameEl.textContent = firstName;
    if (profName) profName.textContent = displayName;
    if (profEmail) profEmail.textContent = email;

    if (photo && photo.startsWith('http')) {
        if (avatarEl) { avatarEl.src = photo; avatarEl.classList.remove('hidden'); }
        if (iconEl) iconEl.classList.add('hidden');
        if (profAvatar) profAvatar.src = photo;
    } else {
        if (avatarEl) avatarEl.classList.add('hidden');
        if (iconEl) iconEl.classList.remove('hidden');
        if (profAvatar) profAvatar.src = 'logo.png';
    }
};

window.abrirPerfilAdmin = function () {
    window.vibrate(20);
    const modal = document.getElementById('admin-profile-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const box = document.getElementById('admin-profile-box');
        if (box) box.classList.remove('scale-95');
    }, 10);
};

window.cerrarPerfilAdmin = function () {
    const modal = document.getElementById('admin-profile-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    const box = document.getElementById('admin-profile-box');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};

window.loginConGoogleAdmin = async function () {
    window.vibrate?.(30);
    if (!auth) { window.showToast?.('Autenticación no configurada.'); return; }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const btn = document.getElementById('auth-google-btn-admin') || document.getElementById('auth-google-btn');
    try {
        if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }
        let cred = null;
        try {
            cred = await signInWithPopup(auth, provider);
        } catch (popupErr) {
            if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/operation-not-supported-in-this-environment') {
                try { localStorage.setItem('milkarf_google_login_in_progress', '1'); } catch (e) { }
                await signInWithRedirect(auth, provider);
                return;
            }
            throw popupErr;
        }

        const userEmail = cred.user.email?.toLowerCase?.() || '';
        const isUserAdmin = await window.checkIsAdminDynamic(userEmail);
        if (isUserAdmin) {
            window.isAdmin = true;
            window.updateAdminProfileUI?.(cred.user);
            const adminAuthScreen = document.getElementById('admin-auth-screen');
            const adminView = document.getElementById('view-admin');
            if (adminAuthScreen) adminAuthScreen.classList.add('hidden');
            if (adminView) { adminView.classList.remove('hidden'); adminView.classList.add('active'); }
            window.enterAdminMode({ navigate: false, load: true });
        } else {
            await signOut(auth);
            const err = document.getElementById('admin-error');
            if (err) {
                err.textContent = `El correo (${userEmail}) no está autorizado como administrador.`;
                err.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error Google Admin Login:', error);
        const err = document.getElementById('admin-error');
        if (err && error.code !== 'auth/popup-closed-by-user') {
            err.textContent = "Error al conectar con Google. Verifica tu conexión.";
            err.classList.remove('hidden');
        }
    } finally {
        if (btn) { btn.disabled = false; btn.classList.remove('opacity-60'); }
    }
};

window.enterAdminMode = function ({ navigate = true, load = true } = {}) {
    window.isAdmin = true;
    window.isRegisteringPet = false;

    const mainNav = document.getElementById('main-nav-links');
    const adminNav = document.getElementById('admin-nav-links');
    const topAuth = document.getElementById('top-auth-btn-wrap');
    const authMenu = document.getElementById('auth-dropdown-menu');
    const bienvenida = document.getElementById('modal-bienvenida');
    const descuento = document.getElementById('modal-descuento');

    if (mainNav) mainNav.classList.add('hidden');
    if (adminNav) adminNav.classList.remove('hidden');
    if (topAuth) topAuth.style.display = 'none';

    if (authMenu) {
        authMenu.classList.add('hidden', 'opacity-0', 'scale-95');
        authMenu.classList.remove('opacity-100', 'scale-100');
    }

    if (bienvenida) {
        bienvenida.classList.add('hidden', 'opacity-0');
        bienvenida.classList.remove('flex');
        document.getElementById('modal-bienvenida-box')?.classList.add('scale-95');
    }

    if (descuento) {
        descuento.classList.add('hidden', 'opacity-0');
        descuento.classList.remove('flex');
        document.getElementById('modal-descuento-box')?.classList.add('scale-95');
    }

    window.cerrarModalAdmin?.();
    window.cerrarModalCanje?.();
    window.forceCloseMenu?.();

    if (navigate) window.navigateTo('view-admin');
    if (load) {
        setTimeout(() => {
            if (typeof window.switchAdminTab === 'function') window.switchAdminTab('pedidos');
            else if (typeof window.loadAdminOrders === 'function') window.loadAdminOrders();
        }, 50);
    }

    if (typeof window.refreshIcons === 'function') window.refreshIcons();
};

window.verificarLoginAdmin = async function() {
    window.vibrate?.(20);
    const ui = document.getElementById('admin-user-input');
    const pi = document.getElementById('admin-pass-input');
    const err = document.getElementById('admin-error');
    const btn = document.getElementById('btn-login-admin');
    
    if(!ui || !pi || !err) return;

    const u = ui.value.trim();
    const p = pi.value.trim();
    
    if(!u || !p) {
        err.textContent = "Ingresa correo y contraseña";
        err.classList.remove('hidden');
        return;
    }

    try {
        err.classList.add('hidden');
        if (btn) { btn.textContent = "Verificando..."; btn.disabled = true; }
        
        const cred = await signInWithEmailAndPassword(auth, u, p);
        const email = cred.user.email?.toLowerCase?.() || '';
        const isUserAdmin = await window.checkIsAdminDynamic(email);
        if (isUserAdmin) {
            ui.value = ''; 
            pi.value = '';
            window.isAdmin = true;
            window.updateAdminProfileUI?.(cred.user);
            const adminAuthScreen = document.getElementById('admin-auth-screen');
            const adminView = document.getElementById('view-admin');
            if (adminAuthScreen) adminAuthScreen.classList.add('hidden');
            if (adminView) { adminView.classList.remove('hidden'); adminView.classList.add('active'); }
            window.enterAdminMode({ navigate: true, load: true });
        } else {
            window.isAdmin = false;
            err.textContent = "No tienes privilegios de administrador.";
            err.classList.remove('hidden');
            await signOut(auth);
        }
    } catch (error) {
        console.error('Login admin error:', error);
        err.textContent = "Contraseña incorrecta en Firebase Auth. Si tu cuenta es de Gmail, haz clic arriba en 'Continuar con Google'."; 
        err.classList.remove('hidden');
    } finally {
        if(btn) { btn.textContent = "Verificar Identidad"; btn.disabled = false; }
    }
};

window.salirAdmin = async function () {
    window.vibrate(20);
    try {
        window.isAdmin = true; // Mantiene la sesión admin activa en este dispositivo.
        window.isRegisteringPet = false;
        window.cerrarModalCanje?.();
        window.cerrarModalAdmin?.();
        window.forceCloseMenu?.();
        window.navigateTo('view-home');
        const mainNav = document.getElementById('main-nav-links');
        const adminNav = document.getElementById('admin-nav-links');
        const topAuth = document.getElementById('top-auth-btn-wrap');
        if (mainNav) mainNav.classList.add('hidden');
        if (adminNav) adminNav.classList.remove('hidden');
        if (topAuth) topAuth.style.display = 'none';
        window.showToast('Panel cerrado. La sesión admin sigue activa en este dispositivo.', 'success');
    } catch (error) {
        console.error(error);
        window.showToast('No se pudo volver a la web. Inténtalo de nuevo.');
    }
};

window.cerrarSesionAdmin = async function () {
    window.vibrate(20);
    try {
        if (unsubAdmin) { unsubAdmin(); unsubAdmin = null; }
        window.isAdmin = false;
        window.cerrarModalCanje?.();
        window.cerrarModalAdmin?.();
        window.forceCloseMenu?.();
        if (auth) await signOut(auth);
        window.resetAppStateForLogout?.();

        const isAdminPage = window.location.pathname.endsWith('admin.html');
        if (isAdminPage) {
            window.cerrarPerfilAdmin?.();
            const adminAuthScreen = document.getElementById('admin-auth-screen');
            const adminView = document.getElementById('view-admin');
            if (adminView) { adminView.classList.add('hidden'); adminView.classList.remove('active'); }
            if (adminAuthScreen) adminAuthScreen.classList.remove('hidden');
            window.showToast('Sesión administrativa cerrada.', 'info');
            return;
        }

        const mainNav = document.getElementById('main-nav-links');
        const adminNav = document.getElementById('admin-nav-links');
        const topAuth = document.getElementById('top-auth-btn-wrap');
        if (mainNav) mainNav.classList.remove('hidden');
        if (adminNav) adminNav.classList.add('hidden');
        if (topAuth) topAuth.style.display = 'block';
        window.actualizarUIAuth?.();
        window.navigateTo('view-home');
        window.showToast('Sesión de administrador cerrada.', 'success');
        if (auth) {
            try { await signInAnonymously(auth); } catch (e) { console.warn('No se pudo restaurar sesión invitada:', e); }
        }
    } catch (error) {
        console.error(error);
        window.showToast('No se pudo cerrar la sesión admin. Inténtalo de nuevo.');
    }
};

window.switchAdminTab = function (tab) {
    if (!window.isAdmin) {
        window.showToast('Debes iniciar sesión como administrador.');
        return;
    }
    if (!db) {
        window.showToast('Firebase no está disponible.');
        return;
    }

    const btnP = document.getElementById('tab-admin-pedidos');
    const btnU = document.getElementById('tab-admin-usuarios');
    const btnC = document.getElementById('tab-admin-cumples');
    const contP = document.getElementById('admin-orders-container');
    const contU = document.getElementById('admin-users-container');
    const contC = document.getElementById('admin-birthdays-container');

    if (!contP || !contU || !contC) {
        console.warn('Contenedores admin no encontrados.');
        return;
    }

    [btnP, btnU, btnC].forEach(b => {
        if (b) b.className = "text-sm font-bold text-gray-400 border-b-2 border-transparent hover:text-purple transition-colors pb-2 whitespace-nowrap";
    });
    contP.classList.add('hidden');
    contU.classList.add('hidden');
    contC.classList.add('hidden');

    if (tab === 'pedidos') {
        if (btnP) btnP.className = "text-sm font-black text-purple dark:text-white border-b-2 border-purple transition-colors pb-2 whitespace-nowrap";
        contP.classList.remove('hidden');
        window.loadAdminOrders();
    } else if (tab === 'usuarios') {
        if (btnU) btnU.className = "text-sm font-black text-purple dark:text-white border-b-2 border-purple transition-colors pb-2 whitespace-nowrap";
        contU.classList.remove('hidden');
        window.loadAdminUsers();
    } else if (tab === 'cumples') {
        if (btnC) btnC.className = "text-sm font-black text-purple dark:text-white border-b-2 border-purple transition-colors pb-2 whitespace-nowrap";
        contC.classList.remove('hidden');
        window.loadAdminBirthdays();
    } else {
        console.warn('Tab admin desconocido:', tab);
    }
};


window.getOrderStatusInfo = function (status) {
    const normalized = String(status || 'en_proceso').toLowerCase();
    const map = {
        pendiente: { label: 'En proceso', classes: 'bg-pink/10 text-pink border-pink/20', bar: 'bg-pink' },
        en_proceso: { label: 'En proceso', classes: 'bg-pink/10 text-pink border-pink/20', bar: 'bg-pink' },
        confirmado: { label: 'Confirmado', classes: 'bg-green/20 text-green-dark dark:text-green border-green/30', bar: 'bg-green' },
        verificado: { label: 'Confirmado', classes: 'bg-green/20 text-green-dark dark:text-green border-green/30', bar: 'bg-green' },
        completado: { label: 'Completado', classes: 'bg-purple/10 text-purple dark:text-purple-light border-purple/20', bar: 'bg-purple' },
        cancelado: { label: 'Cancelado', classes: 'bg-gray-200 text-gray-500 border-gray-300', bar: 'bg-gray-400' }
    };
    return map[normalized] || map.en_proceso;
};

window.startUserOrdersListener = function (forceNavigate = false) {
    const container = document.getElementById('user-orders-list');
    if (!container) return;
    if (!db) {
        container.innerHTML = '<p class="text-xs text-pink font-bold bg-pink/10 border border-pink/20 rounded-xl p-3">Firebase no está disponible para consultar pedidos.</p>';
        return;
    }
    const uid = auth?.currentUser?.uid || window.currentUser?.uid || null;
    const token = window.getClientToken();
    if (!uid) {
        container.innerHTML = '<p class="text-xs text-gray-500 font-medium">Inicia sesión o realiza un pedido para ver su estado.</p>';
        return;
    }
    if (unsubUserOrders) { unsubUserOrders(); unsubUserOrders = null; }
    container.innerHTML = '<p class="text-xs text-gray-500 font-semibold bg-white dark:bg-darkcard rounded-xl p-3 border border-purple-border/30">Consultando tus pedidos...</p>';
    try {
        const ordersRef = window.getOrdersCollectionRef();
        const qRef = window.secureUserQuery(ordersRef, uid);
        unsubUserOrders = onSnapshot(qRef, (snapshot) => {
            const orders = [];
            snapshot.forEach(d => orders.push({ id: d.id, ...d.data() }));
            orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            window.renderUserOrders(orders);
        }, (error) => {
            console.error('Error consultando pedidos del usuario:', error);
            container.innerHTML = '<p class="text-xs text-pink font-bold bg-pink/10 border border-pink/20 rounded-xl p-3">No se pudieron cargar tus pedidos. Revisa los permisos de Firestore para pedidos o intenta actualizar.</p>';
        });
    } catch (error) {
        console.error('Error iniciando listener de pedidos:', error);
        container.innerHTML = '<p class="text-xs text-pink font-bold bg-pink/10 border border-pink/20 rounded-xl p-3">No se pudo cargar el estado de tus pedidos.</p>';
    }
    if (forceNavigate) window.navigateTo?.('view-dashboard');
};

window.renderUserOrders = function (orders = []) {
    const container = document.getElementById('user-orders-list');
    if (!container) return;
    if (!orders.length) {
        container.innerHTML = '<p class="text-xs text-gray-500 font-medium">Cuando realices un pedido, podrás ver aquí si está en proceso, confirmado o completado.</p>';
        return;
    }
    container.innerHTML = orders.slice(0, 8).map(o => {
        const status = String(o.status || 'en_proceso').toLowerCase();
        const info = window.getOrderStatusInfo(status);
        const date = o.createdAt ? new Date(o.createdAt).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Pedido reciente';
        const items = Array.isArray(o.items) ? o.items.map(i => `${Number(i.qty || 0)}x ${i.name || 'Producto'} ${i.weight ? '(' + i.weight + ')' : ''}${i.forPet ? ' · ' + i.forPet : ''}`).join(' · ') : 'Pedido Milkarf';
        const total = typeof o.total === 'number' ? '$' + o.total.toFixed(2) : '';
        const points = Number(o.pointsAwarded || o.pointsGranted || 0);
        let helper = 'Pedido recibido. Está pendiente por confirmación del administrador.';
        if (['confirmado', 'verificado'].includes(status)) helper = points > 0 ? `Pedido confirmado. Puntos estimados: +${points} puntos.` : 'Pedido confirmado por administración.';
        if (status === 'completado') helper = points > 0 ? `Pedido completado. Sumaste +${points} puntos con esta compra.` : 'Pedido completado por administración.';
        if (status === 'cancelado') helper = 'Pedido cancelado. Escríbenos si necesitas revisar este pedido.';
        return `
                    <div class="relative bg-white dark:bg-darkcard rounded-2xl border border-purple-border/30 dark:border-purple/20 p-4 text-left overflow-hidden shadow-sm">
                        <div class="absolute top-0 left-0 w-1 h-full ${info.bar}"></div>
                        <div class="flex justify-between items-start gap-2 pl-1">
                            <div class="min-w-0 flex-1 pr-2">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest">${date}</p>
                                </div>
                                <h5 class="text-sm font-black text-purple-dark dark:text-white mt-1 leading-snug break-words">${window.escapeHTML(items)}</h5>
                                <p class="text-xs text-gray-500 dark:text-gray-400 font-bold mt-1">${total}</p>
                            </div>
                            <span class="shrink-0 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${info.classes}">${info.label}</span>
                        </div>
                        <div class="mt-3 ml-1 bg-purple-light/70 dark:bg-[#0d0718] border border-purple-border/30 dark:border-purple/20 rounded-xl p-3 overflow-hidden">
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed break-words">${window.escapeHTML(helper)}</p>
                            ${points > 0 ? `<div class="mt-2 inline-flex items-center gap-1 bg-green/15 text-green-dark dark:text-green border border-green/20 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest"><i data-lucide="sparkles" class="w-3 h-3"></i> +${points} ptos</div>` : ''}
                        </div>
                    </div>`;
    }).join('');
    window.refreshIcons?.(container);
};

window.loadAdminOrders = function () {
    const container = document.getElementById('admin-orders-container');
    if (!window.isAdmin) {
        window.showToast('Debes iniciar sesión como administrador.');
        if (container) container.innerHTML = '<p class="text-center text-pink font-bold py-10 text-sm bg-pink/10 rounded-3xl border border-pink/20">Debes iniciar sesión como administrador.</p>';
        return;
    }
    if (!db) {
        if (container) container.innerHTML = '<p class="text-center text-pink font-bold py-10 text-sm bg-pink/10 rounded-3xl border border-pink/20">Firebase no está disponible.</p>';
        return;
    }
    if (!container) {
        console.warn('admin-orders-container no encontrado.');
        return;
    }

    const ordersRef = window.getOrdersCollectionRef();

    if (unsubAdmin) { unsubAdmin(); unsubAdmin = null; }
    unsubAdmin = onSnapshot(window.secureAdminQuery(ordersRef), (snapshot) => {
        let orders = [];
        snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        window.renderAdminOrders(orders);
    }, (error) => {
        console.error("Error fetching orders", error);
        container.innerHTML = `<div class="bg-pink/10 border border-pink/30 p-4 rounded-xl text-center"><p class="text-pink font-bold text-sm">❌ Error al cargar pedidos.</p><p class="text-xs text-gray-500 mt-2">Verifica permisos de Firebase/Firestore.</p></div>`;
    });
};

window.applyAdminOrderFilter = function(status) {
    window.switchAdminTab('pedidos');
    setTimeout(() => {
        const select = document.getElementById('admin-order-status-filter');
        if (select) {
            select.value = status;
            window.filterAdminOrders();
        }
    }, 50);
};

window.renderAdminOrders = function (orders) {
    const container = document.getElementById('admin-orders-container');
    if (!container) return;
    
    let filteredOrders = orders;
    let filterHeader = '';
    
    if (window.adminOrderFilter) {
        filteredOrders = orders.filter(o => String(o.status || 'en_proceso').toLowerCase() === window.adminOrderFilter.toLowerCase());
        const filterLabels = {
            'en_proceso': 'En Proceso',
            'confirmado': 'Confirmados',
            'completado': 'Completados'
        };
        const label = filterLabels[window.adminOrderFilter] || window.adminOrderFilter;
        filterHeader = `
            <div class="flex items-center justify-between bg-purple-light dark:bg-purple/10 border border-purple/20 p-3 rounded-2xl mb-4">
                <span class="text-xs font-black text-purple-dark dark:text-white flex items-center gap-2"><i data-lucide="filter" class="w-4 h-4 text-purple"></i> Filtrando: ${window.escapeHTML(label)}</span>
                <button onclick="window.clearAdminOrderFilter()" class="text-[10px] bg-white dark:bg-darkcard border border-purple/20 text-pink hover:bg-pink hover:text-white px-3 py-1.5 rounded-xl font-bold uppercase tracking-widest transition-all">Quitar filtro</button>
            </div>
        `;
    }

    if (filteredOrders.length === 0) {
        container.innerHTML = filterHeader + '<p class="text-center text-gray-500 py-10 font-semibold text-sm bg-white dark:bg-darkcard rounded-3xl shadow-sm border border-purple-border/30 dark:border-purple/20">No hay pedidos para mostrar.</p>';
        window.refreshIcons?.(container);
        return;
    }
    container.innerHTML = filterHeader + filteredOrders.map(o => {
        const date = o.createdAt ? new Date(o.createdAt).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha';
        const pts = Math.floor(Number(o.total || 0));
        const statusInfo = window.getOrderStatusInfo(o.status);
        const status = String(o.status || 'en_proceso').toLowerCase();
        let actionButton = '';
        if (status === 'pendiente' || status === 'en_proceso' || status === 'solicitado') {
            actionButton = `<button onclick="window.marcarConfirmadoAdmin('${o.id}')" class="bg-blue-500 text-white text-[10px] md:text-xs font-black px-4 py-2.5 rounded-xl shadow-md hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-1.5 w-full sm:w-auto justify-center mt-3 sm:mt-0"><i data-lucide="check-circle" class="w-4 h-4"></i> Confirmar pedido</button>`;
        } else if (status === 'confirmado' || status === 'verificado') {
            if (o.registeredUser === true && o.uid && o.uid !== 'anonimo') {
                actionButton = `<button onclick="window.aprobarPedidoAdmin('${o.id}', '${o.uid}', ${pts})" class="bg-green text-purple-dark text-[10px] md:text-xs font-black px-4 py-2.5 rounded-xl shadow-md hover:bg-[#a6b621] transition-all active:scale-95 flex items-center gap-1.5 w-full sm:w-auto justify-center mt-3 sm:mt-0"><i data-lucide="check-square" class="w-4 h-4"></i> Completar pedido y dar puntos</button>`;
            } else {
                actionButton = `<button onclick="window.marcarCompletadoAdmin('${o.id}')" class="bg-purple text-white text-[10px] md:text-xs font-black px-4 py-2.5 rounded-xl shadow-md hover:bg-pink transition-all active:scale-95 flex items-center gap-1.5 w-full sm:w-auto justify-center mt-3 sm:mt-0"><i data-lucide="check-square" class="w-4 h-4"></i> Marcar completado</button>`;
            }
        }
        const safeUser = window.escapeHTML(o.userName || 'Usuario');
        const isFeedingPlanOrder = o.orderType === 'feeding_plan_order' || (Array.isArray(o.items) && o.items.some(i => i.type === 'feeding_plan'));
        const safeItems = Array.isArray(o.items) ? o.items.map(i => {
            if (i.type === 'feeding_plan') {
                const bagsText = Array.isArray(i.bags) ? i.bags.map(b => `${b.qty}x ${b.weight}`).join(' + ') : '';
                const reqKg = (Number(i.totalGramsRequired || 0) / 1000).toFixed(2);
                const provKg = (Number(i.totalGramsProvided || 0) / 1000).toFixed(2);
                const surplus = Number(i.surplusGrams || 0);
                return `
                    <li class="py-1">
                        <div class="font-bold text-purple-dark dark:text-white">🐾 Plan ${i.durationDays || 7} días para ${window.escapeHTML(i.petName || i.forPet || 'Mascota')} - ${window.escapeHTML(i.formulaName || i.name)}</div>
                        <div class="text-[11px] text-gray-500 dark:text-gray-400">
                            Ración: <span class="font-semibold text-purple">${i.dailyGrams || 0} g/día</span> · Bolsas: <span class="font-semibold">${window.escapeHTML(bagsText)}</span>
                        </div>
                        <div class="text-[11px] text-gray-500 dark:text-gray-400">
                            Alimento: ${reqKg} kg req / ${provKg} kg prov (+${surplus}g excedente) · Subtotal: $${Number(i.finalPrice || i.price || 0).toFixed(2)} ${i.discountAmount > 0 ? `(Ahorro: -$${Number(i.discountAmount).toFixed(2)})` : ''}
                        </div>
                    </li>
                `;
            }
            return `<li><span class="font-bold text-purple-dark dark:text-gray-300">${Number(i.qty || 0)}x</span> ${window.escapeHTML(i.name || 'Producto')} (${window.escapeHTML(i.weight || '')}) ${i.forPet ? `<span class="opacity-60 italic">- ${window.escapeHTML(i.forPet)}</span>` : ''}</li>`;
        }).join('') : '<li>Pedido sin detalle</li>';
        const totalNumber = Number(o.total || 0);
        return `
                <div class="bg-white dark:bg-darkcard rounded-3xl p-5 shadow-sm border border-purple-border/50 dark:border-purple/20 text-left relative overflow-hidden transition-all">
                    <div class="absolute top-0 left-0 w-1 h-full ${statusInfo.bar}"></div>
                    <div class="flex justify-between items-start mb-3 pl-1 gap-2">
                        <div class="min-w-0 flex-1 pr-2">
                            <div class="flex items-center gap-2 flex-wrap mb-1">
                                <h4 class="font-black text-purple-dark dark:text-white text-sm md:text-base leading-tight break-words">${safeUser}</h4>
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isFeedingPlanOrder ? 'bg-purple/10 text-purple-dark dark:text-purple-light border border-purple/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}">
                                    ${isFeedingPlanOrder ? 'Plan de alimentación' : 'Pedido de catálogo'}
                                </span>
                            </div>
                            <p class="text-[10px] text-purple/50 dark:text-gray-500 font-bold mt-0.5">${date}</p>
                        </div>
                        <span class="px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-widest shrink-0 ${statusInfo.classes}">
                            ${statusInfo.label}
                        </span>
                    </div>
                    <div class="bg-purple-light dark:bg-[#0d0718] rounded-xl p-3 mb-4 border border-purple-border/30 dark:border-purple/20 pl-1 overflow-hidden">
                        <ul class="text-xs text-gray-600 dark:text-gray-400 pl-4 list-disc space-y-1.5 font-medium break-words">
                            ${safeItems}
                        </ul>
                    </div>
                    <div class="flex flex-col sm:flex-row justify-between sm:items-center pl-1 gap-3">
                        <div>
                            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest block leading-tight">Total Cobrado</span>
                            <span class="font-black text-purple dark:text-white text-lg">$${totalNumber.toFixed(2)}</span>
                            ${o.descuentoAplicado ? `<span class="ml-2 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-md">Descuento aplicado</span>` : ''}
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            ${actionButton}
                        </div>
                    </div>
                </div>
                `;
    }).join('');
    if (window.lucide) window.lucide.createIcons({ root: container });
};

window.loadAdminUsers = async function () {
    const container = document.getElementById('admin-users-container');
    if (!window.isAdmin) {
        window.showToast('Debes iniciar sesión como administrador.');
        if (container) container.innerHTML = '<p class="text-center text-pink font-bold py-10 text-sm bg-pink/10 rounded-3xl border border-pink/20">Debes iniciar sesión como administrador.</p>';
        return;
    }
    if (!db) {
        if (container) container.innerHTML = '<p class="text-center text-pink font-bold py-10 text-sm bg-pink/10 rounded-3xl border border-pink/20">Firebase no está disponible.</p>';
        return;
    }
    if (!container) { console.warn('admin-users-container no encontrado.'); return; }
    container.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <p class="text-xs font-bold text-gray-400">Directorio de Clientes</p>
                    <button onclick="window.loadAdminUsers()" class="text-purple font-bold text-[10px] bg-purple/10 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-purple/20"><i data-lucide="refresh-cw" class="w-3 h-3"></i> Recargar Datos</button>
                </div>
                <p class="text-center text-gray-500 py-10 font-semibold text-sm bg-white dark:bg-darkcard rounded-3xl shadow-sm border border-purple-border/30 dark:border-purple/20">Cargando base de datos...</p>
            `;
    if (window.lucide) window.lucide.createIcons({ root: container });

    const usersRef = window.getUsersCollectionRef();

    try {
        const snapshot = await getDocs(window.secureAdminQuery(usersRef));
        let users = [];
        snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

        if (users.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-10 font-semibold text-sm bg-white dark:bg-darkcard rounded-3xl shadow-sm border border-purple-border/30 dark:border-purple/20">No hay usuarios registrados.</p>';
            return;
        }

        users.sort((a, b) => (b.puntos_historicos || b.puntos || 0) - (a.puntos_historicos || a.puntos || 0));

        container.innerHTML = `
                    <div class="flex justify-between items-center mb-4">
                        <p class="text-xs font-bold text-gray-400">Total: ${users.length} clientes</p>
                        <button onclick="window.loadAdminUsers()" class="text-purple font-bold text-[10px] bg-purple/10 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-purple/20 active:scale-95"><i data-lucide="refresh-cw" class="w-3 h-3"></i> Recargar Datos</button>
                    </div>
                ` + users.map(u => {
            const email = u.email || 'Sin correo registrado';
            const ptsDisp = u.puntos || 0;
            const ptsHist = u.puntos_historicos || ptsDisp;
            const levelObj = window.getLevelInfo(ptsHist);

            const desc = u.descuento_usado
                ? '<span class="text-pink text-[9px] font-black uppercase tracking-widest bg-pink/10 px-2 py-1 rounded-md border border-pink/20">Desc. Usado</span>'
                : '<span class="text-green-dark text-[9px] font-black uppercase tracking-widest bg-green/20 px-2 py-1 rounded-md border border-green/30">Desc. Disponible</span>';

            const mascotas = (u.mascotas || []).map(m => `
                        <div class="bg-purple/5 dark:bg-purple/10 p-3 rounded-xl mt-2 border border-purple/10">
                            <p class="font-black text-purple-dark dark:text-white text-xs">${m.tipo === 'gato' ? '🐱' : '🐶'} ${m.nombre}</p>
                            <p class="text-[10px] text-gray-500 font-bold mt-1">${m.peso}kg · ${m.edad} ${m.cumple ? `· Nac: ${m.cumple}` : ''}</p>
                        </div>
                    `).join('');

            return `
                    <div class="bg-white dark:bg-darkcard rounded-3xl p-5 shadow-sm border border-purple-border/50 dark:border-purple/20 text-left relative overflow-hidden">
                        <div class="flex justify-between items-start mb-2 gap-2">
                            <div class="pr-2 min-w-0 flex-1">
                                <p class="font-black text-purple-dark dark:text-white text-sm break-all leading-tight">${email}</p>
                                <p class="text-[10px] font-bold text-gray-500 mt-1">${levelObj.nombre} (Histórico: ${ptsHist} puntos)</p>
                            </div>
                            <div class="flex flex-col items-end shrink-0 gap-2">
                                <span class="text-xs font-black text-purple dark:text-white bg-purple-light dark:bg-purple/20 px-3 py-1.5 rounded-xl border border-purple/20 shadow-sm">${ptsDisp} ptos</span>
                            </div>
                        </div>
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 mt-3">
                            <div>${desc}</div>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <button onclick="window.abrirModalSumarPuntos('${u.id}', '${email}', ${ptsDisp})" class="text-[10px] bg-purple hover:bg-purple-dark text-white px-3 py-1.5 rounded-lg font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-1">
                                    <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> + Puntos
                                </button>
                                <button onclick="window.abrirModalCanje('${u.id}', '${email}', ${ptsDisp})" class="text-[10px] bg-green hover:bg-[#a6b621] text-purple-dark px-3 py-1.5 rounded-lg font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-1">
                                    <i data-lucide="gift" class="w-3.5 h-3.5"></i> Canjear
                                </button>
                                <button onclick="window.eliminarUsuarioAdmin('${u.id}', '${email}')" class="text-[10px] bg-pink/10 hover:bg-pink text-pink hover:text-white px-3 py-1.5 rounded-lg font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-1 border border-pink/20">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar
                                </button>
                            </div>
                        </div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest border-t border-purple/10 pt-3">Mascotas (${(u.mascotas || []).length}):</p>
                        ${mascotas || '<p class="text-xs text-gray-400 italic mt-2 font-medium">Sin mascotas registradas</p>'}
                    </div>`;
        }).join('');

    } catch (e) {
        console.error(e);
        const container = document.getElementById('admin-users-container');
        if (container) {
            container.innerHTML = `<div class="bg-pink/10 border border-pink/30 p-4 rounded-xl text-center mt-6"><p class="text-pink font-bold text-sm">❌ Error al cargar usuarios.</p><p class="text-xs text-gray-500 mt-2">Verifica permisos de Firebase/Firestore.</p></div>`;
        }
    }
};

window.eliminarUsuarioAdmin = async function (uid, email = '') {
    window.vibrate(20);
    if (!window.isAdmin) { window.showToast('Debes iniciar sesión como administrador.'); return; }
    if (!db) { window.showToast('Firebase no está disponible.'); return; }
    const safeEmail = email || 'este usuario';
    const ok = confirm(`¿Seguro que deseas eliminar de la base de datos a ${safeEmail}?

Esto borrará su perfil, mascotas, puntos, pedidos y registros de canje asociados. Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
        await deleteDoc(window.getUserPath(uid));
        const ordersSnap = await getDocs(query(window.getOrdersCollectionRef(), where('uid', '==', uid), limit(window.ADMIN_QUERY_LIMIT)));
        const orderDeletes = [];
        ordersSnap.forEach(d => orderDeletes.push(deleteDoc(d.ref)));
        await Promise.all(orderDeletes);
        try {
            const redeemsSnap = await getDocs(query(window.getRedeemsCollectionRef(), where('uid', '==', uid), limit(window.ADMIN_QUERY_LIMIT)));
            const redeemDeletes = [];
            redeemsSnap.forEach(d => redeemDeletes.push(deleteDoc(d.ref)));
            await Promise.all(redeemDeletes);
        } catch (e) {
            console.warn('No se pudieron limpiar algunos canjes asociados:', e);
        }
        window.showToast('Usuario eliminado de la base de datos.', 'success');
        window.loadAdminUsers();
    } catch (error) {
        console.error(error);
        window.showToast('No se pudo eliminar el usuario. Revisa permisos de Firestore.');
    }
};

window.loadAdminBirthdays = async function () {
    const container = document.getElementById('admin-birthdays-container');
    if (!window.isAdmin) {
        window.showToast('Debes iniciar sesión como administrador.');
        if (container) container.innerHTML = '<p class="text-center text-pink font-bold py-10 text-sm bg-pink/10 rounded-3xl border border-pink/20">Debes iniciar sesión como administrador.</p>';
        return;
    }
    if (!db) {
        if (container) container.innerHTML = '<p class="text-center text-pink font-bold py-10 text-sm bg-pink/10 rounded-3xl border border-pink/20">Firebase no está disponible.</p>';
        return;
    }
    if (!container) { console.warn('admin-birthdays-container no encontrado.'); return; }
    container.innerHTML = '<p class="text-center text-gray-500 py-10 font-semibold text-sm bg-white dark:bg-darkcard rounded-3xl shadow-sm border border-purple-border/30 dark:border-purple/20">Analizando fechas...</p>';

    const usersRef = window.getUsersCollectionRef();

    try {
        const snapshot = await getDocs(window.secureAdminQuery(usersRef));
        let petBirthdays = [];

        snapshot.forEach(doc => {
            const u = doc.data();
            if (u.mascotas && Array.isArray(u.mascotas)) {
                u.mascotas.forEach(m => {
                    // VERIFICACIÓN SEGURA DE FECHA PARA EVITAR FALLOS
                    if (m.cumple && typeof m.cumple === 'string' && m.cumple.includes('-')) {
                        const today = new Date();
                        const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                        const parts = m.cumple.split('-');
                        if (parts.length === 3) {
                            const y = parseInt(parts[0]);
                            const mo = parseInt(parts[1]);
                            const d = parseInt(parts[2]);

                            let nextBday = new Date(today.getFullYear(), mo - 1, d);

                            if (nextBday < todayNoTime) {
                                nextBday.setFullYear(today.getFullYear() + 1);
                            }

                            const diffTime = Math.abs(nextBday - todayNoTime);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            petBirthdays.push({
                                ownerEmail: u.email || 'Sin correo',
                                petName: m.nombre,
                                petType: m.tipo,
                                bdayString: m.cumple,
                                daysLeft: diffDays
                            });
                        }
                    }
                });
            }
        });

        petBirthdays.sort((a, b) => a.daysLeft - b.daysLeft);

        if (petBirthdays.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-10 font-semibold text-sm bg-white dark:bg-darkcard rounded-3xl shadow-sm border border-purple-border/30 dark:border-purple/20">Ninguna mascota tiene fecha de cumpleaños registrada.</p>';
            return;
        }

        container.innerHTML = petBirthdays.map(p => {
            const isNear = p.daysLeft <= 30;
            return `
                    <div class="bg-white dark:bg-darkcard rounded-3xl p-5 shadow-sm border ${isNear ? 'border-pink/50 dark:border-pink/30 shadow-lg shadow-pink/10' : 'border-purple-border/50 dark:border-purple/20'} text-left relative overflow-hidden transition-all">
                        ${isNear ? '<div class="absolute top-0 left-0 w-1 h-full bg-pink"></div>' : ''}
                        <div class="flex justify-between items-start mb-2 pl-1 gap-2">
                            <div class="min-w-0 flex-1 pr-2">
                                <h4 class="font-black ${isNear ? 'text-pink' : 'text-purple-dark dark:text-white'} text-base flex items-center gap-2 flex-wrap break-words">
                                    ${p.petType === 'gato' ? '🐱' : '🐶'} ${p.petName}
                                    ${isNear ? '<i data-lucide="cake" class="w-4 h-4"></i>' : ''}
                                </h4>
                                <p class="text-[10px] text-gray-500 font-bold mt-0.5">Nacimiento: ${p.bdayString}</p>
                            </div>
                            <span class="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${isNear ? 'bg-pink text-white' : 'bg-purple/5 text-purple'}">
                                ${p.daysLeft === 0 ? '¡Hoy!' : (p.daysLeft === 1 ? 'Mañana' : `En ${p.daysLeft} días`)}
                            </span>
                        </div>
                        <div class="bg-purple-light dark:bg-[#0d0718] p-3 rounded-xl border border-purple/10 mt-3 ml-1 overflow-hidden">
                            <p class="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Contacto / Dueño:</p>
                            <p class="text-xs font-black text-purple-dark dark:text-white break-all">${p.ownerEmail}</p>
                        </div>
                    </div>`;
        }).join('');
        if (window.lucide) window.lucide.createIcons({ root: container });
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-center text-pink font-bold py-10 text-sm bg-pink/10 rounded-3xl border border-pink/20">Error al cargar cumpleaños.</p>';
    }
};

window.abrirModalCanje = function (uid, email, puntos) {
    if (!window.isAdmin) {
        window.showToast('Debes iniciar sesión como administrador.');
        return;
    }
    const uidInput = document.getElementById('canje-uid');
    const userName = document.getElementById('canje-user-name');
    const userPts = document.getElementById('canje-user-pts');
    const item = document.getElementById('canje-item');
    const costo = document.getElementById('canje-costo');
    const modal = document.getElementById('modal-admin-canje');
    const box = document.getElementById('modal-admin-canje-box');
    if (!uidInput || !userName || !userPts || !item || !costo || !modal) {
        console.warn('Elementos de modal canje no encontrados.');
        return;
    }

    uidInput.value = uid;
    userName.textContent = email;
    userPts.textContent = pts;
    item.value = "";
    costo.value = "";

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        if (box) box.classList.remove('scale-95');
    }, 10);
};

window.cerrarModalCanje = function () {
    const modal = document.getElementById('modal-admin-canje');
    if (!modal) return;
    modal.classList.add('opacity-0');
    document.getElementById('modal-admin-canje-box')?.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};
window.closeAdminCanjeModal = window.cerrarModalCanje;

window.onCanjePresetChange = function () {
    const select = document.getElementById('canje-preset');
    const costo = document.getElementById('canje-costo');
    if (!select || !costo) return;
    if (select.value === 'custom') {
        costo.value = '';
        costo.focus();
        return;
    }
    costo.value = select.value;
};

window.procesarCanje = async function () {
    if (!window.isAdmin) {
        window.showToast('Debes iniciar sesión como administrador.');
        return;
    }
    if (!db) {
        window.showToast('Firebase no está disponible.');
        return;
    }

    const uidEl = document.getElementById('canje-uid');
    const costoEl = document.getElementById('canje-costo');
    const ptsEl = document.getElementById('canje-user-pts');
    if (!uidEl || !costoEl || !ptsEl) {
        console.warn('Elementos de canje no encontrados.');
        return;
    }

    const uid = uidEl.value;
    const ptsCostText = costoEl.value;
    const ptsDispText = ptsEl.textContent;

    const cost = parseInt(ptsCostText);
    const currentPts = parseInt(ptsDispText);

    if (!uid || isNaN(cost) || cost <= 0) {
        window.showToast("Ingresa una cantidad de puntos válida.");
        return;
    }

    if (cost > currentPts) {
        window.showToast("El usuario no tiene suficientes puntos.");
        return;
    }

    const btn = document.getElementById('btn-ejecutar-canje');
    if (btn) { btn.textContent = "Procesando..."; btn.disabled = true; }

    try {
        const userRef = window.getUserPath(uid);
        await setDoc(userRef, { puntos: currentPts - cost }, { merge: true });

        window.showToast(`¡Éxito! Se descontaron ${cost} puntos.`, 'success');
        window.cerrarModalCanje();
        window.loadAdminUsers();
    } catch (e) {
        window.showToast("Error al descontar puntos.");
        console.error(e);
    } finally {
        if (btn) { btn.textContent = "Confirmar y Descontar"; btn.disabled = false; }
    }
};

window.abrirModalSumarPuntos = function (uid, email, puntos) {
    if (!window.isAdmin) {
        window.showToast('Acceso restringido. Solo los administradores pueden otorgar puntos.');
        return;
    }
    const uidInput = document.getElementById('sumar-pts-uid');
    const userName = document.getElementById('sumar-pts-user-name');
    const userPts = document.getElementById('sumar-pts-user-current');
    const cantidad = document.getElementById('sumar-pts-cantidad');
    const motivo = document.getElementById('sumar-pts-motivo');
    const modal = document.getElementById('modal-admin-sumar-puntos');
    const box = document.getElementById('modal-admin-sumar-puntos-box');
    if (!uidInput || !userName || !userPts || !cantidad || !modal) {
        console.warn('Elementos de modal sumar puntos no encontrados.');
        return;
    }

    uidInput.value = uid;
    userName.textContent = email || 'Cliente';
    userPts.textContent = Number(puntos || 0);
    cantidad.value = "";
    if (motivo) motivo.value = "";

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        if (box) box.classList.remove('scale-95');
    }, 10);
};

window.cerrarModalSumarPuntos = function () {
    const modal = document.getElementById('modal-admin-sumar-puntos');
    if (!modal) return;
    modal.classList.add('opacity-0');
    document.getElementById('modal-admin-sumar-puntos-box')?.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};

window.procesarSumarPuntos = async function () {
    if (!window.isAdmin) {
        window.showToast('Acceso denegado. Solo administradores.');
        return;
    }
    if (!db) {
        window.showToast('Firebase no está disponible.');
        return;
    }

    const uidEl = document.getElementById('sumar-pts-uid');
    const cantidadEl = document.getElementById('sumar-pts-cantidad');
    const motivoEl = document.getElementById('sumar-pts-motivo');
    if (!uidEl || !cantidadEl) return;

    const uid = uidEl.value;
    const cantidad = parseInt(cantidadEl.value, 10);
    const motivo = motivoEl ? motivoEl.value.trim() : '';

    if (!uid || isNaN(cantidad) || cantidad <= 0 || cantidad > 100000) {
        window.showToast("Por favor, ingresa una cantidad válida de puntos mayor a 0.");
        return;
    }

    const btn = document.getElementById('btn-ejecutar-sumar-pts');
    if (btn) { btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Otorgando...'; btn.disabled = true; }

    try {
        const userRef = window.getUserPath(uid);
        const docSnap = await getDoc(userRef);
        let ptsDispBefore = 0;
        let ptsHistBefore = 0;
        if (docSnap.exists()) {
            const data = docSnap.data();
            ptsDispBefore = Number(data.puntos || 0);
            ptsHistBefore = Number(data.puntos_historicos || ptsDispBefore || 0);
        }

        const ptsDispAfter = ptsDispBefore + cantidad;
        const ptsHistAfter = ptsHistBefore + cantidad;

        await setDoc(userRef, {
            puntos: ptsDispAfter,
            puntos_historicos: ptsHistAfter,
            updatedAt: serverTimestamp()
        }, { merge: true });

        try {
            const logData = {
                uid,
                email: document.getElementById('sumar-pts-user-name')?.textContent || '',
                pointsAdded: cantidad,
                reason: motivo || 'Ajuste manual administrativo',
                adminEmail: window.currentUser?.email || 'Admin',
                type: 'manual_admin_adjustment',
                createdAt: new Date().toISOString()
            };
            await setDoc(doc(window.getSecureCollectionRef('puntos_ajustes'), 'ajuste_' + Date.now()), logData);
        } catch (errLog) {
            console.warn('No se pudo guardar registro del ajuste en puntos_ajustes:', errLog);
        }

        window.showToast(`¡Listo! Se sumaron ${cantidad} puntos al usuario.`, 'success');
        window.cerrarModalSumarPuntos();
        window.loadAdminUsers();
        if (window.adminCurrentTab === 'resumen') window.loadAdminSummary?.();
    } catch (e) {
        window.showToast("Error al otorgar puntos en Firebase.");
        console.error(e);
    } finally {
        if (btn) { btn.innerHTML = '<i data-lucide="plus-circle" class="w-4 h-4"></i> Otorgar Puntos'; btn.disabled = false; window.refreshIcons?.(btn); }
    }
};

window.renderRedeemItems = function () {
    const container = document.getElementById('redeem-items-list');
    if (!container) return;
    const isLogged = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email) && !window.isAdmin;
    if (!isLogged) {
        container.innerHTML = '<p class="text-xs text-gray-500 font-medium bg-white dark:bg-darkcard rounded-xl p-3 border border-purple-border/30">Inicia sesión para ver beneficios disponibles y canjear tus puntos.</p>';
        return;
    }
    const pts = Number(window.currentUser.data?.puntos || 0);
    container.innerHTML = window.REDEEM_ITEMS.map(item => {
        const canUse = pts >= item.points;
        return `
                    <div class="bg-white dark:bg-darkcard rounded-2xl border border-purple-border/30 dark:border-purple/20 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="text-left min-w-0">
                            <h5 class="text-sm font-black text-purple-dark dark:text-white">${window.escapeHTML(item.name)}</h5>
                            <p class="text-xs text-gray-500 dark:text-gray-400 font-semibold leading-relaxed mt-1">${window.escapeHTML(item.benefit)}</p>
                            <p class="text-[10px] font-black text-pink uppercase tracking-widest mt-2">${item.points} ptos</p>
                        </div>
                        <button type="button" onclick="window.canjearPuntosUsuario('${item.id}')" class="shrink-0 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${canUse ? 'bg-green text-purple-dark hover:bg-[#a6b621]' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}" ${canUse ? '' : 'disabled'}>
                            Canjear
                        </button>
                    </div>`;
    }).join('');
    window.refreshIcons?.(container);
};

window.canjearPuntosUsuario = async function (itemId) {
    window.vibrate(20);
    const item = window.REDEEM_ITEMS.find(i => i.id === itemId);
    if (!item) { window.showToast('Beneficio no encontrado.'); return; }
    const isLogged = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email) && !window.isAdmin;
    if (!isLogged) {
        window.abrirModalAuth();
        window.switchAuthTab('login');
        window.showAuthInfo('Inicia sesión para canjear tus puntos Milkarf.');
        return;
    }
    if (!db) { window.showToast('Firebase no está disponible.'); return; }
    const currentPts = Number(window.currentUser.data?.puntos || 0);
    if (currentPts < item.points) {
        window.showToast('No tienes puntos suficientes para este canje.');
        return;
    }
    const ok = confirm(`¿Deseas canjear ${item.points} puntos por ${item.name}?`);
    if (!ok) return;
    try {
        await addDoc(window.getRedeemsCollectionRef(), {
            uid: window.currentUser.uid,
            userName: window.currentUser.data?.nombre || window.currentUser.displayName || window.currentUser.email || 'Usuario Milkarf',
            email: window.currentUser.email || '',
            phone: window.currentUser.data?.phone || window.currentUser.data?.telefono || window.currentUser.data?.whatsapp || '',
            telefono: window.currentUser.data?.telefono || window.currentUser.data?.phone || window.currentUser.data?.whatsapp || '',
            itemId: item.id,
            itemName: item.name,
            benefit: item.benefit,
            points: item.points,
            pointsCost: item.points,
            costoPuntos: item.points,
            status: 'solicitado',
            createdAt: new Date().toISOString()
        });
        window.showToast('Canje solicitado. El equipo Milkarf validará y descontará los puntos al aprobarlo.', 'success');
        const msg = window.getWhatsAppTemplate('userRedeem', {
            itemName: item.name,
            benefit: item.benefit,
            points: item.points,
            userName: window.currentUser.displayName || window.currentUser.email || 'Cliente Milkarf'
        });
        setTimeout(() => window.openWhatsAppMessage(msg), 250);
    } catch (error) {
        console.error(error);
        window.showToast('No se pudo procesar el canje. Intenta nuevamente.');
    }
};

window.aprobarPedidoAdmin = async function (orderId, uid, basePts) {
    window.vibrate(20);
    if (!window.isAdmin) { window.showToast('Debes iniciar sesión como administrador.'); return; }
    if (!db) { window.showToast('Firebase no está disponible.'); return; }
    try {
        const userRef = window.getUserPath(uid);
        const docSnap = await getDoc(userRef);
        let pointsToGive = Math.max(0, Math.floor(Number(basePts || 0)));
        let isVIP = false;

        if (docSnap.exists()) {
            const data = docSnap.data();
            const ptsHistBefore = Number(data.puntos_historicos || data.puntos || 0);
            const ptsDispBefore = Number(data.puntos || 0);
            if (ptsHistBefore >= 500) {
                pointsToGive = Math.floor(pointsToGive * 1.5);
                isVIP = true;
            }
            await setDoc(userRef, {
                puntos: ptsDispBefore + pointsToGive,
                puntos_historicos: ptsHistBefore + pointsToGive,
                updatedAt: serverTimestamp()
            }, { merge: true });
        }

        const orderRef = window.getOrderDocRef(orderId);
        await setDoc(orderRef, {
            status: 'completado',
            confirmedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            pointsAwarded: pointsToGive,
            pointsGranted: pointsToGive
        }, { merge: true });

        window.showToast(`Pedido completado. +${pointsToGive} ptos ${isVIP ? '(VIP 1.5x)' : ''}`, 'success');
        if (window.adminCurrentTab === 'resumen') window.loadAdminSummary?.();
    } catch (e) {
        window.showToast('Error al completar pedido y otorgar puntos.');
        console.error(e);
    }
};

window.confirmarPedidoInvitadoAdmin = async function (orderId) {
    window.vibrate(20);
    if (!window.isAdmin) { window.showToast('Debes iniciar sesión como administrador.'); return; }
    if (!db) { window.showToast('Firebase no está disponible.'); return; }
    try {
        const orderRef = window.getOrderDocRef(orderId);
        await setDoc(orderRef, { status: 'completado', confirmedAt: new Date().toISOString(), completedAt: new Date().toISOString(), pointsAwarded: 0, pointsGranted: 0 }, { merge: true });
        window.showToast('Pedido completado.', 'success');
    } catch (error) {
        console.error(error);
        window.showToast('Error al confirmar pedido.');
    }
};

window.marcarCompletadoAdmin = async function (orderId) {
    window.vibrate(20);
    if (!window.isAdmin) { window.showToast('Debes iniciar sesión como administrador.'); return; }
    if (!db) { window.showToast('Firebase no está disponible.'); return; }
    try {
        const orderRef = window.getOrderDocRef(orderId);
        await setDoc(orderRef, { status: 'completado', completedAt: new Date().toISOString() }, { merge: true });
        window.showToast(`Pedido marcado como completado.`, 'success');
    } catch (e) {
        window.showToast("Error al actualizar pedido.");
        console.error(e);
    }
};

window.marcarConfirmadoAdmin = async function (orderId) {
    window.vibrate(20);
    if (!window.isAdmin) { window.showToast('Debes iniciar sesión como administrador.'); return; }
    if (!db) { window.showToast('Firebase no está disponible.'); return; }
    try {
        const orderRef = window.getOrderDocRef(orderId);
        await setDoc(orderRef, { status: 'confirmado', confirmedAt: new Date().toISOString() }, { merge: true });
        window.showToast(`Pedido confirmado correctamente.`, 'success');
    } catch (e) {
        window.showToast("Error al confirmar pedido.");
        console.error(e);
    }
};


// =========================================================================================
// MEJORA VISUAL Y OPERATIVA DEL PANEL ADMIN (DASHBOARD PROFESIONAL)
// =========================================================================================
window.adminCache = window.adminCache || { orders: [], users: [], redeems: [] };
window.adminCurrentTab = window.adminCurrentTab || 'resumen';

window.adminTabActiveClass = "bg-purple text-white shadow-md shadow-purple/20";
window.adminTabInactiveClass = "text-purple-dark dark:text-gray-300 hover:bg-purple-light dark:hover:bg-purple/20";

window.formatAdminDate = function (value, withTime = true) {
    if (!value) return 'Sin fecha';
    try {
        const d = value?.toDate ? value.toDate() : new Date(value);
        if (isNaN(d.getTime())) return 'Sin fecha';
        return d.toLocaleString('es-VE', withTime ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return 'Sin fecha'; }
};

window.adminEmptyState = function (title, text, icon = 'inbox') {
    return `<div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-8 md:p-10 text-center shadow-sm">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-purple-light dark:bg-purple/15 flex items-center justify-center text-purple dark:text-green mb-4"><i data-lucide="${icon}" class="w-7 h-7"></i></div>
                <h4 class="font-black text-purple-dark dark:text-white text-base">${window.escapeHTML(title)}</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 font-semibold leading-relaxed mt-2 max-w-md mx-auto">${window.escapeHTML(text)}</p>
            </div>`;
};

window.adminLoadingState = function (text = 'Sincronizando con Firebase...') {
    return `<div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-8 text-center shadow-sm">
                <div class="w-12 h-12 mx-auto rounded-full border-4 border-purple-border/40 border-t-purple animate-spin mb-4"></div>
                <p class="text-sm text-gray-500 dark:text-gray-400 font-bold">${window.escapeHTML(text)}</p>
            </div>`;
};

window.adminMetricCard = window.adminMetricCard || function (label, value, icon = 'bar-chart-3', tone = 'purple') {
    const safeLabel = window.escapeHTML ? window.escapeHTML(String(label ?? '')) : String(label ?? '');
    const safeValue = window.escapeHTML ? window.escapeHTML(String(value ?? '0')) : String(value ?? '0');
    const tones = {
        purple: { box: 'bg-purple-light dark:bg-purple/15 border-purple-border/40 dark:border-purple/25', icon: 'text-purple dark:text-green', value: 'text-purple-dark dark:text-white' },
        pink: { box: 'bg-pink/10 border-pink/20', icon: 'text-pink', value: 'text-purple-dark dark:text-white' },
        green: { box: 'bg-green/15 border-green/25', icon: 'text-green-dark dark:text-green', value: 'text-purple-dark dark:text-white' },
        neutral: { box: 'bg-white dark:bg-darkcard border-purple-border/30 dark:border-purple/20', icon: 'text-purple dark:text-green', value: 'text-purple-dark dark:text-white' }
    };
    const t = tones[tone] || tones.purple;
    return `<div class="rounded-3xl border ${t.box} p-4 md:p-5 shadow-sm min-h-[120px] flex flex-col justify-between">
                <div class="flex items-center justify-between gap-3">
                    <span class="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-purple/55 dark:text-gray-400 leading-tight">${safeLabel}</span>
                    <span class="w-9 h-9 rounded-2xl bg-white/80 dark:bg-darkcard/70 border border-white/60 dark:border-purple/20 flex items-center justify-center ${t.icon} shrink-0"><i data-lucide="${icon}" class="w-4 h-4"></i></span>
                </div>
                <div class="mt-4 text-2xl md:text-3xl font-black ${t.value} leading-none">${safeValue}</div>
            </div>`;
};

window.setAdminPanelLoading = function (containerId, msg) {
    const c = document.getElementById(containerId);
    if (c) c.innerHTML = window.adminLoadingState(msg);
};

window.getAdminContactLink = function (order) {
    const phone = String(order?.phone || order?.telefono || order?.whatsapp || '').replace(/\D/g, '');
    if (phone.length >= 8) {
        return window.buildWhatsAppUrl(window.getWhatsAppTemplate('adminOrderContact', { order }), phone);
    }
    return window.buildWhatsAppUrl(window.getWhatsAppTemplate('adminOrderContactFallback', {
        userName: order?.userName || '',
        email: order?.email || '',
        orderId: order?.id || ''
    }), window.WA_NUMBER);
};

window.getAdminOrderById = function (orderId) {
    return (window.adminCache?.orders || []).find(order => String(order.id) === String(orderId)) || null;
};

window.getOrderClientPhone = function (order = {}) {
    return window.normalizePhone(order.phone || order.telefono || order.whatsapp || order.contactPhone || order.userPhone || '');
};

window.getDeliveryNoteItems = function (order = {}) {
    return Array.isArray(order.items) ? order.items.map(item => ({
        name: item.name || 'Producto Milkarf',
        weight: item.weight || item.tam || item.presentation || '',
        qty: Number(item.qty || 0),
        price: Number(item.price || item.precio || 0),
        forPet: item.forPet || item.petName || '',
        personalizado: !!item.personalizado
    })) : [];
};

window.getDeliveryDateLabel = function (dateValue = '') {
    if (!dateValue) return 'Por confirmar';
    try {
        return new Date(dateValue + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
        return dateValue;
    }
};

window.getDeliveryNotePayload = function (order = {}) {
    const feeInput = document.getElementById('delivery-note-fee') || document.getElementById('delivery-note-cost');
    const deliveryCost = Math.max(0, Number(feeInput?.value || order.deliveryCost || 0));
    const deliveryDate = document.getElementById('delivery-note-date')?.value || order.deliveryDate || '';
    const items = window.getDeliveryNoteItems(order);
    const rawSubtotal = items.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.qty || 0)), 0);
    const hasDiscount = order.descuentoAplicado === true;
    const discountAmount = hasDiscount ? rawSubtotal * 0.2 : 0;
    const productTotal = rawSubtotal;
    const finalTotal = productTotal - discountAmount + deliveryCost;

    const clientName = window.capitalizeName(order.userName || order.nombre_persona || order.nombre || order.displayName || order.email || 'Cliente Milkarf');
    const petName = order.selectedPet || items.find(i => i.forPet)?.forPet || 'tu mascota';
    return {
        order,
        items,
        productTotal,
        hasDiscount,
        discountAmount,
        deliveryCost,
        finalTotal,
        deliveryDate,
        deliveryDateLabel: window.getDeliveryDateLabel(deliveryDate),
        clientName,
        petName
    };
};

window.buildDeliveryNoteMessage = function (order = {}, deliveryCost = 0, deliveryDate = '') {
    const payload = window.getDeliveryNotePayload(order);
    if (deliveryCost !== undefined && deliveryCost !== null) {
        payload.deliveryCost = Math.max(0, Number(deliveryCost || 0));
        payload.finalTotal = payload.productTotal - payload.discountAmount + payload.deliveryCost;
    }
    if (deliveryDate !== undefined && deliveryDate !== null && deliveryDate !== '') {
        payload.deliveryDate = deliveryDate;
        payload.deliveryDateLabel = window.getDeliveryDateLabel(deliveryDate);
    }
    return window.getWhatsAppTemplate('deliveryNote', payload);
};

window.copyDeliveryNoteMessage = async function () {
    const previewEl = document.getElementById('delivery-note-message-preview');
    const text = previewEl ? previewEl.textContent || '' : '';
    if (!text.trim()) {
        window.showToast?.('No hay mensaje para copiar.');
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        window.showToast?.('Mensaje copiado al portapapeles.', 'success');
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        window.showToast?.('Mensaje copiado al portapapeles.', 'success');
    }
};

window.updateDeliveryNotePreview = function () {
    const orderId = document.getElementById('delivery-note-order-id')?.value || '';
    const order = window.getAdminOrderById(orderId);
    const messagePreview = document.getElementById('delivery-note-message-preview');
    if (!order) return;

    const payload = window.getDeliveryNotePayload(order);
    const message = window.getWhatsAppTemplate('deliveryNote', payload);

    const clientEl = document.getElementById('delivery-note-client');
    const petEl = document.getElementById('delivery-note-pet');
    const dateEl = document.getElementById('delivery-note-date-text');
    const itemsEl = document.getElementById('delivery-note-items');
    const productsTotalEl = document.getElementById('delivery-note-subtotal');
    const discountRowEl = document.getElementById('delivery-note-discount-row');
    const discountAmountEl = document.getElementById('delivery-note-discount-amount');
    const deliveryTotalEl = document.getElementById('delivery-note-delivery-cost');
    const finalTotalEl = document.getElementById('delivery-note-total');

    if (clientEl) clientEl.textContent = payload.clientName;
    if (petEl) petEl.textContent = 'Mascota asociada: ' + payload.petName;
    if (dateEl) dateEl.textContent = 'Entrega: ' + payload.deliveryDateLabel;
    if (itemsEl) {
        itemsEl.innerHTML = payload.items.length ? payload.items.map(item => {
            const lineTotal = Number(item.price || 0) * Number(item.qty || 0);
            return `<div class="flex items-start justify-between gap-3 bg-purple-light/70 dark:bg-darkcard rounded-xl p-3 border border-purple-border/30 dark:border-purple/20">
                        <div class="min-w-0">
                            <p class="text-xs font-black text-purple-dark dark:text-white">${window.escapeHTML(item.name)} ${item.weight ? `<span class="font-bold text-purple/55 dark:text-gray-500">(${window.escapeHTML(item.weight)})</span>` : ''}</p>
                            <p class="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-0.5">${Number(item.qty || 0)} unidad(es)${item.forPet ? ` · Para ${window.escapeHTML(item.forPet)}` : ''}</p>
                        </div>
                        <p class="text-xs font-black text-purple-dark dark:text-white shrink-0">$${lineTotal.toFixed(2)}</p>
                    </div>`;
        }).join('') : '<p class="text-xs text-gray-500 font-semibold">Este pedido no tiene productos registrados.</p>';
    }
    if (productsTotalEl) productsTotalEl.textContent = '$' + payload.productTotal.toFixed(2);
    if (discountRowEl) {
        if (payload.hasDiscount) {
            discountRowEl.classList.remove('hidden');
            if (discountAmountEl) discountAmountEl.textContent = '-$' + payload.discountAmount.toFixed(2);
        } else {
            discountRowEl.classList.add('hidden');
        }
    }
    if (deliveryTotalEl) deliveryTotalEl.textContent = '$' + payload.deliveryCost.toFixed(2);
    if (finalTotalEl) finalTotalEl.textContent = '$' + payload.finalTotal.toFixed(2);
    if (messagePreview) messagePreview.textContent = message;
    window.renderDeliveryNoteCapture?.(payload);
};

window.renderDeliveryNoteCapture = function (payload = {}) {
    let target = document.getElementById('delivery-note-capture');
    if (!target) {
        target = document.createElement('div');
        target.id = 'delivery-note-capture';
        target.style.cssText = 'position:fixed; left:-9999px; top:0; width:800px; pointer-events:none; z-index:-1;';
        document.body.appendChild(target);
    }
    const safe = window.escapeHTML || ((v) => String(v ?? ''));
    const items = Array.isArray(payload.items) ? payload.items : [];
    const itemsHtml = items.length ? items.map(item => {
        const lineTotal = Number(item.price || 0) * Number(item.qty || 0);
        const weight = item.weight ? ` (${safe(item.weight)})` : '';
        const pet = item.forPet ? `Para ${safe(item.forPet)}` : 'Para la mascota registrada';
        return `<div class="delivery-capture-item">
                    <div>
                        <div class="delivery-capture-item-name">${safe(item.name || 'Producto Milkarf')}${weight}</div>
                        <div class="delivery-capture-item-sub">${Number(item.qty || 0)} unidad(es) · ${pet}</div>
                    </div>
                    <div class="delivery-capture-item-price">$${lineTotal.toFixed(2)}</div>
                </div>`;
    }).join('') : '<div class="delivery-capture-item"><div class="delivery-capture-item-name">Pedido Milkarf</div><div class="delivery-capture-item-price">$0.00</div></div>';

    target.innerHTML = `<div class="delivery-capture-card">
                <div class="delivery-capture-inner">
                    <div class="delivery-capture-head">
                        <div>
                            <div class="delivery-capture-kicker">Milkarf</div>
                            <h1 class="delivery-capture-title">Nota de entrega</h1>
                            <div class="delivery-capture-date">Entrega: ${safe(payload.deliveryDateLabel || 'Por confirmar')}</div>
                        </div>
                        <img class="delivery-capture-logo" src="logo.png" alt="Milkarf" onerror="this.style.display='none'">
                    </div>
                    <div class="delivery-capture-body">
                        <div class="delivery-capture-section">
                            <div class="delivery-capture-label">Cliente</div>
                            <p class="delivery-capture-client">${safe(payload.clientName || 'Cliente Milkarf')}</p>
                            <div class="delivery-capture-pet">Mascota asociada: ${safe(payload.petName || 'tu mascota')}</div>
                        </div>
                        <div class="delivery-capture-section">
                            <div class="delivery-capture-label">Detalle del pedido</div>
                            ${itemsHtml}
                        </div>
                        <div class="delivery-capture-totals">
                            <div class="delivery-capture-total-row"><span>Total productos</span><span>$${Number(payload.productTotal || 0).toFixed(2)}</span></div>
                            ${payload.hasDiscount ? `<div class="delivery-capture-total-row"><span style="color: #b9cb25;">Descuento (1era Compra)</span><span style="color: #b9cb25;">-$${Number(payload.discountAmount || 0).toFixed(2)}</span></div>` : ''}
                            <div class="delivery-capture-total-row"><span>Delivery</span><span>$${Number(payload.deliveryCost || 0).toFixed(2)}</span></div>
                            <div class="delivery-capture-total-row delivery-capture-final"><span>Total a pagar</span><span>$${Number(payload.finalTotal || 0).toFixed(2)}</span></div>
                        </div>
                        <div class="delivery-capture-payment">
                            <strong>Datos de pago</strong><br>
                            Banco de Venezuela<br>
                            Cuenta: 0102 0443 7700 0093 1771<br>
                            C.I: 20.530.321<br>
                            Pago móvil: 0414-179-1136<br><br>
                            Pago en Bs. a tasa BCV del día. Si pagas en divisas, puedes consultarnos por el descuento disponible.
                        </div>
                    </div>
                    <div class="delivery-capture-footer">
                        ¡Gracias por tu compra! Pedido confirmado y programado para entrega.
                        <br>Milkarf · Nutrición natural para mascotas
                    </div>
                </div>
            </div>`;
};

window.getDeliveryNoteCanvas = async function () {
    const orderId = document.getElementById('delivery-note-order-id')?.value || '';
    const order = window.getAdminOrderById(orderId);
    if (!order) throw new Error('No se encontró el pedido para generar la nota.');
    const payload = window.getDeliveryNotePayload(order);
    window.renderDeliveryNoteCapture?.(payload);
    let target = document.getElementById('delivery-note-capture');
    if (!target) throw new Error('No se encontró el contenedor de la nota visual.');
    if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('No se pudo cargar la librería de captura de imagen.'));
            document.head.appendChild(script);
        });
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return await window.html2canvas(target.firstElementChild || target, {
        scale: 3,
        backgroundColor: '#f5f0e8',
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 800
    });
};

window.canvasToBlob = function (canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
};

window.getDeliveryNoteFileName = function (order = {}) {
    const base = `nota-entrega-milkarf-${order.userName || order.nombre || order.id || Date.now()}`;
    return String(base).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.jpg';
};

window.downloadDeliveryNoteImage = async function () {
    const err = document.getElementById('delivery-note-error');
    if (err) { err.classList.add('hidden'); err.textContent = ''; }
    try {
        const orderId = document.getElementById('delivery-note-order-id')?.value || '';
        const order = window.getAdminOrderById(orderId) || {};
        window.updateDeliveryNotePreview?.();
        const canvas = await window.getDeliveryNoteCanvas();
        const link = document.createElement('a');
        link.download = window.getDeliveryNoteFileName(order);
        link.href = canvas.toDataURL('image/png', 1);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.showToast?.('Nota visual descargada en alta calidad.', 'success');
    } catch (error) {
        console.error('Error generando nota visual:', error);
        if (err) { err.textContent = error.message || 'No se pudo generar la imagen de la nota.'; err.classList.remove('hidden'); }
        else window.showToast?.('No se pudo generar la imagen de la nota.');
    }
};

window.openDeliveryNoteModal = function (orderId) {
    const order = window.getAdminOrderById(orderId);
    if (!order) { window.showToast?.('No se encontró el pedido. Actualiza el panel.'); return; }
    const modal = document.getElementById('modal-delivery-note');
    const box = document.getElementById('modal-delivery-note-box');
    if (!modal || !box) return;
    const phoneInput = document.getElementById('delivery-note-phone');
    const costInput = document.getElementById('delivery-note-fee') || document.getElementById('delivery-note-cost');
    const dateInput = document.getElementById('delivery-note-date');
    const idInput = document.getElementById('delivery-note-order-id');
    const subtitle = document.getElementById('delivery-note-subtitle');
    const err = document.getElementById('delivery-note-error');

    if (idInput) idInput.value = order.id;
    if (phoneInput) phoneInput.value = window.getOrderClientPhone(order) || '';
    if (costInput) costInput.value = Number(order.deliveryCost || 0) ? Number(order.deliveryCost || 0).toFixed(2) : '';
    if (dateInput) dateInput.value = order.deliveryDate || '';
    if (subtitle) subtitle.textContent = `Pedido de ${order.userName || order.email || 'cliente'} · Total productos $${Number(order.total || 0).toFixed(2)}`;
    if (err) { err.classList.add('hidden'); err.textContent = ''; }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        box.classList.remove('scale-95');
    }, 10);

    [phoneInput, costInput, dateInput].forEach(input => {
        if (input && input.dataset.deliveryListener !== '1') {
            input.dataset.deliveryListener = '1';
            input.addEventListener('input', window.updateDeliveryNotePreview);
            input.addEventListener('change', window.updateDeliveryNotePreview);
        }
    });

    window.updateDeliveryNotePreview();
    window.refreshIcons?.(modal);
};

window.closeDeliveryNoteModal = function () {
    const modal = document.getElementById('modal-delivery-note');
    const box = document.getElementById('modal-delivery-note-box');
    if (!modal) return;
    modal.classList.add('opacity-0');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 220);
};

window.sendDeliveryNoteToClient = async function () {
    const orderId = document.getElementById('delivery-note-order-id')?.value || '';
    const order = window.getAdminOrderById(orderId);
    const rawPhone = document.getElementById('delivery-note-phone')?.value || '';
    const phone = window.normalizePhone(rawPhone);
    const deliveryCost = Math.max(0, Number(document.getElementById('delivery-note-fee')?.value || 0));
    const deliveryDate = document.getElementById('delivery-note-date')?.value || '';
    const err = document.getElementById('delivery-note-error');
    if (err) { err.classList.add('hidden'); err.textContent = ''; }
    if (!order) {
        if (err) { err.textContent = 'No se encontró el pedido. Actualiza el panel e intenta nuevamente.'; err.classList.remove('hidden'); }
        return;
    }
    if (!phone || phone.length < 10) {
        if (err) { err.textContent = 'Agrega un número de WhatsApp válido para enviar la nota de entrega.'; err.classList.remove('hidden'); }
        return;
    }
    if (deliveryCost < 0 || Number.isNaN(deliveryCost)) {
        if (err) { err.textContent = 'Coloca un costo de delivery válido.'; err.classList.remove('hidden'); }
        return;
    }

    const payload = window.getDeliveryNotePayload(order);
    payload.deliveryCost = deliveryCost;
    payload.finalTotal = payload.productTotal - (payload.discountAmount || 0) + deliveryCost;
    payload.deliveryDate = deliveryDate;
    payload.deliveryDateLabel = window.getDeliveryDateLabel(deliveryDate);
    const message = window.getWhatsAppTemplate('deliveryNote', payload);
    const totalWithDelivery = payload.finalTotal;

    if (db && order.id && !String(order.id).startsWith('local_')) {
        try {
            await setDoc(window.getOrderDocRef(order.id), {
                deliveryCost,
                totalWithDelivery,
                deliveryDate,
                phone,
                telefono: phone,
                deliveryNoteMessage: message,
                deliveryNoteSentAt: new Date().toISOString()
            }, { merge: true });
            if (order.uid && order.uid !== 'anonimo') {
                await setDoc(window.getUserPath(order.uid), {
                    phone,
                    telefono: phone,
                    whatsapp: phone,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        } catch (error) {
            console.warn('No se pudo guardar la nota de entrega en Firebase:', error);
        }
    }

    try {
        window.updateDeliveryNotePreview?.();
        const canvas = await window.getDeliveryNoteCanvas();
        const blob = await window.canvasToBlob(canvas);
        const fileName = window.getDeliveryNoteFileName(order);
        const file = blob ? new File([blob], fileName, { type: 'image/jpeg' }) : null;

        const ua = navigator.userAgent || '';
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
        let sharedDirectly = false;

        if (isMobile && file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
            try {
                await navigator.share({
                    title: 'Nota de entrega Milkarf',
                    text: message,
                    files: [file]
                });
                sharedDirectly = true;
                window.showToast?.('Nota visual enviada con éxito.', 'success');
            } catch (shareErr) {
                console.log('Compartición nativa cancelada o no disponible, usando descarga + WhatsApp:', shareErr);
            }
        }

        if (!sharedDirectly) {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
            }
            window.openWhatsAppMessage(message, phone);
            window.showToast?.('Imagen descargada. Se abrió WhatsApp con el resumen del pedido para adjuntar la nota.', 'success');
        }
    } catch (imageError) {
        console.warn('No se pudo generar o compartir la nota visual. Se enviará texto de respaldo:', imageError);
        window.openWhatsAppMessage(message, phone);
        window.showToast?.('No se pudo generar la imagen. Se abrió WhatsApp con el texto del pedido.', 'success');
    }
    window.closeDeliveryNoteModal();
};

window.renderStatusBadge = function (status) {
    const info = window.getOrderStatusInfo(status);
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${info.classes}"><span class="w-2 h-2 rounded-full ${info.bar}"></span>${info.label}</span>`;
};

// Reemplazo del flujo de entrada admin: entra al resumen, no fuerza pedidos directamente.
window.enterAdminMode = function ({ navigate = true, load = true } = {}) {
    window.isAdmin = true;
    window.isRegisteringPet = false;
    const mainNav = document.getElementById('main-nav-links');
    const adminNav = document.getElementById('admin-nav-links');
    const topAuth = document.getElementById('top-auth-btn-wrap');
    const authMenu = document.getElementById('auth-dropdown-menu');
    const bienvenida = document.getElementById('modal-bienvenida');
    const descuento = document.getElementById('modal-descuento');
    if (mainNav) mainNav.classList.add('hidden');
    if (adminNav) adminNav.classList.remove('hidden');
    if (topAuth) topAuth.style.display = 'none';
    if (authMenu) { authMenu.classList.add('hidden', 'opacity-0', 'scale-95'); authMenu.classList.remove('opacity-100', 'scale-100'); }
    if (bienvenida) { bienvenida.classList.add('hidden', 'opacity-0'); bienvenida.classList.remove('flex'); document.getElementById('modal-bienvenida-box')?.classList.add('scale-95'); }
    if (descuento) { descuento.classList.add('hidden', 'opacity-0'); descuento.classList.remove('flex'); document.getElementById('modal-descuento-box')?.classList.add('scale-95'); }
    window.cerrarModalAdmin?.();
    window.cerrarModalCanje?.();
    window.forceCloseMenu?.();
    if (navigate) window.navigateTo('view-admin');
    if (load) setTimeout(() => window.switchAdminTab?.('resumen'), 60);
    window.refreshIcons?.();
};

window.switchAdminTab = function (tab = 'resumen') {
    if (!window.isAdmin) { window.showToast('Debes iniciar sesión como administrador.'); return; }
    if (tab === 'calc') tab = 'calculadora';
    const valid = ['resumen', 'pedidos', 'usuarios', 'canjes', 'cumples', 'herramientas', 'calculadora'];
    if (!valid.includes(tab)) tab = 'resumen';
    window.adminCurrentTab = tab;
    valid.forEach(t => {
        const btn = document.getElementById(`tab-admin-${t}`);
        const panelId = t === 'resumen' ? 'admin-summary-container' : t === 'usuarios' ? 'admin-users-container' : t === 'canjes' ? 'admin-redeems-container' : t === 'cumples' ? 'admin-birthdays-container' : t === 'herramientas' ? 'admin-tools-container' : t === 'calculadora' ? 'admin-calc-container' : 'admin-orders-container';
        const panel = document.getElementById(panelId);
        if (btn) btn.className = `admin-tab-btn text-xs font-black px-4 py-3 rounded-2xl whitespace-nowrap transition-all ${t === tab ? window.adminTabActiveClass : window.adminTabInactiveClass}`;
        if (panel) panel.classList.toggle('hidden', t !== tab);
    });
    if (tab === 'resumen') window.loadAdminSummary();
    if (tab === 'pedidos') window.loadAdminOrders();
    if (tab === 'usuarios') window.loadAdminUsers();
    if (tab === 'canjes') window.loadAdminRedeems();
    if (tab === 'cumples') window.loadAdminBirthdays();
    if (tab === 'herramientas') window.loadAdminTools();
    if (tab === 'calculadora') window.loadAdminCalculadora();
    window.refreshIcons?.();
};

window.loadAdminSummary = async function () {
    window.ensureAdminSummaryHelpers?.();
    const container = document.getElementById('admin-summary-container');
    if (!container) return;
    if (!window.isAdmin) { container.innerHTML = window.adminEmptyState('Acceso restringido', 'Debes iniciar sesión como administrador para ver el resumen.', 'lock'); return; }
    if (!db) { container.innerHTML = window.adminEmptyState('Firebase no disponible', 'No se pudo conectar con la base de datos.', 'wifi-off'); return; }
    container.innerHTML = window.adminLoadingState('Preparando resumen operativo...');
    try {
        const [ordersSnap, usersSnap, redeemsSnap] = await Promise.all([
            getDocs(window.secureAdminQuery(window.getOrdersCollectionRef())),
            getDocs(window.secureAdminQuery(window.getUsersCollectionRef())),
            getDocs(window.secureAdminQuery(window.getRedeemsCollectionRef())).catch(() => ({ forEach: () => { } }))
        ]);
        const orders = []; ordersSnap.forEach(d => orders.push({ id: d.id, ...d.data() }));
        const users = []; usersSnap.forEach(d => users.push({ id: d.id, ...d.data() }));
        const redeems = []; redeemsSnap.forEach(d => redeems.push({ id: d.id, ...d.data() }));
        window.adminCache = { orders, users, redeems };
        const inProcess = orders.filter(o => ['pendiente', 'en_proceso', 'solicitado'].includes(String(o.status || 'en_proceso').toLowerCase())).length;
        const confirmed = orders.filter(o => ['confirmado', 'verificado'].includes(String(o.status || '').toLowerCase())).length;
        const completed = orders.filter(o => String(o.status || '').toLowerCase() === 'completado').length;
        const pendingRedeems = redeems.filter(r => ['solicitado', 'pendiente'].includes(String(r.status || 'solicitado').toLowerCase())).length;
        const upcoming = window.computeAdminBirthdays(users).filter(p => p.daysLeft <= 30).length;
        const recentOrders = orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4);
        const urgentRedeems = redeems.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3);
        const totalCompleted = orders.filter(o => String(o.status || '').toLowerCase() === 'completado').reduce((sum, o) => sum + Number(o.totalWithDelivery || o.total || 0), 0);
        const kpi = [
            { label: 'En proceso', value: inProcess, icon: 'clock-3', color: 'text-pink', bg: 'bg-pink/10', tab: 'pedidos', filter: 'en_proceso' },
            { label: 'Confirmados', value: confirmed, icon: 'check-circle', color: 'text-green-dark dark:text-green', bg: 'bg-green/15', tab: 'pedidos', filter: 'confirmado' },
            { label: 'Completados', value: completed, icon: 'badge-check', color: 'text-purple', bg: 'bg-purple/10', tab: 'pedidos', filter: 'completado' },
            { label: 'Ventas completadas', value: '$' + totalCompleted.toFixed(2), icon: 'trending-up', color: 'text-green-dark dark:text-green', bg: 'bg-green/15', tab: 'pedidos', filter: 'completado' },
            { label: 'Clientes', value: users.length, icon: 'users', color: 'text-purple', bg: 'bg-purple/10', tab: 'usuarios' },
            { label: 'Canjes pendientes', value: pendingRedeems, icon: 'gift', color: 'text-pink', bg: 'bg-pink/10', tab: 'canjes' }
        ];
        container.innerHTML = `
                    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
                        ${kpi.map(i => `<button onclick="${i.filter ? `window.applyAdminOrderFilter('${i.filter}')` : `window.switchAdminTab('${i.tab}')`}" class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-4 text-left shadow-sm hover:shadow-md transition-all active:scale-95">
                            <div class="w-10 h-10 rounded-2xl ${i.bg} ${i.color} flex items-center justify-center mb-3"><i data-lucide="${i.icon}" class="w-5 h-5"></i></div>
                            <p class="text-2xl font-black text-purple-dark dark:text-white leading-none">${i.value}</p>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2 leading-tight">${i.label}</p>
                        </button>`).join('')}
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm">
                            <div class="flex justify-between items-center mb-4"><h3 class="text-lg font-black text-purple-dark dark:text-white">Pedidos recientes</h3><button onclick="window.switchAdminTab('pedidos')" class="text-[10px] font-black text-purple uppercase tracking-widest">Ver todos</button></div>
                            <div class="space-y-3">${recentOrders.length ? recentOrders.map(o => window.buildAdminMiniOrder(o)).join('') : window.adminEmptyState('Sin pedidos todavía', 'Cuando entren pedidos, aparecerán aquí.', 'clipboard-list')}</div>
                        </div>
                        <div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm">
                            <div class="flex justify-between items-center mb-4"><h3 class="text-lg font-black text-purple-dark dark:text-white">Canjes recientes</h3><button onclick="window.switchAdminTab('canjes')" class="text-[10px] font-black text-purple uppercase tracking-widest">Gestionar</button></div>
                            <div class="space-y-3">${urgentRedeems.length ? urgentRedeems.map(r => window.buildAdminRedeemMini(r)).join('') : window.adminEmptyState('Sin canjes pendientes', 'Las solicitudes de puntos aparecerán aquí.', 'gift')}</div>
                        </div>
                    </div>
                `;
        window.refreshIcons?.(container);
    } catch (e) {
        console.error(e);
        container.innerHTML = window.adminEmptyState('No se pudo cargar el resumen', 'Revisa la conexión o los permisos de Firestore.', 'alert-triangle');
    }
};

window.buildAdminMiniOrder = function (o) {
    const items = Array.isArray(o.items) ? o.items.map(i => `${Number(i.qty || 0)}x ${i.name || 'Producto'}`).join(' · ') : 'Pedido Milkarf';
    return `<div class="rounded-2xl border border-purple-border/30 dark:border-purple/20 bg-purple-light/40 dark:bg-[#0d0718] p-4 text-left">
                <div class="flex justify-between items-start gap-3"><div class="min-w-0"><p class="text-sm font-black text-purple-dark dark:text-white truncate">${window.escapeHTML(window.capitalizeName(o.userName || o.email || 'Usuario'))}</p><p class="text-[10px] text-gray-500 font-bold mt-1 truncate">${window.escapeHTML(items)}</p></div>${window.renderStatusBadge(o.status)}</div>
                <p class="text-[10px] text-gray-400 font-bold mt-2">${window.formatAdminDate(o.createdAt)} · $${Number(o.total || 0).toFixed(2)}</p>
            </div>`;
};

window.buildAdminRedeemMini = function (r) {
    return `<div class="rounded-2xl border border-purple-border/30 dark:border-purple/20 bg-purple-light/40 dark:bg-[#0d0718] p-4 text-left">
                <div class="flex justify-between gap-3"><div><p class="text-sm font-black text-purple-dark dark:text-white">${window.escapeHTML(r.itemName || r.benefit || 'Canje Milkarf')}</p><p class="text-[10px] text-gray-500 font-bold mt-1">${window.escapeHTML(window.capitalizeName(r.userName || r.email || 'Cliente'))} · ${Number(r.points || 0)} ptos</p></div><span class="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-pink/10 text-pink border border-pink/20 h-fit">${window.escapeHTML(r.status || 'solicitado')}</span></div>
            </div>`;
};

window.loadAdminOrders = function () {
    const container = document.getElementById('admin-orders-container');
    if (!window.isAdmin) { if (container) container.innerHTML = window.adminEmptyState('Acceso restringido', 'Debes iniciar sesión como administrador.', 'lock'); return; }
    if (!db) { if (container) container.innerHTML = window.adminEmptyState('Firebase no disponible', 'No se pudo conectar con la base de datos.', 'wifi-off'); return; }
    if (!container) return;
    if (unsubAdmin) { unsubAdmin(); unsubAdmin = null; }
    container.innerHTML = window.adminLoadingState('Sincronizando pedidos...');
    unsubAdmin = onSnapshot(window.secureAdminQuery(window.getOrdersCollectionRef()), (snapshot) => {
        const orders = [];
        snapshot.forEach(docSnap => orders.push({ id: docSnap.id, ...docSnap.data() }));
        orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        window.adminCache.orders = orders;
        window.renderAdminOrdersPanel();
    }, (error) => {
        console.error('Error cargando pedidos admin:', error);
        container.innerHTML = window.adminEmptyState('Error al cargar pedidos', 'Verifica permisos de Firebase/Firestore.', 'alert-triangle');
    });
};

window.renderAdminOrdersPanel = function () {
    const container = document.getElementById('admin-orders-container');
    if (!container) return;
    container.innerHTML = `
                <div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm space-y-4">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div><h3 class="text-xl font-black text-purple-dark dark:text-white">Control de pedidos</h3><p class="text-xs text-gray-500 font-semibold mt-1">Filtra, confirma, contacta y completa pedidos.</p></div>
                        <button onclick="window.loadAdminOrders()" class="inline-flex items-center justify-center gap-2 bg-purple-light dark:bg-purple/20 text-purple dark:text-white font-black text-[10px] uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-purple hover:text-white transition-all"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Actualizar</button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input id="admin-order-search" type="search" placeholder="Buscar cliente, producto o mascota" oninput="window.filterAdminOrders()" class="md:col-span-2 bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-2xl p-3 text-sm font-semibold outline-none focus:border-purple">
                        <select id="admin-order-status-filter" onchange="window.filterAdminOrders()" class="bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-2xl p-3 text-sm font-bold outline-none focus:border-purple">
                            <option value="todos">Todos los estados</option><option value="en_proceso">En proceso</option><option value="confirmado">Confirmados</option><option value="completado">Completados</option><option value="cancelado">Cancelados</option>
                        </select>
                        <select id="admin-order-date-filter" onchange="window.filterAdminOrders()" class="bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-2xl p-3 text-sm font-bold outline-none focus:border-purple">
                            <option value="todos">Todas las fechas</option><option value="hoy">Hoy</option><option value="7d">Últimos 7 días</option>
                        </select>
                    </div>
                </div>
                <div id="admin-orders-list" class="space-y-4"></div>`;
    window.filterAdminOrders();
    window.refreshIcons?.(container);
};

window.filterAdminOrders = function () {
    const list = document.getElementById('admin-orders-list');
    if (!list) return;
    const q = (document.getElementById('admin-order-search')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('admin-order-status-filter')?.value || 'todos';
    const dateFilter = document.getElementById('admin-order-date-filter')?.value || 'todos';
    const now = new Date();
    let orders = [...(window.adminCache.orders || [])];
    if (q) {
        orders = orders.filter(o => {
            const hay = [o.userName, o.email, o.phone, o.telefono, o.id, ...(Array.isArray(o.items) ? o.items.flatMap(i => [i.name, i.weight, i.forPet]) : [])].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }
    if (statusFilter !== 'todos') {
        orders = orders.filter(o => {
            const s = String(o.status || 'en_proceso').toLowerCase();
            if (statusFilter === 'en_proceso') return ['pendiente', 'en_proceso', 'solicitado'].includes(s);
            if (statusFilter === 'confirmado') return ['confirmado', 'verificado'].includes(s);
            return s === statusFilter;
        });
    }
    if (dateFilter !== 'todos') {
        orders = orders.filter(o => {
            const d = new Date(o.createdAt || 0);
            if (isNaN(d.getTime())) return false;
            const diffDays = (now - d) / 86400000;
            if (dateFilter === 'hoy') return d.toDateString() === now.toDateString();
            if (dateFilter === '7d') return diffDays <= 7;
            return true;
        });
    }
    if (!orders.length) { list.innerHTML = window.adminEmptyState('Sin pedidos con esos filtros', 'Ajusta la búsqueda o cambia el estado seleccionado.', 'search'); return; }
    list.innerHTML = orders.map(o => window.buildAdminOrderCard(o)).join('');
    window.refreshIcons?.(list);
};

window.clearAdminOrderFilter = function () {
    window.vibrate?.(10);
    window.adminOrderFilter = null;
    const search = document.getElementById('admin-order-search');
    const status = document.getElementById('admin-order-status-filter');
    const date = document.getElementById('admin-order-date-filter');
    if (search) search.value = '';
    if (status) status.value = 'todos';
    if (date) date.value = 'todos';
    window.filterAdminOrders?.();
    const container = document.getElementById('admin-orders-container');
    if (container && window.adminCache?.orders?.length) window.renderAdminOrders(window.adminCache.orders);
};

window.buildAdminOrderCard = function (o) {
    const status = String(o.status || 'en_proceso').toLowerCase();
    const totalNumber = Number(o.total || 0);
    const pts = Math.floor(totalNumber);
    const items = Array.isArray(o.items) ? o.items.map(i => `<li class="flex justify-between gap-3 text-xs"><span><strong>${Number(i.qty || 0)}x</strong> ${window.escapeHTML(i.name || 'Producto')} ${i.weight ? `(${window.escapeHTML(i.weight)})` : ''} ${i.forPet ? `<em class="text-purple/50 dark:text-gray-500">para ${window.escapeHTML(i.forPet)}</em>` : ''}</span><span class="font-black text-purple-dark dark:text-white">$${(Number(i.price || 0) * Number(i.qty || 0)).toFixed(2)}</span></li>`).join('') : '<li class="text-xs text-gray-500">Pedido sin detalle</li>';
    let primary = '';
    if (['pendiente', 'en_proceso', 'solicitado'].includes(status)) {
        primary = `<button onclick="window.marcarConfirmadoAdmin('${o.id}')" class="bg-blue-500 text-white text-[10px] font-black px-4 py-3 rounded-xl shadow-md hover:bg-blue-600 transition-all flex items-center gap-2 justify-center"><i data-lucide="check-circle" class="w-4 h-4"></i> Confirmar pedido</button>`;
    } else if (['confirmado', 'verificado'].includes(status)) {
        primary = (o.registeredUser === true && o.uid && o.uid !== 'anonimo')
            ? `<button onclick="window.aprobarPedidoAdmin('${o.id}', '${o.uid}', ${pts})" class="bg-green text-purple-dark text-[10px] font-black px-4 py-3 rounded-xl shadow-md hover:bg-[#a6b621] transition-all flex items-center gap-2 justify-center"><i data-lucide="check-square" class="w-4 h-4"></i> Completar + puntos</button>`
            : `<button onclick="window.marcarCompletadoAdmin('${o.id}')" class="bg-purple text-white text-[10px] font-black px-4 py-3 rounded-xl shadow-md hover:bg-pink transition-all flex items-center gap-2 justify-center"><i data-lucide="check-square" class="w-4 h-4"></i> Completar</button>`;
    }
    const canCancel = !['completado', 'cancelado'].includes(status);
    return `<div class="bg-white dark:bg-darkcard rounded-3xl p-5 shadow-sm border border-purple-border/50 dark:border-purple/20 text-left relative overflow-hidden">
                <div class="absolute top-0 left-0 w-1 h-full ${window.getOrderStatusInfo(status).bar}"></div>
                <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 pl-2">
                    <div class="min-w-0"><div class="flex items-center gap-2 flex-wrap mb-2">${window.renderStatusBadge(status)}<span class="text-[9px] font-black uppercase tracking-widest text-gray-400">#${window.escapeHTML(o.id.slice(0, 8))}</span></div><h4 class="font-black text-purple-dark dark:text-white text-base leading-tight truncate">${window.escapeHTML(window.capitalizeName(o.userName || o.email || 'Usuario Invitado'))}</h4><p class="text-[10px] text-gray-500 font-bold mt-1">${window.formatAdminDate(o.createdAt)}</p></div>
                    <div class="text-left md:text-right shrink-0"><span class="text-[10px] text-gray-400 font-black uppercase tracking-widest block">Total</span><span class="font-black text-purple dark:text-white text-2xl">$${totalNumber.toFixed(2)}</span>${o.descuentoAplicado ? '<p class="text-[9px] font-black text-pink uppercase tracking-widest">20% aplicado</p>' : ''}${Number(o.pointsAwarded || o.pointsGranted || 0) > 0 ? `<p class="text-[9px] font-black text-green-dark dark:text-green uppercase tracking-widest mt-1">+${Number(o.pointsAwarded || o.pointsGranted || 0)} ptos</p>` : ''}</div>
                </div>
                <div class="bg-purple-light/70 dark:bg-[#0d0718] rounded-2xl p-4 my-4 border border-purple-border/30 dark:border-purple/20 ml-2"><ul class="space-y-2">${items}</ul></div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 ml-2">
                    ${primary}
                    <a href="${window.getAdminContactLink(o)}" target="_blank" class="bg-[#25D366]/15 border border-[#25D366]/30 text-[#168d43] dark:text-green text-[10px] font-black px-4 py-3 rounded-xl transition-all flex items-center gap-2 justify-center"><i data-lucide="message-circle" class="w-4 h-4"></i> WhatsApp</a>
                    <button onclick="window.openDeliveryNoteModal('${o.id}')" class="bg-green/15 border border-green/25 text-green-dark dark:text-green text-[10px] font-black px-4 py-3 rounded-xl transition-all flex items-center gap-2 justify-center"><i data-lucide="truck" class="w-4 h-4"></i> Nota entrega</button>
                    ${canCancel ? `<button onclick="window.cancelarPedidoAdmin('${o.id}')" class="bg-pink/10 border border-pink/20 text-pink text-[10px] font-black px-4 py-3 rounded-xl transition-all flex items-center gap-2 justify-center"><i data-lucide="x-circle" class="w-4 h-4"></i> Cancelar</button>` : ''}
                </div>
            </div>`;
};

window.loadAdminUsers = async function () {
    const container = document.getElementById('admin-users-container');
    if (!window.isAdmin) { if (container) container.innerHTML = window.adminEmptyState('Acceso restringido', 'Debes iniciar sesión como administrador.', 'lock'); return; }
    if (!db) { if (container) container.innerHTML = window.adminEmptyState('Firebase no disponible', 'No se pudo conectar con la base de datos.', 'wifi-off'); return; }
    if (!container) return;
    container.innerHTML = window.adminLoadingState('Cargando clientes...');
    try {
        const snapshot = await getDocs(window.secureAdminQuery(window.getUsersCollectionRef()));
        const users = [];
        snapshot.forEach(docSnap => users.push({ id: docSnap.id, ...docSnap.data() }));
        users.sort((a, b) => (b.puntos_historicos || b.puntos || 0) - (a.puntos_historicos || a.puntos || 0));
        window.adminCache.users = users;
        window.renderAdminUsersPanel();
    } catch (e) {
        console.error(e);
        container.innerHTML = window.adminEmptyState('Error al cargar clientes', 'Verifica permisos de Firebase/Firestore.', 'alert-triangle');
    }
};

window.renderAdminUsersPanel = function () {
    const container = document.getElementById('admin-users-container');
    if (!container) return;
    container.innerHTML = `
                <div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm space-y-4">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><h3 class="text-xl font-black text-purple-dark dark:text-white">Clientes registrados</h3><p class="text-xs text-gray-500 font-semibold mt-1">Ficha rápida de puntos, mascotas y acciones.</p></div><button onclick="window.loadAdminUsers()" class="inline-flex items-center justify-center gap-2 bg-purple-light dark:bg-purple/20 text-purple dark:text-white font-black text-[10px] uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-purple hover:text-white transition-all"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Actualizar</button></div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3"><input id="admin-user-search" type="search" placeholder="Buscar cliente, correo o mascota" oninput="window.filterAdminUsers()" class="md:col-span-2 bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-2xl p-3 text-sm font-semibold outline-none focus:border-purple"><select id="admin-user-level-filter" onchange="window.filterAdminUsers()" class="bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-2xl p-3 text-sm font-bold outline-none focus:border-purple"><option value="todos">Todos los niveles</option><option value="cachorro">Cachorro</option><option value="consentido">Consentido</option><option value="vip">VIP</option></select></div>
                </div><div id="admin-users-list" class="space-y-4"></div>`;
    window.filterAdminUsers();
    window.refreshIcons?.(container);
};

window.filterAdminUsers = function () {
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    const q = (document.getElementById('admin-user-search')?.value || '').trim().toLowerCase();
    const level = document.getElementById('admin-user-level-filter')?.value || 'todos';
    let users = [...(window.adminCache.users || [])];
    if (q) users = users.filter(u => [u.email, u.nombre, u.name, ...(Array.isArray(u.mascotas) ? u.mascotas.flatMap(m => [m.nombre, m.raza, m.tipo]) : [])].join(' ').toLowerCase().includes(q));
    if (level !== 'todos') users = users.filter(u => {
        const ptsHist = Number(u.puntos_historicos || u.puntos || 0);
        const l = window.getLevelInfo(ptsHist).nombre.toLowerCase();
        if (level === 'vip') return l.includes('vip');
        return l.includes(level);
    });
    if (!users.length) { list.innerHTML = window.adminEmptyState('Sin clientes con esos filtros', 'Ajusta la búsqueda o cambia el nivel.', 'search'); return; }
    list.innerHTML = users.map(u => window.buildAdminUserCard(u)).join('');
    window.refreshIcons?.(list);
};

window.buildAdminUserCard = function (u) {
    const email = u.email || 'Sin correo registrado';
    const ptsDisp = Number(u.puntos || 0);
    const ptsHist = Number(u.puntos_historicos || ptsDisp || 0);
    const levelObj = window.getLevelInfo(ptsHist);
    const pets = Array.isArray(u.mascotas) ? u.mascotas : [];
    const mascotas = pets.map(m => {
        const calc = window.getPetCalcData ? window.getPetCalcData(m) : null;
        return `<div class="bg-purple/5 dark:bg-purple/10 p-3 rounded-xl border border-purple/10"><p class="font-black text-purple-dark dark:text-white text-xs">${m.tipo === 'gato' ? '🐱' : '🐶'} ${window.escapeHTML(m.nombre || 'Mascota')}</p><p class="text-[10px] text-gray-500 font-bold mt-1">${window.escapeHTML(m.peso || '-')}kg · ${window.escapeHTML(m.edad || m.etapa || 'Sin etapa')} ${m.cumple ? `· Nac: ${window.escapeHTML(m.cumple)}` : ''}</p>${calc ? `<p class="text-[10px] text-green-dark dark:text-green font-black mt-2">Porción orientativa: ${Number(calc.gramos || 0)}g/día · ${Number(calc.comidas || 0)} comidas</p>` : ''}</div>`;
    }).join('');
    return `<div class="bg-white dark:bg-darkcard rounded-3xl p-5 shadow-sm border border-purple-border/50 dark:border-purple/20 text-left">
                <div class="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
                    <div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><h4 class="font-black text-purple-dark dark:text-white text-base truncate">${window.escapeHTML(email)}</h4><span class="text-[9px] font-black uppercase tracking-widest bg-purple-light dark:bg-purple/20 text-purple dark:text-white px-2 py-1 rounded-lg border border-purple/20">${window.escapeHTML(levelObj.nombre)}</span></div><p class="text-[10px] text-gray-500 font-bold mt-1">Histórico: ${ptsHist} ptos · Disponibles: ${ptsDisp} ptos</p></div>
                    <div class="grid grid-cols-2 sm:flex gap-2"><button onclick="window.abrirModalSumarPuntos('${u.id}', '${window.escapeHTML(email)}', ${ptsDisp})" class="text-[10px] bg-purple hover:bg-purple-dark text-white px-3 py-2.5 rounded-xl font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-1 justify-center"><i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> + Puntos</button><button onclick="window.abrirModalCanje('${u.id}', '${window.escapeHTML(email)}', ${ptsDisp})" class="text-[10px] bg-green hover:bg-[#a6b621] text-purple-dark px-3 py-2.5 rounded-xl font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-1 justify-center"><i data-lucide="gift" class="w-3.5 h-3.5"></i> Canjear</button><button onclick="window.eliminarUsuarioAdmin('${u.id}', '${window.escapeHTML(email)}')" class="text-[10px] bg-pink/10 hover:bg-pink text-pink hover:text-white px-3 py-2.5 rounded-xl font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-1 border border-pink/20 justify-center"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar</button></div>
                </div><div class="mt-4 border-t border-purple/10 pt-4"><p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Mascotas (${pets.length})</p><div class="grid grid-cols-1 md:grid-cols-2 gap-2">${mascotas || '<p class="text-xs text-gray-400 italic font-medium">Sin mascotas registradas</p>'}</div></div>
            </div>`;
};

window.computeAdminBirthdays = function (users = []) {
    const petBirthdays = [];
    const today = new Date();
    const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    users.forEach(u => {
        const list = Array.isArray(u.mascotas) ? u.mascotas : [];
        if (!list.length && u.petName && (u.petCumple || u.petBirthDate)) {
            list.push({ nombre: u.petName, cumple: u.petCumple || u.petBirthDate, tipo: u.petType || 'perro' });
        }
        list.forEach(m => {
            const rawDate = m.cumple || m.birthDate || m.fechaNacimiento || m.nacimiento;
            if (rawDate && typeof rawDate === 'string') {
                let mo = 0, d = 0, y = 0;
                const cleaned = rawDate.trim().replace(/\//g, '-');
                const parts = cleaned.split('-').map(Number);
                if (parts.length === 3) {
                    if (parts[0] > 1900) {
                        y = parts[0]; mo = parts[1]; d = parts[2];
                    } else {
                        d = parts[0]; mo = parts[1]; y = parts[2];
                    }
                }
                if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
                    let nextBday = new Date(today.getFullYear(), mo - 1, d);
                    if (nextBday < todayNoTime) nextBday.setFullYear(today.getFullYear() + 1);
                    const diffDays = Math.ceil((nextBday - todayNoTime) / 86400000);
                    petBirthdays.push({
                        ownerEmail: u.email || 'Sin correo',
                        ownerName: u.nombre || u.name || '',
                        petName: m.nombre || 'Mascota',
                        petType: m.tipo || 'perro',
                        bdayString: rawDate,
                        daysLeft: diffDays,
                        points: u.puntos || 0,
                        level: window.getLevelInfo(Number(u.puntos_historicos || u.puntos || 0)).nombre
                    });
                }
            }
        });
    });
    return petBirthdays.sort((a, b) => a.daysLeft - b.daysLeft);
};

window.loadAdminBirthdays = async function () {
    const container = document.getElementById('admin-birthdays-container');
    if (!window.isAdmin) { if (container) container.innerHTML = window.adminEmptyState('Acceso restringido', 'Debes iniciar sesión como administrador.', 'lock'); return; }
    if (!db) { if (container) container.innerHTML = window.adminEmptyState('Firebase no disponible', 'No se pudo conectar con la base de datos.', 'wifi-off'); return; }
    if (!container) return;
    container.innerHTML = window.adminLoadingState('Analizando cumpleaños...');
    try {
        const snapshot = await getDocs(window.secureAdminQuery(window.getUsersCollectionRef()));
        const users = []; snapshot.forEach(d => users.push({ id: d.id, ...d.data() }));
        const all = window.computeAdminBirthdays(users);
        const groups = [
            { title: '🎉 ¡Hoy cumplen!', items: all.filter(p => p.daysLeft === 0) },
            { title: '⏰ Próximos 7 días', items: all.filter(p => p.daysLeft > 0 && p.daysLeft <= 7) },
            { title: '📅 Próximos 30 días', items: all.filter(p => p.daysLeft > 7 && p.daysLeft <= 30) },
            { title: '🎂 Más adelante en el año', items: all.filter(p => p.daysLeft > 30) }
        ];
        if (!all.length) { container.innerHTML = window.adminEmptyState('Sin fechas registradas', 'Cuando los clientes agreguen el cumpleaños de sus mascotas, aparecerán aquí ordenados.', 'cake'); return; }
        container.innerHTML = groups.map(g => g.items.length ? `<div class="space-y-3"><h3 class="text-lg font-black text-purple-dark dark:text-white px-1">${g.title} (${g.items.length})</h3>${g.items.map(p => window.buildAdminBirthdayCard(p)).join('')}</div>` : '').join('');
        window.refreshIcons?.(container);
    } catch (e) { console.error(e); container.innerHTML = window.adminEmptyState('Error al cargar cumpleaños', 'Revisa permisos de Firebase/Firestore.', 'alert-triangle'); }
};

window.buildAdminBirthdayCard = function (p) {
    const msg = window.getWhatsAppTemplate('birthday', { petName: p.petName });
    const link = window.buildWhatsAppUrl(msg);
    const isNear = p.daysLeft <= 7;
    return `<div class="bg-white dark:bg-darkcard rounded-3xl p-5 shadow-sm border ${isNear ? 'border-pink/40' : 'border-purple-border/40 dark:border-purple/20'} text-left">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h4 class="font-black ${isNear ? 'text-pink' : 'text-purple-dark dark:text-white'} text-base">${p.petType === 'gato' ? '🐱' : '🐶'} ${window.escapeHTML(p.petName)}</h4><p class="text-[10px] text-gray-500 font-bold mt-1">Tutor: ${window.escapeHTML(p.ownerEmail)} · ${window.escapeHTML(p.level || '')}</p><p class="text-[10px] text-gray-400 font-bold mt-1">Nacimiento: ${window.escapeHTML(p.bdayString)}</p></div><div class="flex gap-2"><span class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isNear ? 'bg-pink text-white' : 'bg-purple/5 text-purple'}">${p.daysLeft === 0 ? '¡Hoy!' : (p.daysLeft === 1 ? 'Mañana' : `En ${p.daysLeft} días`)}</span><a href="${link}" target="_blank" class="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#25D366]/15 text-[#168d43] dark:text-green border border-[#25D366]/30">WhatsApp</a></div></div>
            </div>`;
};

window.loadAdminRedeems = async function () {
    const container = document.getElementById('admin-redeems-container');
    if (!window.isAdmin) { if (container) container.innerHTML = window.adminEmptyState('Acceso restringido', 'Debes iniciar sesión como administrador.', 'lock'); return; }
    if (!db) { if (container) container.innerHTML = window.adminEmptyState('Firebase no disponible', 'No se pudo conectar con la base de datos.', 'wifi-off'); return; }
    if (!container) return;
    container.innerHTML = window.adminLoadingState('Cargando canjes...');
    try {
        const snap = await getDocs(window.secureAdminQuery(window.getRedeemsCollectionRef()));
        const redeems = []; snap.forEach(d => redeems.push({ id: d.id, ...d.data() }));
        redeems.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        window.adminCache.redeems = redeems;
        window.renderAdminRedeemsPanel();
    } catch (e) { console.error(e); container.innerHTML = window.adminEmptyState('Error al cargar canjes', 'Faltan permisos de lectura/escritura para la colección canjes en Firestore. Revisa las reglas que te indico al final.', 'alert-triangle'); }
};

window.renderAdminRedeemsPanel = function () {
    const container = document.getElementById('admin-redeems-container');
    if (!container) return;
    container.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-[1.4fr_.8fr] gap-5"><div class="space-y-4"><div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm"><div class="flex justify-between items-center gap-3"><div><h3 class="text-xl font-black text-purple-dark dark:text-white">Solicitudes de canje</h3><p class="text-xs text-gray-500 font-semibold mt-1">Aprueba, marca entregado o contacta al cliente.</p></div><button onclick="window.loadAdminRedeems()" class="bg-purple-light dark:bg-purple/20 text-purple dark:text-white text-[10px] font-black px-4 py-3 rounded-xl uppercase tracking-widest">Actualizar</button></div></div><div id="admin-redeems-list" class="space-y-4"></div></div><div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm h-fit"><h3 class="text-lg font-black text-purple-dark dark:text-white mb-3">Catálogo de beneficios</h3><div class="space-y-3">${window.REDEEM_ITEMS.map(i => `<div class="bg-purple-light/70 dark:bg-[#0d0718] rounded-2xl p-4 border border-purple-border/30"><p class="text-sm font-black text-purple-dark dark:text-white">${window.escapeHTML(i.name)}</p><p class="text-xs text-gray-500 font-semibold mt-1">${window.escapeHTML(i.benefit)}</p><p class="text-[10px] font-black text-pink uppercase tracking-widest mt-2">${i.points} ptos</p></div>`).join('')}</div></div></div>`;
    window.filterAdminRedeems();
    window.refreshIcons?.(container);
};

window.filterAdminRedeems = function () {
    const list = document.getElementById('admin-redeems-list');
    if (!list) return;
    const redeems = window.adminCache.redeems || [];
    if (!redeems.length) { list.innerHTML = window.adminEmptyState('Sin solicitudes de canje', 'Cuando un cliente canjee puntos, aparecerá aquí.', 'gift'); return; }
    list.innerHTML = redeems.map(r => window.buildAdminRedeemCard(r)).join('');
    window.refreshIcons?.(list);
};

window.buildAdminRedeemCard = function (r) {
    const status = String(r.status || 'solicitado').toLowerCase();
    const statusClass = status === 'entregado' ? 'bg-purple/10 text-purple border-purple/20' : status === 'aprobado' ? 'bg-green/20 text-green-dark dark:text-green border-green/30' : status === 'rechazado' ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-pink/10 text-pink border-pink/20';
    const msg = window.getWhatsAppTemplate('adminRedeemContact', {
        itemName: r.itemName || '',
        benefit: r.benefit || '',
        points: r.points || 0
    });
    const w = window.buildWhatsAppUrl(msg);
    return `<div class="bg-white dark:bg-darkcard rounded-3xl p-5 shadow-sm border border-purple-border/50 dark:border-purple/20 text-left"><div class="flex flex-col md:flex-row md:items-start justify-between gap-4"><div><span class="inline-flex px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${statusClass}">${window.escapeHTML(status)}</span><h4 class="font-black text-purple-dark dark:text-white text-base mt-3">${window.escapeHTML(r.itemName || r.benefit || 'Canje Milkarf')}</h4><p class="text-xs text-gray-500 font-bold mt-1">${window.escapeHTML(window.capitalizeName(r.userName || r.email || 'Cliente'))} · ${Number(r.points || 0)} ptos</p><p class="text-[10px] text-gray-400 font-bold mt-1">${window.formatAdminDate(r.createdAt)}</p></div><div class="grid grid-cols-1 sm:grid-cols-3 gap-2"><button onclick="window.actualizarCanjeAdmin('${r.id}', 'aprobado')" class="bg-green text-purple-dark text-[10px] font-black px-4 py-3 rounded-xl uppercase tracking-widest">Aprobar</button><button onclick="window.actualizarCanjeAdmin('${r.id}', 'entregado')" class="bg-purple text-white text-[10px] font-black px-4 py-3 rounded-xl uppercase tracking-widest">Entregado</button><a href="${w}" target="_blank" class="bg-[#25D366]/15 text-[#168d43] dark:text-green border border-[#25D366]/30 text-[10px] font-black px-4 py-3 rounded-xl uppercase tracking-widest text-center">WhatsApp</a></div></div></div>`;
};

window.actualizarCanjeAdmin = async function (redeemId, status) {
    if (!window.isAdmin) { window.showToast('Debes iniciar sesión como administrador.'); return; }
    if (!db) { window.showToast('Firebase no está disponible.'); return; }
    try {
        const ref = typeof __firebase_config !== 'undefined' ? doc(db, 'artifacts', appId, 'public', 'data', 'canjes', redeemId) : doc(db, 'canjes', redeemId);
        await setDoc(ref, { status, updatedAt: new Date().toISOString() }, { merge: true });
        window.showToast('Canje actualizado.', 'success');
        window.loadAdminRedeems();
    } catch (e) { console.error(e); window.showToast('No se pudo actualizar el canje.'); }
};

window.cancelarPedidoAdmin = async function (orderId) {
    if (!window.isAdmin) { window.showToast('Debes iniciar sesión como administrador.'); return; }
    const ok = confirm('¿Seguro que deseas cancelar este pedido?');
    if (!ok) return;
    try {
        await setDoc(window.getOrderDocRef(orderId), { status: 'cancelado', cancelledAt: new Date().toISOString() }, { merge: true });
        window.showToast('Pedido cancelado.', 'success');
    } catch (e) { console.error(e); window.showToast('No se pudo cancelar el pedido.'); }
};

window.loadAdminTools = function () {
    const container = document.getElementById('admin-tools-container');
    if (!container) return;
    container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-5"><div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-6 shadow-sm text-left"><div class="w-12 h-12 rounded-2xl bg-green/15 text-green-dark dark:text-green flex items-center justify-center mb-4"><i data-lucide="calculator" class="w-6 h-6"></i></div><h3 class="text-xl font-black text-purple-dark dark:text-white">Calculadora nutricional</h3><p class="text-xs text-gray-500 font-semibold leading-relaxed mt-2">Úsala para orientar pedidos o calcular una referencia inicial para una mascota.</p><button onclick="window.switchAdminTab('calculadora')" class="mt-5 w-full bg-green text-purple-dark font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl">Abrir calculadora</button></div><div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-6 shadow-sm text-left"><div class="w-12 h-12 rounded-2xl bg-pink/10 text-pink flex items-center justify-center mb-4"><i data-lucide="info" class="w-6 h-6"></i></div><h3 class="text-xl font-black text-purple-dark dark:text-white">Guía de estados</h3><div class="space-y-3 mt-4 text-xs font-semibold text-gray-500"><p><strong class="text-pink">En proceso:</strong> pedido recibido, pendiente por confirmar.</p><p><strong class="text-green-dark dark:text-green">Confirmado:</strong> validado por administración y con puntos otorgados si aplica.</p><p><strong class="text-purple">Completado:</strong> pedido entregado/cerrado.</p></div></div><div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-6 shadow-sm text-left md:col-span-2"><h3 class="text-xl font-black text-purple-dark dark:text-white">Acciones rápidas</h3><div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4"><button onclick="window.switchAdminTab('pedidos')" class="bg-purple-light dark:bg-purple/20 text-purple dark:text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl">Revisar pedidos</button><button onclick="window.switchAdminTab('canjes')" class="bg-green/20 text-green-dark dark:text-green font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl">Ver canjes</button><button onclick="window.cerrarSesionAdmin()" class="bg-pink/10 text-pink font-black text-xs uppercase tracking-widest py-3.5 rounded-2xl border border-pink/20">Cerrar sesión</button></div></div></div>`;
    window.refreshIcons?.(container);
};

window.loadAdminCalculadora = function () {
    const container = document.getElementById('admin-calc-container');
    if (!container) return;
    if (container.dataset.loaded === 'true') return;

    container.innerHTML = `
    <div class="max-w-2xl mx-auto bg-white dark:bg-darkcard rounded-[32px] shadow-2xl border border-purple-border/20 dark:border-purple/20 overflow-hidden text-left">
        <div class="bg-gradient-to-br from-purple-dark to-purple dark:from-[#2e1060] dark:to-[#1a0836] p-6 relative overflow-hidden select-none">
            <div class="absolute -right-6 -bottom-6 text-white/5"><i data-lucide="scale-3d" class="w-24 h-24"></i></div>
            <div class="text-[11px] font-extrabold text-green tracking-widest uppercase mb-1">Herramienta del Administrador</div>
            <div class="text-xs text-white/75 font-semibold">Calculadora Nutricional Integrada BARF para cálculo y orientación directa.</div>
        </div>

        <div class="p-6 space-y-6">
            <div class="bg-purple-light dark:bg-[#0d0718] border border-purple-border/40 dark:border-purple/20 rounded-2xl p-5 text-left">
                <div class="flex items-start gap-3">
                    <div class="w-9 h-9 rounded-full bg-green/20 text-green-dark dark:text-green flex items-center justify-center shrink-0"><i data-lucide="info" class="w-4 h-4"></i></div>
                    <div>
                        <h3 class="text-sm font-black text-purple-dark dark:text-white mb-1">Cálculo en vivo en Administración</h3>
                        <p class="text-xs leading-relaxed text-gray-600 dark:text-gray-400 font-medium">Estima las porciones y bolsas recomendadas de cualquier cliente o mascota directamente desde el panel de control sin abrir la web pública.</p>
                    </div>
                </div>
            </div>

            <!-- PASO 1: NOMBRE -->
            <div>
                <div class="text-[10px] font-bold text-purple/50 dark:text-gray-400 tracking-wider uppercase mb-3 flex items-center gap-2 text-left">
                    <span class="w-5 h-5 bg-purple dark:bg-green dark:text-darkbg text-white text-[10px] font-black rounded-full flex items-center justify-center">1</span> Nombre de la mascota o referencia
                </div>
                <input type="text" id="calc-nombre" name="calc_pet_name" autocomplete="off" autocapitalize="words" placeholder="Ej. Mascota del Cliente" class="w-full bg-purple-light dark:bg-[#0d0718] border-2 border-purple-border/50 dark:border-purple/30 rounded-2xl p-4 text-lg font-black text-purple dark:text-white outline-none focus:border-purple transition-all text-center">
            </div>

            <!-- PASO 2: ETAPA -->
            <div>
                <div class="text-[10px] font-bold text-purple/50 dark:text-gray-400 tracking-wider uppercase mb-3 flex items-center gap-2 text-left">
                    <span class="w-5 h-5 bg-purple dark:bg-green dark:text-darkbg text-white text-[10px] font-black rounded-full flex items-center justify-center">2</span> Etapa de vida
                </div>
                <div class="flex gap-2 w-full" id="etapa-group">
                    <button class="btn-opt flex-1 dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-etapa-btn" onclick="window.selectEtapa('cachorro', this)">🐶 Cachorro<br><span class="text-[9px] font-semibold opacity-60">0–12 meses</span></button>
                    <button class="btn-opt flex-1 dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-etapa-btn" onclick="window.selectEtapa('adulto', this)">🐕 Adulto<br><span class="text-[9px] font-semibold opacity-60">1–7 años</span></button>
                    <button class="btn-opt flex-1 dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-etapa-btn" onclick="window.selectEtapa('senior', this)">🦴 Senior<br><span class="text-[9px] font-semibold opacity-60">+7 años</span></button>
                </div>

                <div id="sub-cachorro" class="hidden mt-4">
                    <div class="text-[10px] font-bold text-purple/50 dark:text-gray-400 tracking-wider uppercase mb-2 flex items-center gap-2 text-left">
                        <span class="w-5 h-5 bg-green text-purple-dark text-[10px] font-black rounded-full flex items-center justify-center">↳</span> Edad del cachorro
                    </div>
                    <div class="grid grid-cols-2 gap-2" id="edad-group">
                        <button class="btn-opt text-left dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-sub-btn" onclick="window.selectSubOpt('cachorroEdad', '2-4', this)">2 – 4 meses</button>
                        <button class="btn-opt text-left dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-sub-btn" onclick="window.selectSubOpt('cachorroEdad', '4-6', this)">4 – 6 meses</button>
                        <button class="btn-opt text-left dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-sub-btn" onclick="window.selectSubOpt('cachorroEdad', '6-9', this)">6 – 9 meses</button>
                        <button class="btn-opt text-left dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-sub-btn" onclick="window.selectSubOpt('cachorroEdad', '9-12', this)">9 – 12 meses</button>
                    </div>
                </div>

                <div id="sub-actividad" class="hidden mt-4">
                    <div class="text-[10px] font-bold text-purple/50 dark:text-gray-400 tracking-wider uppercase mb-2 flex items-center gap-2 text-left">
                        <span class="w-5 h-5 bg-pink text-white text-[10px] font-black rounded-full flex items-center justify-center">↳</span> Condición y actividad
                    </div>
                    <div class="flex flex-col gap-2" id="actividad-group">
                        <button class="btn-opt text-left dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-sub-btn" onclick="window.selectSubOpt('actividad', 'esterilizado_bajo', this)">✂️ Esterilizado/castrado</button>
                        <button class="btn-opt text-left dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-sub-btn" onclick="window.selectSubOpt('actividad', 'bajo', this)">😴 Poco activo</button>
                        <button class="btn-opt text-left dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-sub-btn" onclick="window.selectSubOpt('actividad', 'normal', this)">🚶 Activo (Normal)</button>
                        <button class="btn-opt text-left dark:bg-[#0d0718] dark:text-white dark:border-purple/30 calc-sub-btn" onclick="window.selectSubOpt('actividad', 'alto', this)">🏃 Muy activo</button>
                    </div>
                </div>
            </div>

            <!-- PASO 3: PESO -->
            <div>
                <div class="text-[10px] font-bold text-purple/50 dark:text-gray-400 tracking-wider uppercase mb-3 flex items-center gap-2 text-left">
                    <span class="w-5 h-5 bg-purple dark:bg-green dark:text-darkbg text-white text-[10px] font-black rounded-full flex items-center justify-center">3</span> Peso actual
                </div>
                <div class="flex items-center gap-3">
                    <input type="text" inputmode="decimal" id="pesoInput" name="calc_pet_weight_kg" autocomplete="off" autocorrect="off" spellcheck="false" pattern="[0-9]+([\\.,][0-9]+)?" class="flex-1 w-full min-w-0 p-4 rounded-2xl bg-purple-light dark:bg-[#0d0718] border-2 border-purple-border/50 dark:border-purple/30 text-2xl font-black text-purple dark:text-white outline-none focus:border-purple transition-all text-center" placeholder="0">
                    <span class="text-lg font-black text-purple/40 dark:text-gray-500 uppercase shrink-0">kg</span>
                </div>
                <div class="flex gap-2 mt-3">
                    <button type="button" id="btn-menos" class="flex-1 bg-white dark:bg-[#0d0718] border-2 border-purple-border/50 dark:border-purple/30 hover:border-purple text-purple dark:text-white font-black p-2.5 rounded-xl transition-all text-lg">−</button>
                    <button type="button" id="btn-mas" class="flex-1 bg-white dark:bg-[#0d0718] border-2 border-purple-border/50 dark:border-purple/30 hover:border-purple text-purple dark:text-white font-black p-2.5 rounded-xl transition-all text-lg">+</button>
                </div>
            </div>

            <button id="btn-calcular-racion" onclick="window.calcularRacion()" class="w-full p-5 bg-gradient-to-r from-purple-dark to-purple dark:from-[#2e1060] dark:to-[#421d8e] text-white font-extrabold text-sm tracking-wide rounded-2xl shadow-lg shadow-purple/30 transition-all flex items-center justify-center gap-2 select-none">
                <i data-lucide="sparkles" class="w-5 h-5 text-green"></i> Calcular Porción Orientativa
            </button>

            <div id="errorMsg" class="error-msg text-left"></div>

            <div id="tu-resultado" class="result text-left">
                <div class="bg-purple-light dark:bg-[#0d0718] rounded-[24px] border border-purple-border/30 dark:border-purple/20 overflow-hidden shadow-xl">
                    <div id="result-top" class="p-6 text-center text-white">
                        <div id="result-title-name" class="text-[10px] font-extrabold tracking-widest uppercase mb-1 opacity-80">Porción diaria orientativa</div>
                        <div id="result-grams" class="text-6xl font-black tracking-tight select-all">0</div>
                        <div class="text-sm font-extrabold uppercase tracking-wider opacity-70 mt-1">gramos al día</div>
                        <div id="result-subtitle-pet" class="text-xs font-semibold opacity-80 mt-2"></div>
                        <div id="r-note" class="text-xs text-white/90 font-medium mt-3 pt-2.5 border-t border-white/20">Porción orientativa. Las necesidades de tu perro pueden variar.</div>
                    </div>

                    <div class="p-5 space-y-3 bg-white dark:bg-darkcard text-left">
                        <div class="flex justify-between items-center pb-2 border-b border-purple-border/20 text-xs md:text-sm">
                            <span class="font-semibold text-purple/65 dark:text-gray-400">Energía Diaria (DER)</span>
                            <span class="font-black text-purple dark:text-white" id="r-kcal">0 kcal/día</span>
                        </div>
                        <div class="flex justify-between items-center pb-2 border-b border-purple-border/20 text-xs md:text-sm">
                            <span class="font-semibold text-purple/65 dark:text-gray-400">Repartido en</span>
                            <span class="font-black text-purple dark:text-white" id="r-comidas">0 veces</span>
                        </div>
                        <div class="flex justify-between items-center pb-3 border-b border-purple-border/20 text-xs md:text-sm">
                            <span class="font-semibold text-purple/65 dark:text-gray-400">Cada porción de</span>
                            <span class="font-black text-purple dark:text-white" id="r-por-comida">0g</span>
                        </div>

                        <!-- Presentación asignada automáticamente + Explicación -->
                        <div class="bg-purple-light/50 dark:bg-purple/10 rounded-2xl p-4 border border-purple-border/30 dark:border-purple/20">
                            <div class="inline-flex items-center gap-2 text-purple-dark dark:text-white font-black text-xs sm:text-sm">
                                <span>📦 Presentación recomendada: <strong id="rec-pres-size-text" class="text-pink">250 g</strong></span>
                            </div>
                            <div id="rec-pres-bag" class="mt-3"></div>
                            <p id="rec-pres-explanation" class="text-xs text-purple-dark/80 dark:text-gray-300 font-medium mt-1.5 leading-relaxed">
                                La elegimos según su porción diaria y el tiempo de conservación después de abrirla.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    container.dataset.loaded = 'true';
    window.prepareCalculatorInputs?.(false);

    const iMenos = document.getElementById('btn-menos');
    const iMas = document.getElementById('btn-mas');
    const pInput = document.getElementById('pesoInput');
    if (iMenos && pInput) iMenos.onclick = () => {
        window.vibrate?.(20);
        let val = parseFloat(pInput.value.replace(',', '.')) || 0;
        pInput.value = Math.max(0.5, val - 1);
        const tRes = document.getElementById('tu-resultado');
        if (tRes) tRes.classList.remove('visible', 'show');
    };
    if (iMas && pInput) iMas.onclick = () => {
        window.vibrate?.(20);
        let val = parseFloat(pInput.value.replace(',', '.')) || 0;
        pInput.value = Math.min(90, val + 1);
        const tRes = document.getElementById('tu-resultado');
        if (tRes) tRes.classList.remove('visible', 'show');
    };

    window.refreshIcons?.(container);
};

window.selectEtapa = function (v, btn) {
    window.vibrate(20);
    btn.parentElement.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.classList.add('opacity-60'); });
    btn.classList.add('active'); btn.classList.remove('opacity-60');
    window.state.etapa = v;
    window.state.cachorroEdad = null;
    window.state.actividad = 'bajo'; // Fijo internamente en "Poco activo"

    const sCachorro = document.getElementById('sub-cachorro');
    if (sCachorro) sCachorro.classList.toggle('hidden', v !== 'cachorro');

    const sAct = document.getElementById('sub-actividad');
    if (sAct) sAct.classList.add('hidden');

    document.querySelectorAll('#sub-cachorro button').forEach(b => {
        b.classList.remove('active'); b.classList.add('opacity-60');
    });

    const tRes = document.getElementById('tu-resultado');
    if (tRes) tRes.classList.remove('visible', 'show');

    const eMsg = document.getElementById('errorMsg');
    if (eMsg) eMsg.classList.remove('visible');
};

window.selectSubOpt = function (field, v, btn) {
    window.vibrate(20);
    btn.parentElement.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.classList.add('opacity-60'); });
    btn.classList.add('active'); btn.classList.remove('opacity-60');
    window.state[field] = v;

    const tRes = document.getElementById('tu-resultado');
    if (tRes) tRes.classList.remove('visible', 'show');

    const eMsg = document.getElementById('errorMsg');
    if (eMsg) eMsg.classList.remove('visible');
};

window.getBagRecommendation = function (grams = 0) {
    const g = Number(grams) || 0;
    if (g <= 300) return { size: '250g', label: '250g', text: 'Presentación sugerida: 250 g para prueba inicial, razas pequeñas o consumo moderado.' };
    return { size: '500g', label: '500g', text: 'Presentación sugerida: 500 g para perros medianos, grandes o planificación regular de raciones.' };
};

window.updateFlowStepper = function (currentStep) {
    for (let s = 1; s <= 4; s++) {
        const btn = document.getElementById(`step-btn-${s}`);
        if (!btn) continue;
        if (s <= currentStep) {
            btn.removeAttribute('disabled');
            btn.classList.remove('opacity-60');
        }
        if (s === currentStep) {
            btn.classList.add('bg-purple', 'text-white', 'border-purple');
            btn.classList.remove('bg-white', 'dark:bg-darkcard', 'text-purple/60', 'dark:text-gray-400');
            const numSpan = btn.querySelector('span:first-child');
            if (numSpan) {
                numSpan.className = 'w-5 h-5 rounded-full bg-white text-purple text-[10px] font-black flex items-center justify-center shadow-sm';
            }
        } else {
            btn.classList.remove('bg-purple', 'text-white', 'border-purple');
            btn.classList.add('bg-white', 'dark:bg-darkcard', 'text-purple/60', 'dark:text-gray-400');
            const numSpan = btn.querySelector('span:first-child');
            if (numSpan) {
                numSpan.className = 'w-5 h-5 rounded-full bg-purple/10 dark:bg-purple/20 text-purple dark:text-white text-[10px] font-black flex items-center justify-center';
            }
        }
    }
};

window.goToFlowStep = function (step) {
    window.vibrate?.(20);
    if (step === 1) {
        window.navigateTo('view-calc');
        const card = document.getElementById('calc-step-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.updateFlowStepper(1);
    } else if (step === 2) {
        if (!window.lastCalcResult?.gramos) {
            window.showToast?.('Ingresa primero los datos de tu perro.');
            return;
        }
        window.navigateTo('view-calc');
        const tuRes = document.getElementById('tu-resultado');
        if (tuRes) tuRes.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.updateFlowStepper(2);
    } else if (step === 3) {
        if (!window.lastCalcResult?.gramos) {
            window.showToast?.('Calcula primero la porción de tu perro.');
            return;
        }
        window.navigateTo('view-calc');
        const planSection = document.getElementById('feeding-plans-section');
        if (planSection) planSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.updateFlowStepper(3);
    } else if (step === 4) {
        window.navigateTo('view-cart');
        window.updateFlowStepper(4);
    }
};

window.cambiarFormulaPlan = function (formula) {
    window.vibrate?.(20);
    window.activePlanFormula = formula;

    const btns = {
        pollo: document.getElementById('formula-btn-pollo'),
        res: document.getElementById('formula-btn-res'),
        mixto: document.getElementById('formula-btn-mixto')
    };

    ['pollo', 'res', 'mixto'].forEach(f => {
        const btn = btns[f];
        if (!btn) return;
        const isSelected = f === formula;
        if (isSelected) {
            btn.className = 'plan-formula-btn p-3 rounded-xl border flex items-center gap-2.5 font-bold text-xs transition-all bg-white text-purple-dark border-white shadow-sm';
            const sub = btn.querySelector('div > span:last-child');
            if (sub) sub.className = 'text-[9px] font-medium text-gray-500';
        } else {
            btn.className = 'plan-formula-btn p-3 rounded-xl border flex items-center gap-2.5 font-bold text-xs transition-all bg-white/10 text-white border-white/20 hover:bg-white/20';
            const sub = btn.querySelector('div > span:last-child');
            if (sub) sub.className = 'text-[9px] font-medium text-white/70';
        }
    });

    window.renderActiveFeedingPlans();
};

// =========================================================================
// COMPONENTE DE BOLSA MILKARF 2.0 (SVG reutilizable)
// -------------------------------------------------------------------------
// Silueta rectangular vertical (ancho/alto ≈ 0.72) con esquinas redondeadas,
// sellado superior fino, base discreta y 3 líneas que dividen el área útil en
// 4 intervalos iguales. El relleno sube desde la base y su nivel equivale a
// porcion diaria / capacidad de presentación (nunca supera el 100%).
// Los textos (porción, capacidad) viven fuera del SVG.
// -------------------------------------------------------------------------

window._bagUidCounter = 0;
window._bagAnimByAnchor = new Map();

window.animateProvisionBags = function (root, { force = false } = {}) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const blocks = root ? root.querySelectorAll('.mka-portion-block') : document.querySelectorAll('.mka-portion-block');
    blocks.forEach(block => {
        const anchor = block.dataset.anchor || '';
        const key = block.dataset.animKey || '';
        const prev = window._bagAnimByAnchor.get(anchor);
        const animate = force && prev !== key && !reduce;
        window._bagAnimByAnchor.set(anchor, key);
        block.querySelectorAll('.mka-bag-fill').forEach(rect => {
            const lv = Math.min(1, Math.max(0, Number(rect.dataset.level) || 0));
            if (animate) {
                rect.style.transform = 'scaleY(0)';
                void rect.getBoundingClientRect();
                rect.style.transform = `scaleY(${lv})`;
            } else {
                rect.style.transform = `scaleY(${lv})`;
            }
        });
    });
};

window.renderPortionBag = function (dailyGrams, presentationGrams, opts) {
    const o = opts || {};
    const dG = Math.max(0, Number(dailyGrams) || 0);
    const pG = Number(presentationGrams) > 0 ? Number(presentationGrams) : 500;
    const variant = o.variant === 'modal' ? 'modal' : 'card';
    const uid = 'mka' + Date.now().toString(36) + (++window._bagUidCounter).toString(36);
    const anchor = o.anchor || uid;

    if (dG === 0) {
        return `<div class="text-xs text-gray-400 font-medium select-none" data-anchor="${anchor}">0 g / ${pG} g</div>`;
    }

    const ratio = dG / pG;
    const level01 = Math.min(1, ratio);
    const fullBags = Math.floor(ratio);
    const remGrams = Math.round(((ratio - fullBags) * pG) * 10) / 10;
    const remLevel = ratio - fullBags;
    const animKey = `${dG}|${pG}|${variant}`;

    // Tamaños por variante (la bolsa mide ~0.72·alto dentro del viewBox 0.811)
    const single = variant === 'modal' ? { w: 68, h: 83 } : { w: 50, h: 61 };
    const pair = variant === 'modal' ? { w: 44, h: 55 } : { w: 34, h: 43 };

    const bag = (level, bagUid, wh) => {
        const lv = Math.min(1, Math.max(0, Number(level) || 0));
        return `
        <svg class="mka-bag-svg" width="${wh.w}" height="${wh.h}" viewBox="0 0 86 106" aria-hidden="true">
            <defs>
                <clipPath id="${bagUid}-clip"><rect x="7" y="4" width="64" height="98" rx="7"/></clipPath>
                <linearGradient id="${bagUid}-fill" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stop-color="var(--bag-fill-bottom)"/>
                    <stop offset="100%" stop-color="var(--bag-fill-top)"/>
                </linearGradient>
            </defs>
            <!-- Contorno + interior lavanda -->
            <rect x="7" y="4" width="64" height="98" rx="7" fill="var(--bag-interior)" stroke="var(--bag-stroke)" stroke-width="1.2"/>
            <!-- Sellado superior fino -->
            <rect x="12" y="8" width="56" height="5" rx="2" fill="var(--bag-seal)"/>
            <path class="mka-bag-line" d="M12 15.5 H68"/>
            <!-- Relleno continuo recortado al contorno (origen en la base) -->
            <g clip-path="url(#${bagUid}-clip)">
                <rect class="mka-bag-fill" data-level="${lv.toFixed(4)}" x="8" y="16" width="62" height="76" fill="url(#${bagUid}-fill)" style="transform-box:view-box;transform-origin:39px 92px;transform:scaleY(${lv});"/>
            </g>
            <!-- Cuatro divisiones iguales (25 / 50 / 75 % del área útil) -->
            <path class="mka-bag-line" d="M12 35 H68"/>
            <path class="mka-bag-line-strong" d="M12 54 H68"/>
            <path class="mka-bag-line" d="M12 73 H68"/>
            <!-- Base discretamente definida -->
            <rect x="12" y="95" width="56" height="4.5" rx="2" fill="var(--bag-seal)" opacity="0.7"/>
            <path class="mka-bag-line" d="M12 94.5 H68" opacity="0.5"/>
        </svg>`;
    };

    let cap;
    const bagWord = (n) => (n === 1 ? 'bolsa' : 'bolsas');
    if (ratio <= 1) {
        cap = `De una bolsa de ${pG} g`;
    } else if (remGrams > 0) {
        cap = `${fullBags} ${bagWord(fullBags)} de ${pG} g + ${remGrams} g`;
    } else {
        cap = `${fullBags} ${bagWord(fullBags)} de ${pG} g`;
    }

    let bagsHtml;
    if (ratio <= 1) {
        bagsHtml = `<div class="mka-portion-bag">${bag(level01, uid, single)}</div>`;
    } else {
        bagsHtml = `
        <div class="mka-portion-bag-stack">
            <div class="mka-portion-bag">
                ${bag(1, uid + 'f', pair)}
                ${fullBags > 1 ? `<span class="mka-bag-multiplier">×${fullBags}</span>` : ''}
            </div>
            ${remLevel > 0.01 ? `<div class="mka-portion-bag">${bag(remLevel, uid + 'r', pair)}</div>` : ''}
        </div>`;
    }

    return `
    <div class="mka-portion-block ${variant}" data-anchor="${anchor}" data-anim-key="${animKey}">
        <div class="mka-portion-info min-w-0">
            <span class="mka-portion-label">Porción diaria</span>
            <strong class="mka-portion-grams">${dG} g</strong>
            <span class="mka-portion-cap">${cap}</span>
        </div>
        ${bagsHtml}
    </div>`;
};

// Alias hacia el componente unificado (por compatibilidad de llamadas previas)
window.renderBagAnimationSVG = function (dailyGrams, presentationGrams, opts) {
    return window.renderPortionBag(dailyGrams, presentationGrams, Object.assign({}, opts || {}, { variant: 'modal' }));
};

window.renderBagModern = function (dailyGrams, presentationGrams, opts) {
    return window.renderPortionBag(dailyGrams, presentationGrams, Object.assign({}, opts || {}, { variant: 'card' }));
};

window.renderActiveFeedingPlans = function () {
    const grid = document.getElementById('feeding-plans-cards-grid');
    if (!grid) return;

    const dailyGrams = Number(window.lastCalcResult?.gramos) || 0;
    if (!dailyGrams) return;

    const formula = window.activePlanFormula || 'pollo';
    const petName = window.state.nombreMascota || 'tu perro';
    const plans = window.generateFeedingPlans(dailyGrams, formula, petName);

    grid.innerHTML = plans.map(plan => {
        const isMonthly = plan.days === 30;
        const rawPct = (plan.discountPct * 100);
        const discountPct = Number.isInteger(rawPct) ? String(rawPct) + '%' : String(rawPct).replace('.', ',') + '%';
        const shortName = plan.days === 7 ? 'Semanal' : (plan.days === 15 ? 'Quincenal' : 'Mensual');
        const petName = String(plan.petName || window.state.nombreMascota || 'tu perro');

        const isSelectedInCart = !!(window.cart || []).find(i => i.type === 'feeding_plan' && i.days === plan.days && ((i.petName || '').toLowerCase() === (petName || '').toLowerCase()));
        const plansForRecommend = window.generateFeedingPlans(window.lastCalcResult?.gramos || 0, window.activePlanFormula || 'pollo', petName);
        const recommendedPlanDays = (plansForRecommend || []).reduce((best, p) => ((p.discountPct || 0) > (best.discountPct || 0) ? p : best), plansForRecommend[0] || {}).days;
        const anyPlanForPet = !!(window.cart || []).find(i => i.type === 'feeding_plan' && ((i.petName || '').toLowerCase() === (petName || '').toLowerCase()));
        const isSelected = isSelectedInCart || (!anyPlanForPet && plan.days === recommendedPlanDays);

        return `
        <div role="button" tabindex="0" aria-pressed="${isSelected ? 'true' : 'false'}" data-plan-days="${plan.days}" data-selected-pres="${plan.presentationGrams}" class="feeding-plan-card compact-plan ${isSelected ? 'selected' : ''} bg-white dark:bg-darkcard rounded-2xl p-3 border border-purple-border/50 dark:border-purple/20 shadow-sm text-center transition-all cursor-pointer hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple relative" onclick="window.openPlanModal(${plan.days})" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); window.openPlanModal(${plan.days}); }">

            ${isMonthly ? '<div class="absolute top-0 left-0 right-0 bg-pink text-white text-[9px] font-black uppercase py-0.5 tracking-widest rounded-t-xl">Recomendado</div>' : ''}

            <div class="compact-plan-inner flex flex-col items-center gap-2 py-2">
                <span class="discount-pill">${discountPct} dcto.</span>
                <div class="plan-card-name text-sm font-black text-purple-dark dark:text-white">${shortName}</div>
                <div class="plan-card-days text-[11px] text-gray-500">${plan.days} días</div>

                ${window.renderPortionBag(plan.dailyGrams, plan.presentationGrams, { variant: 'card', anchor: 'card-' + plan.days })}

                <div class="mt-1 text-center">
                    <div class="plan-price text-2xl font-extrabold text-purple-dark dark:text-white">$${plan.finalPrice.toFixed(2)}</div>
                    <div class="plan-savings text-xs text-green-dark dark:text-green">Ahorras $${plan.savings.toFixed(2)}</div>
                </div>

                <button type="button" onclick="event.stopPropagation(); window.openPlanModal(${plan.days});" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); event.stopPropagation(); window.openPlanModal(${plan.days}); }" class="mt-2 w-full py-2 px-3 bg-purple/10 dark:bg-purple/20 text-purple dark:text-white hover:bg-purple hover:text-white text-[12px] font-bold rounded-xl transition-all">Ver mi plan</button>
            </div>

        </div>
        `;
    }).join('');
    if (window.lucide) window.lucide.createIcons({ root: grid });
    window.animateProvisionBags(grid, { force: true });

    // Asegurar visualmente la selección: aplicar la clase selected a los elementos renderizados
    try {
        const cardEls = Array.from(grid.querySelectorAll('.feeding-plan-card'));
        cardEls.forEach(el => el.classList.remove('selected'));
        const petName = String(window.state.nombreMascota || 'tu perro');
        const anyPlanForPet = !!(window.cart || []).find(i => i.type === 'feeding_plan' && ((i.petName || '').toLowerCase() === (petName || '').toLowerCase()));
        // Recalcular plan recomendado
        const plansForRecommend = window.generateFeedingPlans(window.lastCalcResult?.gramos || 0, window.activePlanFormula || 'pollo', petName) || [];
        const recommended = plansForRecommend.reduce((best, p) => ((p.discountPct || 0) > (best.discountPct || 0) ? p : best), plansForRecommend[0] || null);
        const recommendedDays = recommended ? recommended.days : null;
        cardEls.forEach(el => {
            const days = Number(el.getAttribute('data-plan-days'));
            const isSelectedInCart = !!(window.cart || []).find(i => i.type === 'feeding_plan' && i.days === days && ((i.petName || '').toLowerCase() === (petName || '').toLowerCase()));
            const shouldSelect = isSelectedInCart || (!anyPlanForPet && days === recommendedDays);
            if (shouldSelect) el.classList.add('selected'); else el.classList.remove('selected');
            el.setAttribute('aria-pressed', shouldSelect ? 'true' : 'false');
        });
    } catch (e) { console.warn('Error aplicando selección visual a tarjetas:', e); }

    window.renderPresentationSelector?.();

    // Mantener sincronizada la presentación de cada tarjeta con su bolsa
    try {
        const cardEls2 = Array.from(grid.querySelectorAll('.feeding-plan-card'));
        cardEls2.forEach(card => {
            const pres250 = card.querySelector('.plan-card-pres[data-pres-size="250"]');
            const pres500 = card.querySelector('.plan-card-pres[data-pres-size="500"]');
            const priceEl = card.querySelector('.plan-price');
            const savingsEl = card.querySelector('.plan-savings');
            const days = Number(card.getAttribute('data-plan-days')) || 7;
            const formula = window.activePlanFormula || 'pollo';

            const applyPres = (size) => {
                // compute pricing for this card using chosen presentation
                const sizing = size + 'gr';
                const pricing = window.calculatePlanConsumption(window.lastCalcResult?.gramos || 0, days, formula, sizing);
                if (!pricing) return;
                // set selected attribute on card
                card.setAttribute('data-selected-pres', pricing.presentationGrams || size);
                // update displayed price/savings
                if (priceEl) priceEl.textContent = `$${(pricing.finalPrice || pricing.subtotal || 0).toFixed(2)}`;
                if (savingsEl) savingsEl.textContent = `Ahorras $${(pricing.discountAmount || 0).toFixed(2)}`;
                // visual highlight
                if (pres250) pres250.classList.toggle('pres-active', Number(size) === 250);
                if (pres500) pres500.classList.toggle('pres-active', Number(size) === 500);
                // update bag visual (animará solo si cambia el nivel)
                try {
                    const block = card.querySelector('.mka-portion-block');
                    if (block) {
                        const newHtml = window.renderPortionBag(window.lastCalcResult?.gramos || 0, pricing.presentationGrams || size, { variant: 'card', anchor: 'card-' + days });
                        block.outerHTML = newHtml;
                        window.animateProvisionBags(card, { force: true });
                    }
                } catch (e) { console.warn('Error updating bag visual on card', e); }
            };

            // initialize visuals based on data-selected-pres (la presentación
            // sugerida ya viene del plan; aquí se sincroniza precio y nivel)
            const initial = Number(card.getAttribute('data-selected-pres')) || Number(window.recommendPresentation(window.lastCalcResult?.gramos || 0, formula).size) || 500;
            applyPres(initial === 500 ? 500 : 250);
        });
    } catch (e) { console.warn('Error setting up per-card presentation handlers', e); }
};

// Modal accesible de detalle de plan
window._lastFocusBeforeModal = null;
window.openPlanModal = function (days) {
    window.vibrate?.(20);
    if (!window.lastCalcResult?.gramos) {
        window.showToast?.('Calcula primero la porción de tu perro.');
        return;
    }
    const dailyGrams = window.lastCalcResult.gramos;
    const formula = window.activePlanFormula || 'pollo';
    const petName = window.state.nombreMascota || 'tu perro';
    const plans = window.generateFeedingPlans(dailyGrams, formula, petName);
    const plan = plans.find(p => p.days === Number(days));
    if (!plan) return;

    let dlg = document.getElementById('plan-modal');
    if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'plan-modal';
        dlg.className = 'plan-modal rounded-xl p-0 border-0 shadow-2xl';
        dlg.setAttribute('aria-labelledby', 'plan-modal-title');
        dlg.setAttribute('aria-modal', 'true');
        dlg.innerHTML = `
            <div class="modal-inner w-full">
                <div class="modal-content p-5">
                    <header class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 id="plan-modal-title" class="text-xl font-black text-purple-dark leading-tight"></h2>
                            <div id="plan-modal-subtitle" class="text-xs text-gray-500 mt-0.5 font-medium"></div>
                        </div>
                        <button aria-label="Cerrar" id="plan-modal-close" class="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-gray-100 hover:bg-pink hover:text-white text-gray-500 transition-colors border-0 text-sm font-black">✕</button>
                    </header>
                    <div id="plan-modal-body" class="space-y-3"></div>
                    <div id="plan-modal-summary" class="mt-5"></div>
                </div>
            </div>
        `;
        document.body.appendChild(dlg);

        dlg.querySelector('#plan-modal-close').addEventListener('click', () => window.closePlanModal());
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); window.closePlanModal(); });
        dlg.addEventListener('click', (e) => { if (e.target === dlg) window.closePlanModal(); });
    }

    const body = dlg.querySelector('#plan-modal-body');
    const summary = dlg.querySelector('#plan-modal-summary');
    const title = dlg.querySelector('#plan-modal-title');
    const subtitle = dlg.querySelector('#plan-modal-subtitle');

    title.textContent = plan.label.replace('Plan ', '');
    subtitle.textContent = `${plan.formulaLabel} · ${plan.days} días`;

    const isMonthlyModal = plan.days === 30;
    const petNameDisplay = plan.petName || window.state.nombreMascota || 'tu perro';
    const splitLine = plan.split ? `<div class="flex justify-between items-center">
        <span class="text-gray-500 font-medium">Composición</span>
        <span class="font-bold text-purple-dark">${plan.split.polloPct}% Pollo / ${plan.split.resPct}% Res</span>
    </div>` : '';

    // prepare pricing for both presentations so modal can show boxes
    const pricing250 = window.calculatePlanConsumption(plan.dailyGrams, plan.days, plan.formula, '250gr');
    const pricing500 = window.calculatePlanConsumption(plan.dailyGrams, plan.days, plan.formula, '500gr');

    body.innerHTML = `
        <!-- Fila Compacta: Porción Diaria + Bolsa (ilustración lateral, sin marco decorativo) -->
        <div class="rounded-2xl bg-purple-light/40 dark:bg-purple/10 border border-purple-border/30 dark:border-purple/20 p-3.5 sm:p-4 select-none">
            ${window.renderPortionBag(plan.dailyGrams, plan.presentationGrams, { variant: 'modal', anchor: 'plan-modal' })}
        </div>

        <!-- Selector de presentación (sincronizable con tarjeta) -->
        <div class="mt-3 grid grid-cols-2 gap-3">
            <div class="p-3 rounded-2xl border border-purple-border/20 text-center cursor-pointer ${plan.presentationGrams === 250 ? 'pres-active' : ''}" data-pres-select="250">
                <div class="text-xs font-black text-purple-dark">250 g</div>
                <div class="text-sm font-bold mt-2 modal-presentation-price">$${pricing250 ? (pricing250.finalPrice || pricing250.subtotal || 0).toFixed(2) : '—'}</div>
                <div class="text-[11px] text-gray-500 mt-1 modal-presentation-qty">${pricing250 ? pricing250.totalBags + ' bolsa(s)' : ''}</div>
            </div>
            <div class="p-3 rounded-2xl border border-purple-border/20 text-center cursor-pointer ${plan.presentationGrams === 500 ? 'pres-active' : ''}" data-pres-select="500">
                <div class="text-xs font-black text-purple-dark">500 g</div>
                <div class="text-sm font-bold mt-2 modal-presentation-price">$${pricing500 ? (pricing500.finalPrice || pricing500.subtotal || 0).toFixed(2) : '—'}</div>
                <div class="text-[11px] text-gray-500 mt-1 modal-presentation-qty">${pricing500 ? pricing500.totalBags + ' bolsa(s)' : ''}</div>
            </div>
        </div>

        <!-- Precio destacado -->
        <div class="rounded-2xl bg-gradient-to-r from-purple-dark to-purple p-4 text-white flex items-center justify-between shadow-md mt-4">
            <div>
                <span class="text-[10px] text-green-light font-bold uppercase block mb-0.5">Precio total del plan</span>
                <span class="text-3xl font-black text-white leading-none modal-selected-price">$${Number(plan.finalPrice).toFixed(2)}</span>
                <span class="block text-[11px] text-white/60 line-through mt-1 modal-original-price">Antes: $${Number(plan.originalPrice).toFixed(2)}</span>
            </div>
            <div class="text-right">
                <span class="inline-block bg-green text-purple-dark text-xs font-black px-3 py-1.5 rounded-xl shadow-sm modal-selected-savings">
                    Ahorras $${Number(plan.savings).toFixed(2)} (-${plan.discountPercent}%)
                </span>
                <div class="text-[11px] text-white/80 mt-1.5 font-medium modal-cost-per-day">~$${plan.costPerDay.toFixed(2)} / día</div>
            </div>
        </div>

        <!-- Detalle de cantidades y conservación -->
        <div class="rounded-2xl border border-purple-border/30 dark:border-purple/20 p-4 space-y-2.5 text-xs sm:text-sm bg-white dark:bg-darkcard">
            <div class="flex justify-between items-center pb-2 border-b border-purple-border/20">
                <span class="text-gray-500 font-medium">Mascota</span>
                <span class="font-black text-purple-dark dark:text-white">${window.escapeHTML(petNameDisplay)}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-500 font-medium">Porción diaria</span>
                <span class="font-black text-purple-dark dark:text-white">${plan.dailyGrams} g/día</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-500 font-medium">Presentación asignada</span>
                <span class="font-bold text-purple-dark dark:text-white">${plan.presentation.replace('gr',' g')}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-500 font-medium">Alimento requerido (${plan.days} días)</span>
                <span class="font-bold text-purple-dark dark:text-white">${(plan.requiredGrams / 1000).toFixed(2)} kg (${plan.requiredGrams} g)</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-500 font-medium">Bolsas incluidas</span>
                <span class="font-black text-purple-dark dark:text-white">${plan.bagsCount} bolsa(s)</span>
            </div>
            ${splitLine}
            <div class="flex justify-between items-center pt-2 border-t border-purple-border/20">
                <span class="text-gray-500 font-medium">Peso total comprado</span>
                <span class="font-black text-green-dark dark:text-green">${(plan.totalGramsProvided / 1000).toFixed(2)} kg</span>
            </div>
            ${plan.surplusGrams > 0 ? `
            <div class="flex justify-between items-center text-pink font-semibold">
                <span>Sobrante descartado por conservación</span>
                <span>${plan.surplusGrams} g</span>
            </div>` : ''}

            <!-- Base de estimación de bolsas -->
            <div class="mt-3 pt-2.5 border-t border-purple-border/20 text-[11px] leading-relaxed text-purple-dark/80 dark:text-gray-300 bg-purple-light/50 dark:bg-purple/10 p-3 rounded-xl">
                <div class="font-bold mb-0.5 text-purple dark:text-green">💡 Base de estimación:</div>
                <p>${plan.basisText || 'Estimación con apertura diaria; puede generar sobrantes.'}</p>
                ${plan.wasteExplanation ? `<p class="mt-1 text-gray-500 dark:text-gray-400">${plan.wasteExplanation}</p>` : ''}
            </div>
        </div>
    `;
    window.animateProvisionBags(body, { force: true });

    summary.innerHTML = `
        <button id="plan-modal-choose" class="w-full ${isMonthlyModal ? 'bg-pink hover:bg-pink-dark' : 'bg-purple hover:bg-purple-dark'} text-white font-black py-4 rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Elegir ${String(plan.label.replace('Plan ', '')).toLowerCase()} ($${plan.finalPrice.toFixed(2)})
        </button>
    `;

    summary.querySelector('#plan-modal-choose').addEventListener('click', (e) => { e.stopPropagation(); window.selectPlanFromModal(plan.days); });

    // Sincronizar selección entre modal y tarjeta
    setTimeout(() => {
        try {
            const dlgEl = dlg;
            const modalBoxes = Array.from(dlgEl.querySelectorAll('[data-pres-select]'));
            const cardEl = document.querySelector(`.feeding-plan-card[data-plan-days="${plan.days}"]`);
            const cardPrice = cardEl ? cardEl.querySelector('.plan-price') : null;
            const cardSavings = cardEl ? cardEl.querySelector('.plan-savings') : null;

            const applyModalChoice = (choice) => {
                modalBoxes.forEach(b => b.classList.toggle('pres-active', b.getAttribute('data-pres-select') === String(choice)));
                const pricing = window.calculatePlanConsumption(plan.dailyGrams, plan.days, plan.formula, choice + 'gr');
                if (pricing) {
                    const selPrice = dlgEl.querySelector('.modal-selected-price');
                    const selSavings = dlgEl.querySelector('.modal-selected-savings');
                    if (selPrice) selPrice.textContent = `$${(pricing.finalPrice || pricing.subtotal || 0).toFixed(2)}`;
                    if (selSavings) selSavings.textContent = `Ahorras $${(pricing.discountAmount || 0).toFixed(2)} (-${pricing.discountPercent || 0}%)`;
                    // update bag visuals (modal y tarjeta) con la presentación elegida
                    const presGrams = pricing.presentationGrams || choice;
                    try {
                        const modalBlock = dlgEl.querySelector('.mka-portion-block[data-anchor="plan-modal"]');
                        if (modalBlock) {
                            modalBlock.outerHTML = window.renderPortionBag(plan.dailyGrams, presGrams, { variant: 'modal', anchor: 'plan-modal' });
                        }
                    } catch (e) { console.warn('Error updating bag visual in modal', e); }
                    // update card visuals too
                    if (cardEl) {
                        cardEl.setAttribute('data-selected-pres', pricing.presentationGrams || choice);
                        if (cardPrice) cardPrice.textContent = `$${(pricing.finalPrice || pricing.subtotal || 0).toFixed(2)}`;
                        if (cardSavings) cardSavings.textContent = `Ahorras $${(pricing.discountAmount || 0).toFixed(2)}`;
                        // highlight pres boxes on card
                        const pres250 = cardEl.querySelector('.plan-card-pres[data-pres-size="250"]');
                        const pres500 = cardEl.querySelector('.plan-card-pres[data-pres-size="500"]');
                        if (pres250) pres250.classList.toggle('pres-active', Number(choice) === 250);
                        if (pres500) pres500.classList.toggle('pres-active', Number(choice) === 500);
                        // update bag visual on card
                        try {
                            const block = cardEl.querySelector('.mka-portion-block');
                            if (block) {
                                block.outerHTML = window.renderPortionBag(plan.dailyGrams, presGrams, { variant: 'card', anchor: 'card-' + plan.days });
                            }
                        } catch (e) { console.warn('Error updating bag visual from modal selection', e); }
                    }
                    // Animamos todos los bloques recién renderizados (modal + tarjeta)
                    window.animateProvisionBags(document, { force: true });
                }
            };

            modalBoxes.forEach(b => b.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const choice = Number(b.getAttribute('data-pres-select')) || 500;
                applyModalChoice(choice);
            }));

            // initialize modal selection from card or plan
            const initial = cardEl ? Number(cardEl.getAttribute('data-selected-pres')) || plan.presentationGrams : plan.presentationGrams;
            applyModalChoice(initial || 500);
        } catch (e) { console.warn('Error sincronizando modal y tarjeta', e); }
    }, 50);

    window._lastFocusBeforeModal = document.activeElement;
    try { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open',''); } catch (e) { dlg.setAttribute('open',''); }

    const focusable = dlg.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();

    window._planModalKeyHandler = function (ev) { if (ev.key === 'Escape') { window.closePlanModal(); } };
    document.addEventListener('keydown', window._planModalKeyHandler);
};

window.closePlanModal = function () {
    const dlg = document.getElementById('plan-modal');
    if (!dlg) return;
    try { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); } catch (e) { dlg.removeAttribute('open'); }
    document.removeEventListener('keydown', window._planModalKeyHandler);
    if (window._lastFocusBeforeModal && typeof window._lastFocusBeforeModal.focus === 'function') window._lastFocusBeforeModal.focus();
    window._lastFocusBeforeModal = null;
};

window.selectPlanFromModal = function (days) {
    if (!window.lastCalcResult?.gramos) { window.showToast?.('Calcula primero la porción de tu perro.'); return; }
    const formula = window.activePlanFormula || 'pollo';
    const petName = window.state.nombreMascota || 'tu perro';
    // Prefer presentation selected in the modal (data-pres-select .pres-active), then card, then global
    let chosenPresentation = window.activePlanPresentation || '500gr';
    try {
        const dlg = document.getElementById('plan-modal');
        if (dlg) {
            const sel = dlg.querySelector('[data-pres-select].pres-active');
            if (sel) chosenPresentation = (Number(sel.getAttribute('data-pres-select')) || 500) + 'gr';
        }
        if (!dlg) {
            const card = document.querySelector(`.feeding-plan-card[data-plan-days="${days}"]`);
            if (card) {
                const selCard = Number(card.getAttribute('data-selected-pres')) || null;
                if (selCard) chosenPresentation = selCard + 'gr';
            }
        }
    } catch (e) { console.warn('Error reading selected presentation for plan:', e); }

    const plan = window.buildFeedingPlan(window.lastCalcResult.gramos, days, formula, petName, chosenPresentation);
    window.addFeedingPlanToCart(plan);
    window.renderActiveFeedingPlans();
    window.closePlanModal();
    window.showToast?.('Plan seleccionado. Revisa el resumen del pedido.', 'success');
};

window.selectPlanPresentation = function (size) {
    window.vibrate?.(20);
    if (size !== '250gr' && size !== '500gr') size = '500gr';
    window.activePlanPresentation = size;
    window.__presentationUserTouched = true;
    window.renderPresentationSelector?.();
    window.renderActiveFeedingPlans?.();
};

window.renderPresentationSelector = function () {
    const formula = window.activePlanFormula || 'pollo';
    const sel = window.activePlanPresentation || '500gr';

    // Etiquetas de precio según fórmula activa
    const getLabel = (f, sz) => {
        const p = window.getPresentationBySize?.(f, sz);
        if (p) return '$' + Number(p.price).toFixed(2);
        if (f === 'mixto') return sz === '250gr' ? '$2.50–$3.50' : '$5.00–$7.00';
        return '';
    };
    document.querySelectorAll('#plan-presentation-selector .presentation-price').forEach(el => {
        const sz = el.closest?.('[data-size]')?.getAttribute('data-size') || '';
        if (sz) el.textContent = getLabel(formula, sz);
    });

    const setState = (el, active) => {
        if (!el) return;
        el.classList.toggle('pres-active', active);
        el.setAttribute('aria-checked', active ? 'true' : 'false');
        const check = el.querySelector('[data-pres-check]');
        if (check) check.textContent = active ? '✓' : '';
    };

    document.querySelectorAll('#plan-presentation-selector [data-size]').forEach(el => {
        const sz = el.getAttribute('data-size');
        setState(el, sz === sel);
    });

    // Cajas informativas del resultado de la calculadora
    document.querySelectorAll('#tu-resultado [data-pres-box]').forEach(el => {
        const sz = el.getAttribute('data-pres-box');
        setState(el, sz === sel);
        const check = el.querySelector('[data-pres-box-check]');
        if (check) check.classList.toggle('hidden', sz !== sel);
    });
};

window.updatePlanPresentation = function (planId, size) {
    window.vibrate?.(20);
    const plan = window.cart.find(i => i.id === planId);
    if (!plan) return;
    const updated = window.buildFeedingPlan(plan.dailyGrams, plan.days, plan.formula, plan.petName, size);
    Object.assign(plan, updated, { id: planId, type: 'feeding_plan' });
    window.updateCartUI();
    window.saveCartToStorage?.();
    window.showToast?.(`Presentación cambiada a ${size.replace('gr', ' g')}.`, 'success');
};

window.seleccionarPlan = function (days) {
    window.vibrate?.([30, 50]);
    if (!window.lastCalcResult?.gramos) {
        window.showToast?.('Calcula primero la porción de tu perro.');
        return;
    }

    const formula = window.activePlanFormula || 'pollo';
    const petName = window.state.nombreMascota || 'tu perro';
    const plan = window.buildFeedingPlan(window.lastCalcResult.gramos, days, formula, petName, window.activePlanPresentation);

    window.addFeedingPlanToCart(plan);
    window.updateFlowStepper(4);
    window.navigateTo('view-cart');
};

window.addFeedingPlanToCart = function (plan) {
    if (!window.cart) window.cart = [];

    // Formatear como item de plan de alimentación
    const planItem = {
        ...plan,
        type: 'feeding_plan',
        id: 'plan_' + Date.now()
    };

    // Si ya existe un plan para esta misma mascota, se actualiza
    const existingIndex = window.cart.findIndex(i => i.type === 'feeding_plan' && (i.petName || '').toLowerCase() === (plan.petName || '').toLowerCase());
    if (existingIndex >= 0) {
        window.cart[existingIndex] = planItem;
        window.showToast?.(`Plan actualizado para ${plan.petName}.`, 'success');
    } else {
        window.cart.push(planItem);
        window.showToast?.(`Plan para ${plan.petName} agregado al pedido.`, 'success');
    }

    window.updateCartUI();
    window.saveCartToStorage?.();
};

window.removePlanFromCart = function (planId) {
    window.vibrate?.(20);
    window.cart = window.cart.filter(i => i.id !== planId);
    window.updateCartUI();
    window.saveCartToStorage?.();
    window.showToast?.('Plan eliminado del pedido.');
};

window.updatePlanDuration = function (planId, newDays) {
    window.vibrate?.(20);
    const plan = window.cart.find(i => i.id === planId);
    if (!plan) return;
    const updated = window.buildFeedingPlan(plan.dailyGrams, newDays, plan.formula, plan.petName, plan.presentation || window.activePlanPresentation);
    Object.assign(plan, updated, { id: planId, type: 'feeding_plan' });
    window.updateCartUI();
    window.saveCartToStorage?.();
    window.showToast?.(`Plan cambiado a ${newDays} días.`, 'success');
};

window.updatePlanFormula = function (planId, newFormula) {
    window.vibrate?.(20);
    const plan = window.cart.find(i => i.id === planId);
    if (!plan) return;
    const updated = window.buildFeedingPlan(plan.dailyGrams, plan.days, newFormula, plan.petName, plan.presentation || window.activePlanPresentation);
    Object.assign(plan, updated, { id: planId, type: 'feeding_plan' });
    window.updateCartUI();
    window.saveCartToStorage?.();
    window.showToast?.(`Fórmula actualizada.`, 'success');
};

window.calcularRacion = function () {
    window.vibrate([30, 50]);
    if (document.activeElement) document.activeElement.blur();

    const calcNombreInput = document.getElementById('calc-nombre');
    const pesoInputEl = document.getElementById('pesoInput');
    const err = document.getElementById('errorMsg');

    if (!calcNombreInput || !pesoInputEl || !err) return;

    window.state.nombreMascota = calcNombreInput.value.trim();
    const rawPesoText = String(pesoInputEl.value || '').trim();
    if (/[a-zA-Z@]/.test(rawPesoText)) {
        pesoInputEl.value = '';
        err.textContent = "Ingresa el peso en kg (solo números mayores a 0).";
        err.classList.add('visible');
        const tRes = document.getElementById('tu-resultado');
        if (tRes) tRes.classList.remove('visible', 'show');
        pesoInputEl.focus();
        return;
    }
    const pesoText = rawPesoText.replace(',', '.');
    const peso = parseFloat(pesoText);

    if (!window.state.nombreMascota) {
        err.textContent = "Ingresa el nombre de tu perro en el Paso 1 para continuar.";
        err.classList.add('visible');
        const tRes = document.getElementById('tu-resultado');
        if (tRes) tRes.classList.remove('visible', 'show');
        calcNombreInput.focus();
        return;
    }

    window.state.actividad = 'bajo'; // Fijo internamente en "Poco activo"

    if (!window.state.etapa || (window.state.etapa === 'cachorro' && !window.state.cachorroEdad) || !peso || peso <= 0) {
        err.textContent = "Completa la etapa de vida y el peso de tu perro para calcular su porción orientativa.";
        err.classList.add('visible');
        const tRes = document.getElementById('tu-resultado');
        if (tRes) tRes.classList.remove('visible', 'show');
        return;
    }
    err.classList.remove('visible');

    // Factor fijado internamente según "Poco activo" (bajo)
    const factor = window.state.etapa === 'cachorro' ? ({ '2-4': 3, '4-6': 2.5, '6-9': 2, '9-12': 1.8 }[window.state.cachorroEdad] || 2) : (window.state.etapa === 'adulto' ? 1.4 : 1.2);
    const gramos = Math.round((70 * Math.pow(peso, 0.75) * factor) / 1.25);
    const comidas = window.state.etapa === 'cachorro' ? (['2-4', '4-6'].includes(window.state.cachorroEdad) ? 4 : 3) : 2;

    const titleName = document.getElementById('result-title-name');
    if (titleName) titleName.textContent = `Porción orientativa para ${window.state.nombreMascota}`;

    const subtitlePet = document.getElementById('result-subtitle-pet');
    const etapaLabel = window.state.etapa === 'cachorro' ? `Cachorro (${window.state.cachorroEdad} meses)` : (window.state.etapa === 'senior' ? 'Senior' : 'Adulto');
    if (subtitlePet) subtitlePet.textContent = `${etapaLabel} · ${peso} kg`;

    const rGrams = document.getElementById('result-grams');
    if (rGrams) rGrams.textContent = gramos;

    const rKcal = document.getElementById('r-kcal');
    if (rKcal) rKcal.textContent = Math.round(70 * Math.pow(peso, 0.75) * factor) + " kcal";

    const rComidas = document.getElementById('r-comidas');
    if (rComidas) rComidas.textContent = comidas + (comidas === 1 ? " vez al día" : " veces al día");

    const rPorComida = document.getElementById('r-por-comida');
    if (rPorComida) rPorComida.textContent = Math.round(gramos / comidas) + "g";

    const noteEl = document.getElementById('r-note');
    if (noteEl) {
        noteEl.textContent = "Porción orientativa. Las necesidades de tu perro pueden variar.";
    }

    const rec = window.recommendPresentation(gramos, window.activePlanFormula || 'pollo');
    const recTextEl = document.getElementById('rec-pres-size-text');
    if (recTextEl) recTextEl.textContent = rec.label;
    // Ilustración de bolsa en el resultado (porción vs presentación recomendada)
    const recBagEl = document.getElementById('rec-pres-bag');
    if (recBagEl) {
        recBagEl.innerHTML = window.renderPortionBag(gramos, rec.grams, { variant: 'card', anchor: 'calc-result' });
        window.animateProvisionBags(recBagEl, { force: true });
    }
    const recExpEl = document.getElementById('rec-pres-explanation');
    if (recExpEl) {
        if (rec.available) {
            recExpEl.textContent = rec.reason;
        } else {
            recExpEl.textContent = `La presentación recomendada de ${rec.label} no está disponible actualmente.`;
        }
    }

    const oldPres = window.activePlanPresentation;
    window.activePlanPresentation = rec.size;
    if (oldPres && oldPres !== rec.size) {
        window.showToast?.('Actualizamos la presentación según su nueva porción.', 'success');
    }

    window.lastCalcResult = {
        nombre: window.state.nombreMascota,
        tipo: 'perro',
        etapa: window.state.etapa,
        cachorroEdad: window.state.cachorroEdad,
        actividad: 'bajo',
        peso,
        gramos,
        comidas,
        porComida: Math.round(gramos / comidas),
        calcVersion: window.MILKARF_CONFIG.calcEngineVersion,
        calculatedAt: new Date().toISOString()
    };
    window.updateCalcSaveCTA?.();

    // Actualizar stepper y renderizar los planes correspondientes
    window.updateFlowStepper(2);
    window.renderActiveFeedingPlans();

    const tuRes = document.getElementById('tu-resultado');
    if (tuRes) {
        tuRes.classList.add('show');
        setTimeout(() => {
            tuRes.classList.add('visible');
            setTimeout(() => {
                const scrollContainer = document.getElementById('view-calc');
                if (scrollContainer) {
                    const containerRect = scrollContainer.getBoundingClientRect();
                    const resRect = tuRes.getBoundingClientRect();
                    const deltaY = resRect.top - containerRect.top - 20;
                    if (typeof scrollContainer.scrollBy === 'function') {
                        scrollContainer.scrollBy({
                            top: deltaY,
                            behavior: 'smooth'
                        });
                    } else {
                        scrollContainer.scrollTop += deltaY;
                    }
                }
            }, 350);
        }, 20);
    }
};

window.handleDesktopAuthClick = function () {
    window.vibrate?.(20);
    const isLoggedIn = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email);
    if (isLoggedIn) {
        window.navigateTo('view-dashboard');
    } else {
        window.abrirModalAuth();
    }
};

window.setQty = function (prod, value) {
    const qtyProd = document.getElementById(`qty-${prod}`);
    const raw = String(value ?? '').trim();

    // En el menú la cantidad inicia en 0 y debe poder borrarse para escribir pedidos grandes.
    // Si el campo queda vacío mientras el usuario escribe, no lo forzamos a 1.
    if (raw === '') {
        window.qtys[prod] = 0;
        return;
    }

    let parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) parsed = 0;
    parsed = Math.min(parsed, 999);
    window.qtys[prod] = parsed;
    if (qtyProd && qtyProd.value !== String(parsed)) qtyProd.value = String(parsed);
};

window.changeQty = function (prod, delta) {
    window.vibrate(20);
    const current = parseInt(window.qtys[prod], 10);
    window.qtys[prod] = Math.max(0, (Number.isFinite(current) ? current : 0) + delta);
    const qtyProd = document.getElementById(`qty-${prod}`);
    if (qtyProd) qtyProd.value = String(window.qtys[prod]);
};


window.resetMenuQuantities = function () {
    window.qtys = { pollo: 0, res: 0 };
    ['pollo', 'res'].forEach(prod => {
        const input = document.getElementById(`qty-${prod}`);
        if (input) input.value = '0';
    });
};

window.applyWeightButtonStyle = function (groupId, selectedButton, weight) {
    const group = document.getElementById(groupId);
    if (!group) return;

    group.querySelectorAll('button').forEach(b => {
        b.classList.remove('bg-purple', 'bg-pink', 'bg-green', 'text-white', 'text-purple-dark', 'border-purple', 'border-pink', 'border-green', 'opacity-100', 'weight-active');
        b.classList.add('bg-white', 'dark:bg-darkbg', 'text-purple', 'dark:text-white', 'border-purple-border/50', 'dark:border-purple/30', 'opacity-60');
        b.style.backgroundColor = '';
        b.style.borderColor = '';
        b.style.color = '';
        b.style.boxShadow = '';
    });

    if (!selectedButton) return;

    selectedButton.classList.remove('bg-white', 'dark:bg-darkbg', 'text-purple', 'dark:text-white', 'border-purple-border/50', 'dark:border-purple/30', 'opacity-60');
    selectedButton.classList.add('opacity-100', 'weight-active');

    const styles = {
        '250gr': { bg: '#421d8e', border: '#421d8e', color: '#ffffff', shadow: '0 8px 18px rgba(66,29,142,0.25)' },
        '500gr': { bg: '#d72b8f', border: '#d72b8f', color: '#ffffff', shadow: '0 8px 18px rgba(215,43,143,0.25)' }
    };
    const s = styles[weight] || styles['250gr'];
    selectedButton.style.backgroundColor = s.bg;
    selectedButton.style.borderColor = s.border;
    selectedButton.style.color = s.color;
    selectedButton.style.boxShadow = s.shadow;
};

window.selectWeightPollo = function (w, btn) {
    window.vibrate(20);
    window.currentWeightPollo = w;
    window.applyWeightButtonStyle('weight-group-pollo', btn, w);
    const pricePollo = document.getElementById('price-pollo');
    if (pricePollo) pricePollo.textContent = window.PRICES_POLLO[w];
};

window.selectWeightRes = function (w, btn) {
    window.vibrate(20);
    window.currentWeightRes = w;
    window.applyWeightButtonStyle('weight-group-res', btn, w);
    const priceRes = document.getElementById('price-res');
    if (priceRes) priceRes.textContent = window.PRICES_RES[w];
};

window.addToCart = function (prod) {
    window.vibrate([40, 60]);
    window.cartPostOrderActive = false;
    const post = document.getElementById('cart-post-order');
    if (post) post.classList.add('hidden');
    const isPollo = prod === 'pollo';
    const weight = isPollo ? window.currentWeightPollo : window.currentWeightRes;
    const prices = isPollo ? window.PRICES_POLLO : window.PRICES_RES;
    const name = isPollo ? 'Pollo con Zanahoria' : 'Res con Calabacín';
    const price = parseFloat(prices[weight].replace('$', ''));
    const qty = parseInt(window.qtys[prod], 10) || 0;
    if (qty <= 0) {
        window.showToast?.('Selecciona la cantidad antes de agregar al carrito.');
        const qtyInput = document.getElementById(`qty-${prod}`);
        if (qtyInput) qtyInput.focus();
        return;
    }
    const key = `${prod}-${weight}`;
    const forPet = window.state.nombreMascota || '';

    const exist = window.cart.find(i => i.key === key && (i.forPet || '') === forPet);
    if (exist) exist.qty += qty; else window.cart.push({ key, name, weight, price, qty, forPet });

    window.updateCartUI();
    window.saveCartToStorage();

    const toastEl = document.getElementById('cart-toast');
    const toastMsg = document.getElementById('cart-toast-msg');
    if (toastEl && toastMsg) {
        toastMsg.textContent = `Agregado: ${qty}x ${name} (${weight})`;
        toastEl.classList.add('show');
        if (window.__cartToastTimeout) clearTimeout(window.__cartToastTimeout);
        window.__cartToastTimeout = setTimeout(() => {
            toastEl.classList.remove('show');
        }, 2800);
        if (window.lucide) window.lucide.createIcons({ root: toastEl });
    } else {
        const t = document.createElement('div');
        t.className = 'fixed top-6 right-6 z-[9999] bg-[#1e1035] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 transition-all';
        t.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-green"></i> Agregado: ${qty}x ${name} (${weight})`;
        document.body.appendChild(t);
        if (window.lucide) window.lucide.createIcons({ root: t });
        setTimeout(() => { t.remove(); }, 2500);
    }

    window.qtys[prod] = 0;
    const qtyProd = document.getElementById(`qty-${prod}`);
    if (qtyProd) qtyProd.value = '0';
};

window.agregarPlanOtraMascota = function () {
    window.vibrate?.(20);
    const nombreInput = document.getElementById('calc-nombre');
    const pesoInput = document.getElementById('pesoInput');
    if (nombreInput) nombreInput.value = '';
    if (pesoInput) pesoInput.value = '';
    const resSec = document.getElementById('tu-resultado');
    if (resSec) resSec.classList.remove('visible', 'show');
    const plansSec = document.getElementById('feeding-plans-section');
    if (plansSec) plansSec.classList.add('hidden');
    window.updateFlowStepper(1);
    window.navigateTo('view-calc');
    setTimeout(() => {
        if (nombreInput) nombreInput.focus();
    }, 250);
};

window.armarPlanDesdeCatalogo = function (formula = 'pollo') {
    window.vibrate?.(20);
    window.activePlanFormula = formula;
    const nombreInput = document.getElementById('calc-nombre');
    const pesoInput = document.getElementById('pesoInput');
    
    // Si ya se calculó una porción previamente, actualizamos los planes con la fórmula elegida
    if (window.state?.porcionesRecomendadas?.perro) {
        window.cambiarFormulaPlan(formula);
        window.navigateTo('view-calc');
        setTimeout(() => {
            const plansSec = document.getElementById('feeding-plans-section');
            if (plansSec) plansSec.scrollIntoView({ behavior: 'smooth' });
        }, 200);
    } else {
        window.updateFlowStepper(1);
        window.navigateTo('view-calc');
        setTimeout(() => {
            if (nombreInput) nombreInput.focus();
        }, 250);
    }
};

window.updateCartUI = function () {
    if (!window.cart) window.cart = [];
    
    // Normalizar items estándar
    window.cart.forEach(i => {
        if (i.type !== 'feeding_plan') {
            i.qty = Math.max(1, parseInt(i.qty, 10) || 1);
        }
    });

    const tItems = window.cart.length; // Cada plan cuenta como 1 item de suscripción/pedido
    
    // Calcular subtotal original acumulado
    const totalOriginalSubtotal = window.cart.reduce((s, i) => {
        if (i.type === 'feeding_plan') {
            return s + (Number(i.originalSubtotal) || (Number(i.price || 0) * Number(i.qty || 1)));
        }
        return s + (Number(i.price || 0) * Number(i.qty || 1));
    }, 0);

    // Calcular descuento acumulado de los planes
    const totalPlanDiscount = window.cart.reduce((s, i) => {
        if (i.type === 'feeding_plan') {
            return s + (Number(i.discountAmount) || 0);
        }
        return s;
    }, 0);

    // Validar estado del cupón de bienvenida
    if (window.descuentoAplicado) {
        const isLoggedUser = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email);
        const alreadyUsed = window.currentUser?.data?.descuento_usado === true;
        if (!isLoggedUser || alreadyUsed) {
            window.descuentoAplicado = false;
        }
    }

    // Regla de no acumulación: aplicar el mayor beneficio económico
    const totalWelcomeDiscount = window.descuentoAplicado ? (totalOriginalSubtotal * 0.20) : 0;
    let appliedDiscountType = 'none';
    let finalDiscountAmount = 0;

    if (window.descuentoAplicado) {
        if (totalWelcomeDiscount > totalPlanDiscount) {
            appliedDiscountType = 'welcome';
            finalDiscountAmount = totalWelcomeDiscount;
        } else {
            appliedDiscountType = totalPlanDiscount > 0 ? 'plan' : 'welcome';
            finalDiscountAmount = Math.max(totalPlanDiscount, totalWelcomeDiscount);
        }
    } else {
        if (totalPlanDiscount > 0) {
            appliedDiscountType = 'plan';
            finalDiscountAmount = totalPlanDiscount;
        }
    }

    const finalTotal = Math.max(0, totalOriginalSubtotal - finalDiscountAmount);

    // Badges y Floating Action Button
    const fab = document.getElementById('cart-fab');
    const cartBadge = document.getElementById('cart-badge');
    const dBadge = document.getElementById('desktop-cart-badge');

    if (tItems > 0) {
        if (fab) {
            fab.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
            fab.classList.remove('pop'); void fab.offsetWidth; fab.classList.add('pop');
        }
        if (cartBadge) cartBadge.textContent = tItems;
        if (dBadge) dBadge.textContent = tItems;
    } else {
        if (fab) fab.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
        if (cartBadge) cartBadge.textContent = '0';
        if (dBadge) dBadge.textContent = '0';
    }

    const empty = document.getElementById('cart-empty');
    const cont = document.getElementById('cart-items-container');
    const sum = document.getElementById('cart-summary');
    const post = document.getElementById('cart-post-order');

    if (window.cartPostOrderActive) {
        if (empty) empty.classList.add('hidden');
        if (cont) { cont.classList.add('hidden'); cont.innerHTML = ''; }
        if (sum) sum.classList.add('hidden');
        if (post) post.classList.remove('hidden');
        const cartTitle = document.getElementById('cart-title');
        const cartBackBtn = document.getElementById('cart-back-shop-btn');
        if (cartTitle) cartTitle.textContent = 'Pedido preparado para enviar por WhatsApp';
        if (cartBackBtn) cartBackBtn.classList.add('hidden');
        if (fab) fab.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
        if (cartBadge) cartBadge.textContent = '0';
        return;
    }

    if (post) post.classList.add('hidden');
    const cartTitle = document.getElementById('cart-title');
    const cartBackBtn = document.getElementById('cart-back-shop-btn');
    if (cartTitle) cartTitle.textContent = 'Revisa tu pedido';
    if (cartBackBtn) cartBackBtn.classList.remove('hidden');

    if (window.cart.length === 0) {
        if (empty) empty.classList.remove('hidden');
        if (cont) cont.classList.add('hidden');
        if (sum) sum.classList.add('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    if (cont) cont.classList.remove('hidden');
    if (sum) sum.classList.remove('hidden');

    // Renderizar tarjetas de carrito (Planes y legacy)
    if (cont) {
        const itemsHTML = window.cart.map((i, idx) => {
            if (i.type === 'feeding_plan') {
                const kgReq = (Number(i.totalGramsRequired || 0) / 1000).toFixed(2);
                const kgProv = (Number(i.totalGramsProvided || 0) / 1000).toFixed(2);
                const surplusG = Number(i.surplusGrams || 0);
                const bagsDesc = Array.isArray(i.bags) ? i.bags.map(b => `${b.qty}x ${b.weight}`).join(' + ') : '';
                const petDisplay = i.petName || 'Tu perro';
                const petWeightText = Number(i.petWeight) ? ` · ${Number(i.petWeight)} kg` : '';
                const curDays = Number(i.durationDays || 7);
                const curFormula = i.formula || 'pollo';
                const curPres = i.presentation || '500gr';

                return `
                    <div class="bg-white dark:bg-darkcard rounded-3xl border-2 border-purple/20 dark:border-purple/30 p-5 sm:p-6 shadow-md transition-all text-left relative overflow-hidden mb-4">
                        <!-- Cabecera del plan -->
                        <div class="flex items-start justify-between gap-3 pb-3 border-b border-purple-border/30 dark:border-purple/20">
                            <div>
                                <div class="inline-flex items-center gap-1.5 bg-purple/10 dark:bg-purple/25 text-purple-dark dark:text-purple-light text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-1.5">
                                    🐾 Plan para ${window.escapeHTML(petDisplay)}
                                </div>
                                <h3 class="font-black text-lg sm:text-xl text-purple-dark dark:text-white leading-tight">
                                    ${window.escapeHTML(i.formulaName || 'Fórmula Milkarf')}
                                </h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-0.5">
                                    Ración: <span class="text-purple font-black">${i.dailyGrams} g/día</span> · Duración: <span class="font-bold text-pink">${curDays} días</span>${petWeightText}
                                </p>
                            </div>
                            <button onclick="window.removeFromCartAt(${idx})" class="w-10 h-10 bg-pink/10 hover:bg-pink text-pink hover:text-white rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0 touch-target-safe shadow-sm" aria-label="Eliminar plan">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>

                        <!-- Selector inline de duración, fórmula y presentación -->
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 bg-purple-light/50 dark:bg-[#0d0718] p-3.5 rounded-2xl border border-purple-border/30 dark:border-purple/20">
                            <div>
                                <span class="text-[10px] font-black uppercase tracking-wider text-purple/60 dark:text-gray-400 block mb-1.5">Duración del plan:</span>
                                <div class="grid grid-cols-3 gap-1.5">
                                    <button type="button" onclick="window.updatePlanDuration('${i.id}', 7)" class="py-1.5 px-2 text-[11px] font-black rounded-xl border transition-all ${curDays === 7 ? 'bg-purple text-white border-purple shadow-sm' : 'bg-white dark:bg-darkbg text-purple-dark dark:text-white border-purple/20 hover:border-purple/50'}">
                                        7d <span class="text-[9px] opacity-80 block">-5%</span>
                                    </button>
                                    <button type="button" onclick="window.updatePlanDuration('${i.id}', 15)" class="py-1.5 px-2 text-[11px] font-black rounded-xl border transition-all ${curDays === 15 ? 'bg-purple text-white border-purple shadow-sm' : 'bg-white dark:bg-darkbg text-purple-dark dark:text-white border-purple/20 hover:border-purple/50'}">
                                        15d <span class="text-[9px] opacity-80 block">-7.5%</span>
                                    </button>
                                    <button type="button" onclick="window.updatePlanDuration('${i.id}', 30)" class="py-1.5 px-2 text-[11px] font-black rounded-xl border transition-all ${curDays === 30 ? 'bg-purple text-white border-purple shadow-sm' : 'bg-white dark:bg-darkbg text-purple-dark dark:text-white border-purple/20 hover:border-purple/50'}">
                                        30d <span class="text-[9px] opacity-80 block">-10%</span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <span class="text-[10px] font-black uppercase tracking-wider text-purple/60 dark:text-gray-400 block mb-1.5">Fórmula:</span>
                                <div class="grid grid-cols-3 gap-1.5">
                                    <button type="button" onclick="window.updatePlanFormula('${i.id}', 'pollo')" class="py-1.5 px-2 text-[11px] font-black rounded-xl border transition-all ${curFormula === 'pollo' ? 'bg-pink text-white border-pink shadow-sm' : 'bg-white dark:bg-darkbg text-purple-dark dark:text-white border-purple/20 hover:border-purple/50'}">
                                        Pollo
                                    </button>
                                    <button type="button" onclick="window.updatePlanFormula('${i.id}', 'res')" class="py-1.5 px-2 text-[11px] font-black rounded-xl border transition-all ${curFormula === 'res' ? 'bg-pink text-white border-pink shadow-sm' : 'bg-white dark:bg-darkbg text-purple-dark dark:text-white border-purple/20 hover:border-purple/50'}">
                                        Res
                                    </button>
                                    <button type="button" onclick="window.updatePlanFormula('${i.id}', 'mixto')" class="py-1.5 px-2 text-[11px] font-black rounded-xl border transition-all ${curFormula === 'mixto' ? 'bg-pink text-white border-pink shadow-sm' : 'bg-white dark:bg-darkbg text-purple-dark dark:text-white border-purple/20 hover:border-purple/50'}">
                                        Mixto
                                    </button>
                                </div>
                            </div>
                            <div>
                                <span class="text-[10px] font-black uppercase tracking-wider text-purple/60 dark:text-gray-400 block mb-1.5">Presentación:</span>
                                <div class="grid grid-cols-2 gap-1.5">
                                    <button type="button" onclick="window.updatePlanPresentation('${i.id}', '250gr')" class="py-1.5 px-2 text-[11px] font-black rounded-xl border transition-all ${curPres === '250gr' ? 'bg-purple text-white border-purple shadow-sm' : 'bg-white dark:bg-darkbg text-purple-dark dark:text-white border-purple/20 hover:border-purple/50'}">
                                        ≤250 g
                                    </button>
                                    <button type="button" onclick="window.updatePlanPresentation('${i.id}', '500gr')" class="py-1.5 px-2 text-[11px] font-black rounded-xl border transition-all ${curPres === '500gr' ? 'bg-purple text-white border-purple shadow-sm' : 'bg-white dark:bg-darkbg text-purple-dark dark:text-white border-purple/20 hover:border-purple/50'}">
                                        ≤500 g
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Detalle de porciones, presentación y excedente -->
                        <div class="space-y-2 text-xs text-gray-600 dark:text-gray-300 font-medium mb-4">
                            <div class="flex items-center justify-between">
                                <span class="flex items-center gap-1.5"><i data-lucide="package" class="w-3.5 h-3.5 text-purple"></i> Presentación / bolsas:</span>
                                <span class="font-bold text-purple-dark dark:text-white">${curPres === '250gr' ? '≤250 g' : '≤500 g'}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="flex items-center gap-1.5"><i data-lucide="shopping-bag" class="w-3.5 h-3.5 text-pink"></i> Bolsas en el plan:</span>
                                <span class="font-bold text-purple-dark dark:text-white">${window.escapeHTML(bagsDesc)}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span>Alimento requerido:</span>
                                <span class="font-bold text-purple-dark dark:text-white">${kgReq} kg (${i.durationDays} días × ${i.dailyGrams}g)</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <span>Total incluido:</span>
                                <span class="font-bold text-emerald-600 dark:text-emerald-400">${kgProv} kg ${surplusG > 0 ? `(+${surplusG}g sin costo adicional)` : ''}</span>
                            </div>
                        </div>

                        <!-- Precios y ahorro del plan -->
                        <div class="flex items-center justify-between pt-3 border-t border-purple-border/30 dark:border-purple/20">
                            <div>
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider line-through">Subtotal: $${Number(i.originalSubtotal || 0).toFixed(2)}</div>
                                <div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-black">Ahorro: -$${Number(i.discountAmount || 0).toFixed(2)} (${i.discountPercent}%)</div>
                            </div>
                            <div class="text-right">
                                <div class="text-[10px] text-purple/60 dark:text-gray-400 font-bold uppercase">Total del plan</div>
                                <div class="font-black text-pink text-xl sm:text-2xl tracking-tight">$${Number(i.finalPrice || 0).toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Legacy individual item rendering
            return `
                <div class="bg-white dark:bg-darkcard rounded-3xl border border-purple-border/40 dark:border-purple/25 p-5 shadow-md transition-all premium-card mb-4">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0 text-left">
                            <div class="font-black text-base text-purple-dark dark:text-white truncate">${window.escapeHTML(i.name)}</div>
                            <div class="flex flex-wrap items-center gap-2 mt-1.5">
                                <span class="bg-purple/10 dark:bg-purple/20 text-purple-dark dark:text-purple-light text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">${window.escapeHTML(i.weight)}</span>
                                ${i.forPet ? `<span class="bg-pink/15 text-pink text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1"><i data-lucide="heart" class="w-2.5 h-2.5 fill-current"></i> Para ${window.escapeHTML(i.forPet)}</span>` : ''}
                            </div>
                        </div>
                        <button onclick="window.removeFromCartAt(${idx})" class="w-10 h-10 bg-pink/10 hover:bg-pink text-pink hover:text-white rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0 touch-target-safe shadow-sm" aria-label="Eliminar producto">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div class="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-purple-border/25 dark:border-purple/20">
                        <div class="flex items-center gap-1 bg-purple-light dark:bg-[#0d0718] border border-purple-border/50 dark:border-purple/30 rounded-2xl p-1 shadow-inner">
                            <button type="button" onclick="window.changeCartQty(${idx}, -1)" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-darkcard text-purple dark:text-white font-black text-lg hover:bg-purple hover:text-white transition-all shadow-sm active:scale-95 touch-target-safe">−</button>
                            <input type="number" min="1" value="${i.qty}" oninput="window.setCartQty(${idx}, this.value)" class="w-12 h-10 text-center font-black text-purple dark:text-white text-sm bg-transparent outline-none" aria-label="Cantidad en carrito">
                            <button type="button" onclick="window.changeCartQty(${idx}, 1)" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-darkcard text-purple dark:text-white font-black text-lg hover:bg-purple hover:text-white transition-all shadow-sm active:scale-95 touch-target-safe">+</button>
                        </div>
                        <div class="text-right">
                            <div class="font-black text-pink text-lg tracking-tight">$${(i.price * i.qty).toFixed(2)}</div>
                            <div class="text-[10px] text-gray-400 font-bold">$${i.price.toFixed(2)} c/u</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Botón para agregar plan de otra mascota
        const addAnotherPetBtn = `
            <div class="pt-2">
                <button type="button" onclick="window.agregarPlanOtraMascota()" class="w-full py-3.5 px-4 bg-purple-light/70 dark:bg-purple/15 hover:bg-purple hover:text-white text-purple-dark dark:text-purple-light font-black rounded-2xl flex items-center justify-center gap-2 border-2 border-dashed border-purple/30 dark:border-purple/30 transition-all active:scale-[0.98] shadow-sm">
                    <i data-lucide="plus-circle" class="w-5 h-5"></i>
                    <span>+ Calcular y agregar plan para otra mascota</span>
                </button>
            </div>
        `;

        cont.innerHTML = itemsHTML + addAnotherPetBtn;
        if (window.lucide) window.lucide.createIcons({ root: cont });
    }

    // Líneas del resumen de compra
    const cLines = document.getElementById('cart-summary-lines');
    if (cLines) {
        cLines.innerHTML = window.cart.map(i => {
            if (i.type === 'feeding_plan') {
                return `
                    <div class="flex justify-between items-start gap-3 py-1 font-medium text-xs">
                        <div class="text-left">
                            <span class="text-purple-dark dark:text-white font-bold block">Plan ${i.durationDays}d · ${window.escapeHTML(i.formulaName)}</span>
                            <span class="text-purple/60 dark:text-gray-400 text-[11px]">🐾 Para ${window.escapeHTML(i.petName || 'Mascota')} · ${i.bags ? i.bags.map(b => `${b.qty}x ${b.weight}`).join(', ') : ''}</span>
                        </div>
                        <span class="text-purple-dark dark:text-white font-bold shrink-0">$${Number(i.originalSubtotal || i.price).toFixed(2)}</span>
                    </div>
                `;
            }
            return `
                <div class="flex justify-between gap-3 font-medium text-xs py-1">
                    <span class="text-purple/70 dark:text-gray-300">${i.qty}x ${window.escapeHTML(i.name)} (${window.escapeHTML(i.weight)}) ${i.forPet ? `<span class="opacity-60 text-xs">· ${window.escapeHTML(i.forPet)}</span>` : ''}</span>
                    <span class="text-purple-dark dark:text-white font-bold shrink-0">$${(i.price * i.qty).toFixed(2)}</span>
                </div>
            `;
        }).join('');

        // Fila informativa del delivery
        cLines.innerHTML += `
            <div class="flex justify-between items-center text-xs py-1.5 border-t border-purple-border/30 dark:border-purple/20 mt-1 text-purple/70 dark:text-gray-300">
                <span class="flex items-center gap-1"><i data-lucide="truck" class="w-3.5 h-3.5 text-pink"></i> Entrega a domicilio:</span>
                <span class="font-bold text-pink text-[11px] uppercase tracking-wider">Por cotizar según zona</span>
            </div>
        `;

        // Notificación de beneficio / resolución de descuento
        if (appliedDiscountType === 'welcome') {
            cLines.innerHTML += `
                <div class="mt-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-2.5 rounded-xl text-[11px] font-bold text-left flex items-start gap-2">
                    <i data-lucide="sparkles" class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"></i>
                    <div>
                        <span>Cupón de bienvenida (-20%) aplicado: Te otorga un mayor ahorro ($${totalWelcomeDiscount.toFixed(2)} vs $${totalPlanDiscount.toFixed(2)} del plan).</span>
                    </div>
                </div>
            `;
        } else if (appliedDiscountType === 'plan' && window.descuentoAplicado) {
            cLines.innerHTML += `
                <div class="mt-2 bg-purple/10 border border-purple/20 text-purple-dark dark:text-purple-light p-2.5 rounded-xl text-[11px] font-bold text-left flex items-start gap-2">
                    <i data-lucide="info" class="w-4 h-4 text-purple shrink-0 mt-0.5"></i>
                    <div>
                        <span>Descuento de plan aplicado: Te otorga un mayor ahorro ($${totalPlanDiscount.toFixed(2)} vs $${totalWelcomeDiscount.toFixed(2)} del cupón de bienvenida). No son acumulables.</span>
                    </div>
                </div>
            `;
        }
        if (window.lucide) window.lucide.createIcons({ root: cLines });
    }

    // Mostrar tachado y total
    const cOriginal = document.getElementById('cart-total-original');
    if (finalDiscountAmount > 0) {
        if (cOriginal) {
            cOriginal.textContent = `$${totalOriginalSubtotal.toFixed(2)}`;
            cOriginal.classList.remove('hidden');
        }
    } else {
        if (cOriginal) cOriginal.classList.add('hidden');
    }

    const cTotal = document.getElementById('cart-total');
    if (cTotal) cTotal.textContent = `$${finalTotal.toFixed(2)}`;
};

window.changeCartQty = function (index, delta) {
    window.vibrate?.(15);
    if (!window.cart[index]) return;
    window.cart[index].qty = Math.max(1, (parseInt(window.cart[index].qty, 10) || 1) + delta);
    window.updateCartUI();
    window.saveCartToStorage();
};

window.setCartQty = function (index, value) {
    if (!window.cart[index]) return;
    const parsed = parseInt(value, 10);
    window.cart[index].qty = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    window.updateCartUI();
    window.saveCartToStorage();
};

window.removeFromCartAt = function (index) {
    window.vibrate?.(20);
    if (window.cart[index]) window.cart.splice(index, 1);
    window.updateCartUI();
    window.saveCartToStorage();
};

window.removeFromCart = function (k, p) {
    window.vibrate?.(20);
    const idx = window.cart.findIndex(i => i.key === k && (i.forPet || '') === p);
    if (idx !== -1) window.cart.splice(idx, 1);
    window.updateCartUI();
    window.saveCartToStorage();
};

// ─── PERSISTENCIA DEL CARRITO ───
window._cartSaveTimer = null;

window.saveCartToStorage = function () {
    // Guardar en localStorage siempre (respaldo local)
    try {
        localStorage.setItem('milkarf_cart', JSON.stringify(window.cart || []));
    } catch (e) { }

    // Guardar en Firestore si el usuario está autenticado (debounced 2s)
    if (window._cartSaveTimer) clearTimeout(window._cartSaveTimer);
    window._cartSaveTimer = setTimeout(async () => {
        try {
            const user = window.currentUser;
            if (!user || user.isAnonymous || !user.email || !db) return;
            const cartData = (window.cart || []).map(i => ({
                key: i.key, name: i.name, weight: i.weight,
                price: i.price, qty: i.qty, forPet: i.forPet || ''
            }));
            await setDoc(window.getUserPath(user.uid), { cart: cartData, updatedAt: serverTimestamp() }, { merge: true });
        } catch (e) { console.warn('No se pudo sincronizar carrito a Firestore:', e); }
    }, 2000);
};

window.loadCartFromLocalStorage = function () {
    try {
        if (!localStorage.getItem('milkarf_cart_ghost_cleanup_v1')) {
            localStorage.removeItem('milkarf_cart');
            localStorage.setItem('milkarf_cart_ghost_cleanup_v1', '1');
            window.cart = [];
            window.updateCartUI?.();
            return;
        }
        const saved = localStorage.getItem('milkarf_cart');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                window.cart = parsed;
                window.updateCartUI();
            }
        }
    } catch (e) { }
};

window.syncCartOnLogin = async function (userData) {
    if (!userData || !Array.isArray(userData.cart)) return;
    const remoteCart = userData.cart;
    if (remoteCart.length === 0 && window.cart.length === 0) return;

    // Fusionar: prioridad al carrito local si tiene ítems, sino usar remoto
    if (window.cart.length === 0) {
        window.cart = remoteCart;
    } else if (remoteCart.length > 0) {
        // Fusionar sin duplicados (por key+forPet)
        for (const ri of remoteCart) {
            const exists = window.cart.find(li => li.key === ri.key && (li.forPet || '') === (ri.forPet || ''));
            if (!exists) {
                window.cart.push(ri);
            }
        }
    }
    window.updateCartUI();
    window.saveCartToStorage();
};

window.resetCartDeliveryUI = function () {
    window.userLocation = null;
    const btn = document.getElementById('location-btn');
    const btnText = document.getElementById('location-btn-text');
    const status = document.getElementById('location-status');
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('border-solid', 'border-green', 'text-green-dark', 'bg-green/5', 'opacity-60');
        btn.classList.add('border-dashed', 'border-purple/30', 'text-purple');
    }
    if (btnText) btnText.textContent = 'Marcar mi ubicación en el mapa';
    if (status) { status.classList.add('hidden'); status.innerHTML = ''; status.textContent = ''; }
};

window.POST_ORDER_STATE_KEY = 'milkarf_post_order_state';

window.persistCartPostOrderState = function (orderId = null) {
    try {
        sessionStorage.setItem(window.POST_ORDER_STATE_KEY, JSON.stringify({
            active: true,
            orderId: orderId || window.lastOrderId || null,
            savedAt: Date.now()
        }));
    } catch (error) { }
};

window.clearCartPostOrderPersistedState = function () {
    try { sessionStorage.removeItem(window.POST_ORDER_STATE_KEY); } catch (error) { }
};

window.restoreCartPostOrderStateIfNeeded = function () {
    try {
        const raw = sessionStorage.getItem(window.POST_ORDER_STATE_KEY);
        if (!raw) return false;
        const state = JSON.parse(raw);
        const recent = state?.savedAt && (Date.now() - Number(state.savedAt) < 1000 * 60 * 30);
        if (!state?.active || !recent) { window.clearCartPostOrderPersistedState(); return false; }
        window.showCartPostOrderState(state.orderId || null, { persist: false });
        return true;
    } catch (error) {
        window.clearCartPostOrderPersistedState();
        return false;
    }
};

window.hideCartPostOrderState = function () {
    window.cartPostOrderActive = false;
    window.clearCartPostOrderPersistedState?.();
    const post = document.getElementById('cart-post-order');
    const title = document.getElementById('cart-title');
    const backBtn = document.getElementById('cart-back-shop-btn');
    if (post) post.classList.add('hidden');
    if (title) title.textContent = 'Revisa tu pedido';
    if (backBtn) backBtn.classList.remove('hidden');
    window.updateCartUI?.();
};

window.showCartPostOrderState = function (orderId = null, options = {}) {
    const opts = { persist: true, ...options };
    window.cartPostOrderActive = true;
    if (orderId) window.lastOrderId = orderId;
    window.cart = [];
    try { localStorage.removeItem('milkarf_cart'); } catch (e) { }
    try { window.saveCartToStorage?.(); } catch (e) { }
    window.resetMenuQuantities?.();
    window.descuentoAplicado = false;
    window.resetCartDeliveryUI?.();
    if (opts.persist) window.persistCartPostOrderState?.(orderId || window.lastOrderId || null);

    const empty = document.getElementById('cart-empty');
    const cont = document.getElementById('cart-items-container');
    const sum = document.getElementById('cart-summary');
    const post = document.getElementById('cart-post-order');
    const fab = document.getElementById('cart-fab');
    const badge = document.getElementById('cart-badge');
    const title = document.getElementById('cart-title');
    const backBtn = document.getElementById('cart-back-shop-btn');

    if (empty) empty.classList.add('hidden');
    if (cont) { cont.classList.add('hidden'); cont.innerHTML = ''; }
    if (sum) sum.classList.add('hidden');
    if (post) post.classList.remove('hidden');
    if (title) title.textContent = 'Pedido preparado para enviar por WhatsApp';
    if (backBtn) backBtn.classList.add('hidden');
    if (fab) fab.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    if (badge) badge.textContent = '0';
    const postDBadge = document.getElementById('desktop-cart-badge');
    if (postDBadge) postDBadge.textContent = '0';
    window.refreshCheckoutWhatsAppLink?.();
    window.refreshIcons?.();
};

window.clearCart = function () {
    window.vibrate(20);
    window.cartPostOrderActive = false;
    window.clearCartPostOrderPersistedState?.();
    window.cart = [];
    try { localStorage.removeItem('milkarf_cart'); } catch (e) { }
    try { window.saveCartToStorage?.(); } catch (e) { }
    window.resetMenuQuantities?.();
    window.descuentoAplicado = false;
    window.resetCartDeliveryUI?.();
    window.updateCartUI();
};

window.captureLocation = function () {
    var btn = document.getElementById('location-btn');
    var btnText = document.getElementById('location-btn-text');
    var status = document.getElementById('location-status');

    if (!navigator.geolocation) {
        if (status) {
            status.textContent = '⚠️ Tu navegador no soporta geolocalización.';
            status.classList.remove('hidden');
        }
        return;
    }

    if (btnText) btnText.textContent = 'Obteniendo ubicación…';
    if (btn) {
        btn.disabled = true;
        btn.classList.remove('border-purple/30', 'text-purple');
        btn.classList.add('border-purple', 'text-purple', 'opacity-60');
    }

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            window.userLocation = 'https://maps.google.com/maps?q=' + pos.coords.latitude + ',' + pos.coords.longitude;
            if (btn) {
                btn.classList.remove('border-dashed', 'border-purple', 'opacity-60');
                btn.classList.add('border-solid', 'border-green', 'text-green-dark', 'bg-green/5');
            }
            if (btnText) btnText.textContent = '✅ Ubicación marcada correctamente';
            if (status) {
                status.innerHTML = '📍 <a href="' + window.userLocation + '" target="_blank" style="text-decoration:underline;font-weight:700;">Ver en Maps</a>';
                status.classList.remove('hidden');
            }
            if (btn) btn.disabled = false;
        },
        function (err) {
            if (btn) {
                btn.classList.remove('border-purple', 'opacity-60');
                btn.classList.add('border-purple/30');
                btn.disabled = false;
            }
            if (btnText) btnText.textContent = 'Marcar mi ubicación en el mapa';
            if (status) {
                status.textContent = '⚠️ Error al obtener ubicación. Revisa tus permisos o activa el GPS.';
                status.classList.remove('hidden');
            }
        },
        { enableHighAccuracy: true, timeout: 12000 }
    );
};

/* Checkout WhatsApp: la versión única y activa de finalizarPedido se define en el patch final
   al cierre del módulo, después de prepareOrderForCheckout. Esto evita funciones duplicadas
   y comportamientos distintos entre escritorio y móvil. */

function initApp() {
    const iMenos = document.getElementById('btn-menos');
    const iMas = document.getElementById('btn-mas');
    const pInput = document.getElementById('pesoInput');

    window.setMaxBirthdayDates();
    window.prepareCalculatorInputs(false);

    if (iMenos) iMenos.onclick = () => {
        window.vibrate(20);
        let val = parseFloat(pInput.value.replace(',', '.')) || 0;
        pInput.value = Math.max(0.5, val - 1);
        const tRes = document.getElementById('tu-resultado');
        if (tRes) tRes.classList.remove('visible', 'show');
    };
    if (iMas) iMas.onclick = () => {
        window.vibrate(20);
        let val = parseFloat(pInput.value.replace(',', '.')) || 0;
        pInput.value = Math.min(90, val + 1);
        const tRes = document.getElementById('tu-resultado');
        if (tRes) tRes.classList.remove('visible', 'show');
    };
    if (pInput) pInput.oninput = () => {
        const raw = String(pInput.value || '');
        const err = document.getElementById('errorMsg');
        if (/[a-zA-Z@]/.test(raw)) {
            pInput.value = '';
            if (err) {
                err.textContent = 'Ingresa el peso en kg, solo números.';
                err.classList.add('visible');
            }
        }
        const tRes = document.getElementById('tu-resultado');
        if (tRes) tRes.classList.remove('visible', 'show');
    };

    const pricePollo = document.getElementById('price-pollo');
    if (pricePollo) pricePollo.textContent = window.PRICES_POLLO[window.currentWeightPollo];

    const priceRes = document.getElementById('price-res');
    if (priceRes) priceRes.textContent = window.PRICES_RES[window.currentWeightRes];
    window.applyWeightButtonStyle('weight-group-pollo', document.querySelector('#weight-group-pollo button'), window.currentWeightPollo);
    window.applyWeightButtonStyle('weight-group-res', document.querySelector('#weight-group-res button'), window.currentWeightRes);
    window.resetMenuQuantities?.();

    // Paws generation disabled for cleaner, modern performance-conscious UI
    // (Container is also hidden via CSS #paws-container { display: none !important; })

    // Restore Global Listeners for Menu Links and Accordions
    document.querySelectorAll('.nav-link, .nav-btn, .nav-card').forEach(el => {
        if (!el.hasAttribute('onclick')) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const target = el.getAttribute('data-target');
                if (target) window.navigateTo(target);
            });
        }
    });

    document.querySelectorAll('.accordion-header').forEach(header => {
        if (!header.hasAttribute('onclick')) {
            header.addEventListener('click', function () { window.toggleAccordion(this); });
        }
    });

    // Lógica para Ocultar/Mostrar el botón Auth y el menú hamburguesa en el Scroll
    let lastScrollY = 0;
    const authBtnWrap = document.getElementById('top-auth-btn-wrap');
    const menuBtnWrap = document.getElementById('top-menu-btn-wrap');

    const hideTopChrome = () => {
        if (authBtnWrap) authBtnWrap.classList.add('-translate-y-24', 'opacity-0', 'pointer-events-none');
        if (menuBtnWrap) menuBtnWrap.classList.add('-translate-y-24', 'opacity-0', 'pointer-events-none');
    };
    const showTopChrome = () => {
        if (authBtnWrap) authBtnWrap.classList.remove('-translate-y-24', 'opacity-0', 'pointer-events-none');
        if (menuBtnWrap) menuBtnWrap.classList.remove('-translate-y-24', 'opacity-0', 'pointer-events-none');
    };

    document.querySelectorAll('.view').forEach(v => {
        v.addEventListener('scroll', () => {
            if (!v.classList.contains('active')) return;
            const st = v.scrollTop;
            if (st > 20) {
                hideTopChrome();
                if (authBtnWrap) {
                    const authMenu = document.getElementById('auth-dropdown-menu');
                    if (authMenu && !authMenu.classList.contains('hidden')) {
                        authMenu.classList.remove('opacity-100', 'scale-100');
                        authMenu.classList.add('opacity-0', 'scale-95');
                        setTimeout(() => authMenu.classList.add('hidden'), 200);
                    }
                }
            } else {
                showTopChrome();
            }
            lastScrollY = st;
        }, { passive: true });
    });

    // GESTIÓN DEL BOTÓN TOP AUTH (DROPDOWN + SECRET TRIGGER ADMIN)
    let secretClicks = 0;
    let secretTimeout;
    const authBtn = document.getElementById('top-auth-btn');
    const authMenu = document.getElementById('auth-dropdown-menu');

    if (authBtn) {
        authBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.vibrate(10);

            // --- ADMIN SECRET TRIGGER (5 clicks rápidos), sin bloquear el uso normal de “Entrar” ---
            secretClicks++;
            clearTimeout(secretTimeout);
            secretTimeout = setTimeout(() => secretClicks = 0, 1800);

            if (secretClicks >= 5) {
                secretClicks = 0;
                if (authMenu && !authMenu.classList.contains('hidden')) {
                    authMenu.classList.remove('opacity-100', 'scale-100');
                    authMenu.classList.add('opacity-0', 'scale-95');
                    setTimeout(() => authMenu.classList.add('hidden'), 180);
                }
                window.abrirModalAdmin();
                return;
            }
            // -----------------------------------------------------------------------------

            if (!authMenu) return;
            const isHidden = authMenu.classList.contains('hidden');
            if (isHidden) {
                authMenu.classList.remove('hidden');
                setTimeout(() => {
                    authMenu.classList.remove('opacity-0', 'scale-95');
                    authMenu.classList.add('opacity-100', 'scale-100');
                }, 10);
            } else {
                authMenu.classList.remove('opacity-100', 'scale-100');
                authMenu.classList.add('opacity-0', 'scale-95');
                setTimeout(() => authMenu.classList.add('hidden'), 180);
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (authMenu && !authMenu.classList.contains('hidden') && authBtn && !authBtn.contains(e.target) && !authMenu.contains(e.target)) {
            authMenu.classList.remove('opacity-100', 'scale-100');
            authMenu.classList.add('opacity-0', 'scale-95');
            setTimeout(() => authMenu.classList.add('hidden'), 200);
        }
    });

    // Action triggers para el dropdown
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.getAttribute('data-action');
            if (authMenu) {
                authMenu.classList.remove('opacity-100', 'scale-100');
                authMenu.classList.add('opacity-0', 'scale-95');
                setTimeout(() => authMenu.classList.add('hidden'), 200);
            }

            if (action === 'open-login') {
                window.abrirModalAuth();
                window.switchAuthTab('login');
            } else if (action === 'open-register') {
                window.abrirModalAuth();
                window.switchAuthTab('register');
            } else if (action === 'go-dashboard') {
                window.navigateTo('view-dashboard');
            } else if (action === 'logout') {
                window.cerrarSesion();
            }
        });
    });
}

// LÓGICA DEL PRELOADER DINÁMICO OPTIMIZADO Y RESISTENTE A FALLAS DE ENTRADA
window.initPreloader = function () {
    const preloader = document.getElementById('preloader');
    const preloaderBar = document.getElementById('preloader-bar');

    const showWelcomeSafely = () => {
        if (window.welcomeModalScheduled) return;
        window.welcomeModalScheduled = true;

        const startedAt = Date.now();
        const waitForAuth = () => {
            const waited = Date.now() - startedAt;
            const authResolved = window.authReady === true || waited >= 900;
            if (!authResolved) {
                setTimeout(waitForAuth, 60);
                return;
            }
            if (typeof window.abrirModalBienvenida === 'function' && (!window.shouldShowWelcomeModal || window.shouldShowWelcomeModal())) {
                setTimeout(() => {
                    if (!window.shouldShowWelcomeModal || window.shouldShowWelcomeModal()) window.abrirModalBienvenida();
                }, 160);
            }
        };
        waitForAuth();
    };

    if (!preloader || !preloaderBar) {
        showWelcomeSafely();
        return;
    }

    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        window.entryReady = true;
        if (window.__milkarf_entry_watchdog) clearTimeout(window.__milkarf_entry_watchdog);
        preloaderBar.style.width = '100%';
        requestAnimationFrame(() => {
            preloader.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                preloader.classList.add('hidden');
                window.refreshIcons?.();
                showWelcomeSafely();
            }, 260);
        });
    };

    preloaderBar.style.width = '35%';
    requestAnimationFrame(() => { preloaderBar.style.width = '88%'; });
    const maxWait = window.matchMedia('(max-width: 768px)').matches ? 560 : 720;
    setTimeout(finish, maxWait);
};



// =========================================================================================
// MEJORAS UX 4-13: selector de mascota, tracking visual, puntos, canjes, móvil y admin
// =========================================================================================
window.getUserPets = function () {
    return Array.isArray(window.currentUser?.data?.mascotas) ? window.currentUser.data.mascotas : [];
};

window.getActivePet = function () {
    const pets = window.getUserPets();
    if (!pets.length) return null;
    if (!Number.isInteger(window.selectedDashboardPetIndex) || !pets[window.selectedDashboardPetIndex]) window.selectedDashboardPetIndex = 0;
    return pets[window.selectedDashboardPetIndex] || null;
};

window.getActivePetName = function () {
    const active = window.getActivePet();
    return (window.state?.nombreMascota || active?.nombre || '').trim();
};

window.renderMenuPetSelector = function () {
    const wrap = document.getElementById('menu-pet-selector-wrap');
    const select = document.getElementById('menu-active-pet-select');
    const hint = document.getElementById('menu-active-pet-hint');
    if (!wrap || !select) return;
    const pets = window.getUserPets();
    if (!window.currentUser || !window.currentUser.email || window.isAdmin) {
        wrap.classList.add('hidden');
        return;
    }
    if (!pets.length) {
        wrap.classList.remove('hidden');
        select.innerHTML = '<option value="">Sin mascotas registradas</option>';
        if (hint) hint.innerHTML = 'Registra una mascota desde tu perfil para asociar productos y raciones a su nombre.';
        return;
    }
    if (!Number.isInteger(window.selectedDashboardPetIndex) || !pets[window.selectedDashboardPetIndex]) window.selectedDashboardPetIndex = 0;
    wrap.classList.remove('hidden');
    select.innerHTML = pets.map((p, idx) => `<option value="${idx}" ${idx === window.selectedDashboardPetIndex ? 'selected' : ''}>${p.tipo === 'gato' ? '🐱' : '🐶'} ${window.escapeHTML(p.nombre || 'Mascota')} ${p.peso ? '· ' + window.escapeHTML(p.peso) + 'kg' : ''}</option>`).join('');
    const active = pets[window.selectedDashboardPetIndex];
    const calc = window.getPetCalcData ? window.getPetCalcData(active) : null;
    if (hint) hint.innerHTML = calc
        ? `<b>${window.escapeHTML(active.nombre || 'Mascota')}</b> tiene porción orientativa registrada: <b>${Number(calc.gramos || 0)}g/día</b>. El pedido quedará asociado a esta mascota.`
        : `<b>${window.escapeHTML(active.nombre || 'Mascota')}</b> será la mascota asociada al pedido. Puedes calcular su porción orientativa desde la calculadora o su perfil.`;
    window.refreshIcons?.(wrap);
};

window.selectPetForPurchase = function (value) {
    const idx = parseInt(value, 10);
    const pets = window.getUserPets();
    if (Number.isFinite(idx) && pets[idx]) {
        window.selectedDashboardPetIndex = idx;
        window.state.nombreMascota = pets[idx].nombre || '';
        window.renderMenuPetSelector();
        window.updateCartUI?.();
        window.showToast(`${pets[idx].nombre || 'Mascota'} seleccionado/a para este pedido.`, 'success');
    }
};

const __originalSelectDashboardPetUX = window.selectDashboardPet;
window.selectDashboardPet = function (index) {
    if (typeof __originalSelectDashboardPetUX === 'function') __originalSelectDashboardPetUX(index);
    window.renderMenuPetSelector?.();
};

const __originalActualizarUIAuthUX = window.actualizarUIAuth;
window.actualizarUIAuth = function () {
    if (typeof __originalActualizarUIAuthUX === 'function') __originalActualizarUIAuthUX();
    window.renderMenuPetSelector?.();
    window.renderPointsMilestones?.();
    window.renderUserOnboarding?.();
    window.startUserRedeemsListener?.(false);
};

window.renderPointsMilestones = function () {
    const box = document.getElementById('points-progress-detail');
    if (!box) return;
    const ptsDisp = Number(window.currentUser?.data?.puntos || 0);
    const ptsHist = Number(window.currentUser?.data?.puntos_historicos || ptsDisp || 0);
    const stages = [
        { label: 'Cachorro', min: 0, icon: '🐶' },
        { label: 'Consentido', min: 101, icon: '💛' },
        { label: 'VIP', min: 500, icon: '👑' }
    ];
    box.innerHTML = stages.map(st => `<div class="rounded-2xl px-2 py-3 border ${ptsHist >= st.min ? 'bg-white/20 border-white/30 text-white' : 'bg-white/10 border-white/10 text-white/60'}">
                <div class="text-base leading-none">${st.icon}</div>
                <p class="text-[8px] font-black uppercase tracking-widest mt-1">${st.label}</p>
                <p class="text-[8px] font-bold opacity-80">${st.min}+ ptos</p>
            </div>`).join('');
};

window.renderUserOnboarding = function () {
    const card = document.getElementById('user-onboarding-card');
    if (!card) return;
    const isLogged = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email) && !window.isAdmin;
    if (!isLogged) { card.classList.add('hidden'); return; }
    let show = false;
    try { show = localStorage.getItem('milkarf_show_onboarding') === '1'; } catch (e) { }
    if (show) {
        card.classList.remove('hidden');
        try { localStorage.removeItem('milkarf_show_onboarding'); } catch (e) { }
        setTimeout(() => card.classList.add('hidden'), 18000);
    }
};

const __originalRegistrarUX = window.registrarYGuardarMascota;
window.registrarYGuardarMascota = async function () {
    window.vibrate(20);
    if (!auth || !db) { window.showToast("Base de datos no configurada."); return; }

    const emailEl = document.getElementById('auth-email-reg');
    const nameEl = document.getElementById('auth-name-reg');
    const phoneEl = document.getElementById('auth-phone-reg');
    const passEl = document.getElementById('auth-pass-reg');
    const tipoEl = document.getElementById('reg-pet-tipo');
    const nombreEl = document.getElementById('reg-pet-nombre');
    const edadEl = document.getElementById('reg-pet-edad');
    const pesoEl = document.getElementById('reg-pet-peso');
    const razaEl = document.getElementById('reg-pet-raza');
    const cumpleEl = document.getElementById('reg-pet-cumple');
    const err = document.getElementById('auth-error');

    const email = emailEl ? emailEl.value.trim() : '';
    const clientName = nameEl ? nameEl.value.trim() : '';
    const rawPhone = phoneEl ? phoneEl.value.trim() : '';
    const phone = window.normalizePhone(rawPhone);
    const pass = passEl ? passEl.value : '';
    const tipo = tipoEl ? tipoEl.value : 'perro';
    const nombre = nombreEl ? nombreEl.value.trim() : '';
    const edad = edadEl ? edadEl.value.trim() : '';
    const peso = pesoEl ? pesoEl.value.trim() : '';
    const raza = razaEl ? razaEl.value.trim() : '';
    const cumple = cumpleEl ? cumpleEl.value : '';

    if (!clientName || !email || pass.length < 6 || !phone || phone.length < 10 || !nombre || !edad || !peso) {
        if (err) {
            err.textContent = "Completa tu nombre, correo, WhatsApp, contraseña y los datos requeridos de tu mascota.";
            err.classList.remove('hidden');
        }
        return;
    }

    if (cumple && window.isFutureBirthday(cumple)) {
        if (err) {
            err.textContent = "La fecha de nacimiento no puede ser futura.";
            err.classList.remove('hidden');
        }
        return;
    }

    try {
        if (err) err.classList.add('hidden');
        const btn = document.getElementById('btn-reg-email');
        if (btn) { btn.textContent = "Registrando..."; btn.disabled = true; }

        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        try { await updateProfile(cred.user, { displayName: clientName }); } catch (profileErr) { console.warn('No se pudo actualizar displayName:', profileErr); }

        const nuevaMascota = {
            id: Date.now().toString(),
            tipo: tipo,
            nombre: nombre,
            edad: edad,
            peso: peso,
            raza: raza || 'Mestizo',
            cumple: cumple
        };

        await setDoc(window.getUserPath(cred.user.uid), {
            uid: cred.user.uid,
            mascotas: [nuevaMascota],
            puntos: 0,
            puntos_historicos: 0,
            email: cred.user.email || '',
            nombre: clientName,
            nombre_persona: clientName,
            userName: clientName,
            displayName: clientName,
            telefono: phone,
            phone: phone,
            whatsapp: phone,
            updatedAt: serverTimestamp()
        }, { merge: true });

        try { localStorage.setItem('milkarf_contact_phone', phone); } catch (e) { }
        window.state.nombreMascota = nombre;

        [nameEl, emailEl, phoneEl, passEl, nombreEl, edadEl, pesoEl, razaEl, cumpleEl].forEach(el => { if (el) el.value = ''; });

        window.showToast("Cuenta, datos de contacto y mascota guardados con éxito.", 'success');
        window.cerrarModalAuth();
        if (btn) { btn.textContent = "Crear Cuenta y Entrar"; btn.disabled = false; }
    } catch (error) {
        if (err) {
            err.textContent = window.traductorErrores(error.code);
            err.classList.remove('hidden');
        }
        const btn = document.getElementById('btn-reg-email');
        if (btn) { btn.textContent = "Crear Cuenta y Entrar"; btn.disabled = false; }
    }
};

const __originalAddToCartUX = window.addToCart;
window.addToCart = function (prod) {
    const activeName = window.getActivePetName();
    if (activeName) window.state.nombreMascota = activeName;
    else if (window.currentUser && window.currentUser.email && !window.isAdmin && window.getUserPets().length > 1) {
        window.showToast('Selecciona primero para cuál mascota es este producto.');
        window.renderMenuPetSelector?.();
        return;
    }
    return __originalAddToCartUX?.(prod);
};

window.renderUserOrderSteps = function (status, points = 0) {
    const normalized = String(status || 'en_proceso').toLowerCase();
    const stepIndex = normalized === 'cancelado' ? -1 : (normalized === 'completado' ? 3 : (['confirmado', 'verificado'].includes(normalized) ? 2 : 1));
    const steps = [
        { label: 'Recibido', desc: 'Solicitud enviada' },
        { label: 'Confirmación', desc: 'Revisión admin' },
        { label: 'Completado', desc: points > 0 ? `+${points} ptos` : 'Pedido cerrado' }
    ];
    if (stepIndex === -1) return `<div class="mt-3 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-[10px] font-bold text-gray-500">Pedido cancelado. Escríbenos si necesitas revisarlo.</div>`;
    return `<div class="mt-4 grid grid-cols-3 gap-2">${steps.map((s, idx) => {
        const active = idx < stepIndex;
        const current = idx === stepIndex - 1;
        return `<div class="rounded-2xl border p-3 text-center ${active ? 'bg-green/10 border-green/25 text-green-dark dark:text-green' : 'bg-purple-light dark:bg-[#0d0718] border-purple-border/30 dark:border-purple/20 text-gray-400'}">
                    <div class="w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-[10px] font-black ${active ? 'bg-green text-purple-dark' : 'bg-white dark:bg-darkcard'}">${active ? '✓' : idx + 1}</div>
                    <p class="text-[8px] font-black uppercase tracking-widest ${current ? 'text-pink' : ''}">${s.label}</p>
                    <p class="text-[8px] font-semibold mt-0.5 leading-tight">${s.desc}</p>
                </div>`;
    }).join('')}</div>`;
};

window.renderUserOrders = function (orders = []) {
    const container = document.getElementById('user-orders-list');
    if (!container) return;
    if (!orders.length) {
        container.innerHTML = '<p class="text-xs text-gray-500 font-medium bg-white dark:bg-darkcard border border-purple-border/30 rounded-2xl p-4">Cuando realices un pedido, aparecerá aquí como <b>En proceso</b>. El equipo Milkarf lo confirma desde administración y tus puntos se suman al completarlo.</p>';
        return;
    }
    container.innerHTML = orders.slice(0, 10).map(o => {
        const status = String(o.status || 'en_proceso').toLowerCase();
        const info = window.getOrderStatusInfo(status);
        const date = o.createdAt ? new Date(o.createdAt).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Pedido reciente';
        const items = Array.isArray(o.items) ? o.items.map(i => `${Number(i.qty || 0)}x ${i.name || 'Producto'} ${i.weight ? '(' + i.weight + ')' : ''}${i.forPet ? ' · ' + i.forPet : ''}`).join(' · ') : 'Pedido Milkarf';
        const total = typeof o.total === 'number' ? '$' + o.total.toFixed(2) : '';
        const points = Number(o.pointsAwarded || o.pointsGranted || 0);
        let helper = 'Tu pedido fue recibido por WhatsApp y está pendiente de confirmación por el equipo Milkarf.';
        if (['confirmado', 'verificado'].includes(status)) helper = 'El equipo Milkarf ya revisó tu pedido. Está en camino a completarse.';
        if (status === 'completado') helper = points > 0 ? `Pedido completado. Este pedido sumó ${points} puntos a tu cuenta.` : 'Pedido completado por administración.';
        if (status === 'cancelado') helper = 'Pedido cancelado. Escríbenos si necesitas revisar este pedido.';
        return `<div class="relative bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-5 text-left overflow-hidden shadow-sm">
                    <div class="absolute top-0 left-0 w-1 h-full ${info.bar}"></div>
                    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pl-1">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap"><p class="text-[10px] text-gray-400 font-black uppercase tracking-widest">${date}</p></div>
                            <h5 class="text-sm font-black text-purple-dark dark:text-white mt-1 leading-snug">${window.escapeHTML(items)}</h5>
                            <p class="text-xs text-gray-500 dark:text-gray-400 font-bold mt-1">${total}</p>
                        </div>
                        <span class="shrink-0 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${info.classes}">${info.label}</span>
                    </div>
                    ${window.renderUserOrderSteps(status, points)}
                    <div class="mt-3 ml-1 bg-purple-light/70 dark:bg-[#0d0718] border border-purple-border/30 dark:border-purple/20 rounded-xl p-3">
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed">${window.escapeHTML(helper)}</p>
                        ${points > 0 ? `<div class="mt-2 inline-flex items-center gap-1 bg-green/15 text-green-dark dark:text-green border border-green/20 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest"><i data-lucide="sparkles" class="w-3 h-3"></i> +${points} ptos ganados</div>` : ''}
                    </div>
                </div>`;
    }).join('');
    window.refreshIcons?.(container);
};

window.startUserRedeemsListener = function (force = false) {
    const container = document.getElementById('user-redeems-history');
    if (!container) return;
    const isLogged = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email) && !window.isAdmin;
    if (!isLogged) {
        container.innerHTML = '<p class="text-xs text-gray-500 font-medium">Inicia sesión para ver tu historial de canjes.</p>';
        return;
    }
    if (!db) {
        container.innerHTML = '<p class="text-xs text-pink font-bold">Firebase no está disponible para consultar canjes.</p>';
        return;
    }
    if (unsubUserRedeems && !force) return;
    if (unsubUserRedeems) { unsubUserRedeems(); unsubUserRedeems = null; }
    try {
        const qRef = window.secureUserQuery(window.getRedeemsCollectionRef(), window.currentUser.uid);
        unsubUserRedeems = onSnapshot(qRef, (snap) => {
            const redeems = []; snap.forEach(d => redeems.push({ id: d.id, ...d.data() }));
            redeems.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            window.renderUserRedeemHistory(redeems);
        }, (error) => {
            console.warn('No se pudo leer historial de canjes:', error);
            container.innerHTML = '<p class="text-xs text-pink font-bold bg-pink/10 border border-pink/20 rounded-xl p-3">No se pudieron cargar tus canjes. Revisa permisos de Firestore para canjes.</p>';
        });
    } catch (e) { console.error(e); }
};

window.renderUserRedeemHistory = function (redeems = []) {
    const container = document.getElementById('user-redeems-history');
    if (!container) return;
    if (!redeems.length) { container.innerHTML = '<p class="text-xs text-gray-500 font-medium">Aún no has solicitado canjes.</p>'; return; }
    container.innerHTML = redeems.slice(0, 5).map(r => {
        const status = String(r.status || 'solicitado').toLowerCase();
        const cls = status === 'entregado' ? 'bg-purple/10 text-purple border-purple/20' : status === 'aprobado' ? 'bg-green/15 text-green-dark dark:text-green border-green/20' : 'bg-pink/10 text-pink border-pink/20';
        return `<div class="bg-white dark:bg-darkcard rounded-xl border border-purple-border/30 dark:border-purple/20 p-3 flex items-start justify-between gap-3">
                    <div><p class="text-xs font-black text-purple-dark dark:text-white">${window.escapeHTML(r.itemName || r.benefit || 'Canje Milkarf')}</p><p class="text-[10px] text-gray-500 font-semibold mt-1">${Number(r.points || 0)} ptos · ${r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-VE') : 'reciente'}</p></div>
                    <span class="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${cls}">${window.escapeHTML(status)}</span>
                </div>`;
    }).join('');
};

window.renderRedeemItems = function () {
    const container = document.getElementById('redeem-items-list');
    if (!container) return;
    const isLogged = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email) && !window.isAdmin;
    if (!isLogged) {
        container.innerHTML = '<p class="text-xs text-gray-500 font-medium bg-white dark:bg-darkcard rounded-xl p-3 border border-purple-border/30">Inicia sesión para ver beneficios disponibles y canjear tus puntos.</p>';
        return;
    }
    const pts = Number(window.currentUser.data?.puntos || 0);
    container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">${window.REDEEM_ITEMS.map(item => {
        const canUse = pts >= item.points;
        const missing = Math.max(0, item.points - puntos);
        return `<div class="bg-white dark:bg-darkcard rounded-3xl border ${canUse ? 'border-green/30' : 'border-purple-border/30 dark:border-purple/20'} p-4 shadow-sm text-left flex flex-col justify-between gap-4">
                    <div><div class="flex items-start justify-between gap-3"><div><h5 class="text-sm font-black text-purple-dark dark:text-white">${window.escapeHTML(item.name)}</h5><p class="text-xs text-gray-500 dark:text-gray-400 font-semibold leading-relaxed mt-1">${window.escapeHTML(item.benefit)}</p></div><div class="shrink-0 bg-pink/10 text-pink border border-pink/20 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">${item.points} ptos</div></div>
                    <div class="mt-3 w-full bg-purple-light dark:bg-[#0d0718] rounded-full h-2 overflow-hidden"><div class="bg-green h-2 rounded-full" style="width:${Math.min(100, (pts / item.points) * 100)}%"></div></div>
                    <p class="text-[10px] font-bold ${canUse ? 'text-green-dark dark:text-green' : 'text-gray-400'} mt-2">${canUse ? 'Disponible para canjear' : `Te faltan ${missing} ptos`}</p></div>
                    <button type="button" onclick="window.canjearPuntosUsuario('${item.id}')" class="w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${canUse ? 'bg-green text-purple-dark hover:bg-[#a6b621]' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}" ${canUse ? '' : 'disabled'}>Canjear beneficio</button>
                </div>`;
    }).join('')}</div>`;
    window.refreshIcons?.(container);
};

const __originalCanjearUX = window.canjearPuntosUsuario;
window.canjearPuntosUsuario = async function (itemId) {
    const result = await __originalCanjearUX?.(itemId);
    setTimeout(() => window.startUserRedeemsListener?.(true), 600);
    return result;
};

const __originalClearCartUX = window.clearCart;
window.clearCart = function () {
    const r = __originalClearCartUX?.();
    window.renderMenuPetSelector?.();
    return r;
};

window.loadAdminSummary = async function () {
    window.ensureAdminSummaryHelpers?.();
    const container = document.getElementById('admin-summary-container');
    if (!container) return;
    if (!window.isAdmin) { container.innerHTML = window.adminEmptyState('Acceso restringido', 'Debes iniciar sesión como administrador para ver el resumen.', 'lock'); return; }
    if (!db) { container.innerHTML = window.adminEmptyState('Firebase no disponible', 'No se pudo conectar con la base de datos.', 'wifi-off'); return; }
    container.innerHTML = window.adminLoadingState('Construyendo resumen operativo...');
    try {
        const [ordersSnap, usersSnap, redeemsSnap] = await Promise.all([getDocs(window.secureAdminQuery(window.getOrdersCollectionRef())), getDocs(window.secureAdminQuery(window.getUsersCollectionRef())), getDocs(window.secureAdminQuery(window.getRedeemsCollectionRef()))]);
        const orders = []; ordersSnap.forEach(d => orders.push({ id: d.id, ...d.data() }));
        const users = []; usersSnap.forEach(d => users.push({ id: d.id, ...d.data() }));
        const redeems = []; redeemsSnap.forEach(d => redeems.push({ id: d.id, ...d.data() }));
        window.adminCache = { orders, users, redeems };
        const inProcess = orders.filter(o => ['pendiente', 'en_proceso', 'solicitado'].includes(String(o.status || 'en_proceso').toLowerCase())).length;
        const completed = orders.filter(o => String(o.status || '').toLowerCase() === 'completado').length;
        const pendingRedeems = redeems.filter(r => ['solicitado', 'pendiente'].includes(String(r.status || 'solicitado').toLowerCase())).length;
        const upcoming = window.computeAdminBirthdays(users).filter(p => p.daysLeft <= 30).length;
        const salesTotal = orders.filter(o => String(o.status || '').toLowerCase() === 'completado').reduce((s, o) => s + Number(o.total || 0), 0);
        const productCount = {};
        orders.forEach(o => (Array.isArray(o.items) ? o.items : []).forEach(i => { const name = i.name || 'Producto'; productCount[name] = (productCount[name] || 0) + Number(i.qty || 0); }));
        const topProduct = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0];
        const topUser = users.map(u => ({ email: u.email || u.id, pts: Number(u.puntos_historicos || u.puntos || 0) })).sort((a, b) => b.pts - a.pts)[0];
        const kpi = [
            { label: 'Pedidos en proceso', value: inProcess, icon: 'clock-3', color: 'text-pink', bg: 'bg-pink/10', tab: 'pedidos' },
            { label: 'Completados', value: completed, icon: 'badge-check', color: 'text-purple', bg: 'bg-purple/10', tab: 'pedidos' },
            { label: 'Ventas completadas', value: '$' + salesTotal.toFixed(2), icon: 'wallet', color: 'text-green-dark dark:text-green', bg: 'bg-green/15', tab: 'pedidos' },
            { label: 'Clientes', value: users.length, icon: 'users', color: 'text-purple', bg: 'bg-purple/10', tab: 'usuarios' },
            { label: 'Canjes pendientes', value: pendingRedeems, icon: 'gift', color: 'text-pink', bg: 'bg-pink/10', tab: 'canjes' },
            { label: 'Cumples 30 días', value: upcoming, icon: 'cake', color: 'text-green-dark dark:text-green', bg: 'bg-green/15', tab: 'cumples' }
        ];
        const recentOrders = orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4);
        const recentRedeems = redeems.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3);
        container.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">${kpi.map(i => `<button onclick="window.switchAdminTab('${i.tab}')" class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-4 text-left shadow-sm hover:shadow-md transition-all active:scale-95"><div class="w-10 h-10 rounded-2xl ${i.bg} ${i.color} flex items-center justify-center mb-3"><i data-lucide="${i.icon}" class="w-5 h-5"></i></div><p class="text-xl font-black text-purple-dark dark:text-white leading-none">${i.value}</p><p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2 leading-tight">${i.label}</p></button>`).join('')}</div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm"><h3 class="text-lg font-black text-purple-dark dark:text-white mb-2">Producto más pedido</h3><p class="text-2xl font-black text-pink">${topProduct ? window.escapeHTML(topProduct[0]) : 'Sin datos'}</p><p class="text-xs text-gray-500 font-bold mt-1">${topProduct ? `${topProduct[1]} unidades registradas` : 'Aparecerá cuando existan pedidos.'}</p></div>
                    <div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm"><h3 class="text-lg font-black text-purple-dark dark:text-white mb-2">Cliente con más puntos</h3><p class="text-base font-black text-purple-dark dark:text-white truncate">${topUser ? window.escapeHTML(topUser.email) : 'Sin datos'}</p><p class="text-xs text-gray-500 font-bold mt-1">${topUser ? `${topUser.pts} puntos históricos` : 'Aparecerá al confirmar compras.'}</p></div>
                    <div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm"><h3 class="text-lg font-black text-purple-dark dark:text-white mb-2">Acciones sugeridas</h3><div class="space-y-2"><button onclick="window.switchAdminTab('pedidos')" class="w-full bg-purple-light dark:bg-purple/20 text-purple dark:text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl">Revisar pedidos</button><button onclick="window.switchAdminTab('canjes')" class="w-full bg-pink/10 text-pink font-black text-[10px] uppercase tracking-widest py-3 rounded-xl">Gestionar canjes</button></div></div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5"><div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm"><div class="flex justify-between items-center mb-4"><h3 class="text-lg font-black text-purple-dark dark:text-white">Pedidos recientes</h3><button onclick="window.switchAdminTab('pedidos')" class="text-[10px] font-black text-purple uppercase tracking-widest">Ver todos</button></div><div class="space-y-3">${recentOrders.length ? recentOrders.map(o => window.buildAdminMiniOrder(o)).join('') : window.adminEmptyState('Sin pedidos todavía', 'Cuando entren pedidos, aparecerán aquí.', 'clipboard-list')}</div></div><div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-5 shadow-sm"><div class="flex justify-between items-center mb-4"><h3 class="text-lg font-black text-purple-dark dark:text-white">Canjes recientes</h3><button onclick="window.switchAdminTab('canjes')" class="text-[10px] font-black text-purple uppercase tracking-widest">Gestionar</button></div><div class="space-y-3">${recentRedeems.length ? recentRedeems.map(r => window.buildAdminRedeemMini(r)).join('') : window.adminEmptyState('Sin canjes pendientes', 'Las solicitudes de puntos aparecerán aquí.', 'gift')}</div></div></div>`;
        window.refreshIcons?.(container);
    } catch (e) {
        console.error(e);
        container.innerHTML = window.adminEmptyState('No se pudo cargar el resumen', 'Revisa la conexión o los permisos de Firestore.', 'alert-triangle');
    }
};


/* =========================
   UX PEDIDOS / PERFIL / MÓVIL
   ========================= */
window.userOrdersHistoryOpen = false;
window.userOrdersCache = [];

window.getLocalOrdersKey = function () {
    const uid = auth?.currentUser?.uid || window.currentUser?.uid || 'guest';
    return 'milkarf_user_orders_cache_' + uid + '_' + window.getClientToken();
};

window.getLocalUserOrders = function () {
    try {
        const raw = localStorage.getItem(window.getLocalOrdersKey());
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
};

window.setLocalUserOrders = function (orders = []) {
    try {
        const unique = Array.from(new Map((orders || []).filter(Boolean).map(o => [String(o.id || o.localId || Math.random()), o])).values())
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 20);
        localStorage.setItem(window.getLocalOrdersKey(), JSON.stringify(unique));
    } catch (e) { }
};

window.cacheUserOrderLocal = function (order) {
    if (!order) return;
    const current = window.getLocalUserOrders();
    const id = String(order.id || order.localId || ('local_' + Date.now()));
    const filtered = current.filter(o => String(o.id || o.localId) !== id);
    filtered.unshift({ ...order, id });
    window.setLocalUserOrders(filtered);
};

window.mergeOrdersById = function (...lists) {
    const map = new Map();
    lists.flat().filter(Boolean).forEach(o => {
        const id = String(o.id || o.localId || JSON.stringify(o.items || []) + (o.createdAt || ''));
        const prev = map.get(id) || {};
        map.set(id, { ...prev, ...o, id });
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

window.toggleUserOrdersHistory = function (force) {
    if (typeof force === 'boolean') window.userOrdersHistoryOpen = force;
    else window.userOrdersHistoryOpen = !window.userOrdersHistoryOpen;
    const wrap = document.getElementById('user-orders-history-wrap');
    const btn = document.getElementById('btn-toggle-orders-history');
    if (wrap) wrap.classList.toggle('hidden', !window.userOrdersHistoryOpen);
    if (btn) {
        btn.innerHTML = window.userOrdersHistoryOpen
            ? '<i data-lucide="chevron-up" class="w-4 h-4"></i> Ocultar historial de pedidos'
            : '<i data-lucide="history" class="w-4 h-4"></i> Ver historial de pedidos';
    }
    window.refreshIcons?.();
};

window.buildUserOrderCard = function (o, { compact = false } = {}) {
    const status = String(o.status || 'en_proceso').toLowerCase();
    const info = window.getOrderStatusInfo(status);
    const date = o.createdAt ? new Date(o.createdAt).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Pedido reciente';
    const itemsArr = Array.isArray(o.items) ? o.items : [];
    const items = itemsArr.length ? itemsArr.map(i => `${Number(i.qty || 0)}x ${i.name || 'Producto'} ${i.weight ? '(' + i.weight + ')' : ''}${i.forPet ? ' · ' + i.forPet : ''}`).join(' · ') : 'Pedido Milkarf';
    const total = typeof o.total === 'number' ? '$' + o.total.toFixed(2) : '';
    const points = Number(o.pointsAwarded || o.pointsGranted || 0);
    let helper = 'Pedido pendiente por confirmar. El equipo Milkarf validará disponibilidad y continuará la atención por WhatsApp.';
    if (['confirmado', 'verificado'].includes(status)) helper = 'Pedido revisado por administración. Está en proceso interno de cierre.';
    if (status === 'completado') helper = points > 0 ? `Pedido completado. Este pedido sumó ${points} puntos a tu cuenta.` : 'Pedido completado por administración.';
    if (status === 'cancelado') helper = 'Pedido cancelado. Escríbenos si necesitas revisarlo.';
    return `<div class="relative bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-${compact ? '4' : '5'} text-left overflow-hidden shadow-sm">
                <div class="absolute top-0 left-0 w-1 h-full ${info.bar}"></div>
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pl-1">
                    <div class="min-w-0">
                        <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest">${date}</p>
                        <h5 class="text-sm font-black text-purple-dark dark:text-white mt-1 leading-snug">${window.escapeHTML(items)}</h5>
                        ${total ? `<p class="text-xs text-gray-500 dark:text-gray-400 font-bold mt-1">${total}</p>` : ''}
                    </div>
                    <span class="shrink-0 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${info.classes}">${info.label}</span>
                </div>
                ${!compact && typeof window.renderUserOrderSteps === 'function' ? window.renderUserOrderSteps(status, points) : ''}
                <div class="mt-3 ml-1 bg-purple-light/70 dark:bg-[#0d0718] border border-purple-border/30 dark:border-purple/20 rounded-xl p-3">
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed">${window.escapeHTML(helper)}</p>
                    ${points > 0 ? `<div class="mt-2 inline-flex items-center gap-1 bg-green/15 text-green-dark dark:text-green border border-green/20 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest"><i data-lucide="sparkles" class="w-3 h-3"></i> +${points} ptos ganados</div>` : ''}
                </div>
            </div>`;
};

window.renderUserOrders = function (orders = []) {
    const activeContainer = document.getElementById('user-active-order') || document.getElementById('user-orders-list');
    const historyContainer = document.getElementById('user-orders-history');
    if (!activeContainer) return;
    const merged = window.mergeOrdersById(orders, window.getLocalUserOrders()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    window.userOrdersCache = merged;
    window.setLocalUserOrders(merged);

    const pendingStatuses = ['pendiente', 'en_proceso', 'solicitado'];
    const pending = merged.filter(o => pendingStatuses.includes(String(o.status || 'en_proceso').toLowerCase()));
    const history = merged.filter(o => !pendingStatuses.includes(String(o.status || 'en_proceso').toLowerCase()));

    if (pending.length) {
        activeContainer.innerHTML = window.buildUserOrderCard(pending[0], { compact: false });
    } else {
        activeContainer.innerHTML = '<p class="text-xs text-gray-500 font-medium bg-white dark:bg-darkcard border border-purple-border/30 rounded-2xl p-4">No tienes pedidos pendientes por confirmar. Cuando realices uno nuevo, aparecerá aquí como <b>En proceso</b>.</p>';
    }

    if (historyContainer) {
        historyContainer.innerHTML = history.length
            ? history.slice(0, 12).map(o => window.buildUserOrderCard(o, { compact: true })).join('')
            : '<p class="text-xs text-gray-500 font-medium bg-white dark:bg-darkcard border border-purple-border/30 rounded-2xl p-4">Aún no tienes pedidos completados o cancelados en el historial.</p>';
    }
    const hiddenLegacy = document.getElementById('user-orders-list');
    if (hiddenLegacy && hiddenLegacy !== activeContainer) hiddenLegacy.innerHTML = '';
    window.refreshIcons?.();
};

window.startUserOrdersListener = function (forceNavigate = false) {
    const activeContainer = document.getElementById('user-active-order') || document.getElementById('user-orders-list');
    if (!activeContainer) return;
    const localOrders = window.getLocalUserOrders();
    if (localOrders.length) window.renderUserOrders(localOrders);
    if (!db) {
        if (!localOrders.length) activeContainer.innerHTML = '<p class="text-xs text-pink font-bold bg-pink/10 border border-pink/20 rounded-xl p-3">Firebase no está disponible para consultar pedidos.</p>';
        return;
    }
    const authUser = auth?.currentUser || null;
    const uid = (window.currentUser && window.currentUser.uid) || authUser?.uid || null;
    const hasRealSession = !!(window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email));
    const token = window.getClientToken();
    if (!uid) {
        activeContainer.innerHTML = '<p class="text-xs text-gray-500 font-medium bg-white dark:bg-darkcard border border-purple-border/30 rounded-2xl p-4">Realiza un pedido para ver su estado aquí.</p>';
        return;
    }
    if (unsubUserOrders) { try { unsubUserOrders(); } catch (e) { } unsubUserOrders = null; }
    if (!localOrders.length) activeContainer.innerHTML = '<p class="text-xs text-gray-500 font-semibold bg-white dark:bg-darkcard rounded-xl p-3 border border-purple-border/30">Consultando tus pedidos...</p>';

    const ordersRef = window.getOrdersCollectionRef();
    const snapshots = { uid: [], token: [] };
    const unsubs = [];
    const renderMerged = () => window.renderUserOrders(window.mergeOrdersById(snapshots.uid, snapshots.token, window.getLocalUserOrders()));
    const listen = (key, qRef) => {
        try {
            const unsub = onSnapshot(qRef, (snapshot) => {
                const arr = [];
                snapshot.forEach(d => arr.push({ id: d.id, ...d.data() }));
                snapshots[key] = arr;
                renderMerged();
            }, (error) => {
                console.warn('No se pudo escuchar pedidos por ' + key + ':', error);
                renderMerged();
            });
            unsubs.push(unsub);
        } catch (error) {
            console.warn('Error creando listener de pedidos por ' + key + ':', error);
        }
    };
    if (uid) listen('uid', window.secureUserQuery(ordersRef, uid));
    unsubUserOrders = () => unsubs.forEach(fn => { try { fn(); } catch (e) { } });
    if (forceNavigate) window.navigateTo?.('view-dashboard');
};

window.refreshMobileBottomNav = function (targetId) {
    document.querySelectorAll('#mobile-bottom-nav button').forEach(btn => {
        btn.classList.toggle('active-mobile-nav', btn.getAttribute('data-target') === targetId);
    });
    document.querySelectorAll('.milkarf-header .milkarf-nav-link').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-target') === targetId);
    });
};

const __originalNavigateToFastUX = window.navigateTo;
window.navigateTo = function (targetId) {
    const result = __originalNavigateToFastUX?.(targetId);
    window.refreshMobileBottomNav?.(targetId);
    return result;
};

window.initFastMobileNav = function () {
    const nav = document.getElementById('mobile-bottom-nav');
    if (!nav || nav.dataset.fastReady === '1') return;
    nav.dataset.fastReady = '1';
    let lastTarget = '';
    let lastAt = 0;
    const go = (event) => {
        const btn = event.target.closest('button[data-target]');
        if (!btn) return;
        const target = btn.getAttribute('data-target');
        const now = Date.now();
        if (lastTarget === target && now - lastAt < 250) { event.preventDefault(); return; }
        lastTarget = target; lastAt = now;
        event.preventDefault();
        window.navigateTo(target);
    };
    nav.addEventListener('pointerdown', go, { passive: false });
    nav.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-target]');
        if (!btn) return;
        if (Date.now() - lastAt < 380) event.preventDefault();
    }, true);
};


// =========================================================================================
// NAVEGACIÓN SPA CON HISTORIAL + SINCRONIZACIÓN PENDIENTE + WHATSAPP MÓVIL
// =========================================================================================
window.VIEW_ROUTES = {
    'view-home': '#inicio',
    'view-mision': '#mision',
    'view-calc': '#calculadora',
    'view-perros': '#menu-perros',
    'view-gatos': '#menu-gatos',
    'view-snacks': '#snacks',
    'view-faq': '#guia-natural',
    'view-dashboard': '#perfil',
    'view-redeems': '#canje-puntos',
    'view-cart': '#carrito',
    'view-admin': '#admin'
};
window.ROUTE_VIEWS = Object.fromEntries(Object.entries(window.VIEW_ROUTES).map(([view, hash]) => [hash, view]));

window.getActiveViewId = function () {
    return document.querySelector('.view.active')?.id || 'view-home';
};

window.getViewFromHash = function (hash = window.location.hash) {
    const clean = hash || '#inicio';
    return window.ROUTE_VIEWS?.[clean] || 'view-home';
};

window.closeTopLayerIfNeeded = function () {
    if (window.menuOpen) { window.forceCloseMenu?.(); return true; }
    const authMenu = document.getElementById('auth-dropdown-menu');
    if (authMenu && !authMenu.classList.contains('hidden')) {
        authMenu.classList.remove('opacity-100', 'scale-100');
        authMenu.classList.add('opacity-0', 'scale-95');
        setTimeout(() => authMenu.classList.add('hidden'), 120);
        return true;
    }
    const closers = [
        ['modal-delivery-note', window.cerrarDeliveryNote],
        ['modal-admin-canje', window.cerrarModalAdminCanje],
        ['modal-admin-login', window.cerrarModalAdmin],
        ['modal-descuento', window.cerrarModalDescuento],
        ['modal-auth', window.cerrarModalAuth],
        ['modal-bienvenida', window.cerrarModalBienvenida]
    ];
    for (const [id, closer] of closers) {
        const modal = document.getElementById(id);
        if (modal && !modal.classList.contains('hidden')) {
            if (typeof closer === 'function') closer();
            else { modal.classList.add('hidden', 'opacity-0'); modal.classList.remove('flex'); }
            return true;
        }
    }
    return false;
};

const __milkarfNavigateCoreForHistory = window.navigateTo;
window.navigateTo = function (targetId, options = {}) {
    if (window.location.pathname.endsWith('admin.html')) {
        const adminView = document.getElementById('view-admin');
        if (adminView) adminView.classList.add('active');
        return true;
    }
    const opts = { pushHistory: true, replaceHistory: false, fromPopState: false, ...options };
    const target = document.getElementById(targetId);
    if (!target || !target.classList.contains('view')) {
        console.warn('Vista no encontrada para navegación:', targetId);
        targetId = 'view-home';
    }
    const currentView = window.getActiveViewId();
    if (currentView === targetId) {
        if (window.menuOpen) window.forceCloseMenu?.();
        window.refreshMobileBottomNav?.(targetId);
        if (opts.replaceHistory) {
            try { history.replaceState({ view: targetId }, '', window.VIEW_ROUTES[targetId] || '#inicio'); } catch (e) { }
        }
        return;
    }
    const result = __milkarfNavigateCoreForHistory?.(targetId);
    window.refreshMobileBottomNav?.(targetId);
    try {
        const route = window.VIEW_ROUTES[targetId] || '#inicio';
        if (opts.replaceHistory) history.replaceState({ view: targetId }, '', route);
        else if (opts.pushHistory && !opts.fromPopState) history.pushState({ view: targetId }, '', route);
    } catch (error) { console.warn('No se pudo actualizar historial:', error); }
    return result;
};

window.initHistoryNavigation = function () {
    if (window.__milkarf_history_ready || window.location.pathname.endsWith('admin.html')) return;
    window.__milkarf_history_ready = true;
    const initialView = window.getViewFromHash(window.location.hash);
    window.navigateTo(initialView, { pushHistory: false, replaceHistory: true });
    window.addEventListener('popstate', (event) => {
        const activeNow = window.getActiveViewId();
        if (window.closeTopLayerIfNeeded?.()) {
            try { history.pushState({ view: activeNow }, '', window.VIEW_ROUTES[activeNow] || '#inicio'); } catch (e) { }
            return;
        }
        const targetView = event.state?.view || window.getViewFromHash(window.location.hash) || 'view-home';
        window.navigateTo(targetView, { pushHistory: false, fromPopState: true });
    });
};

/* Checkout WhatsApp: refreshCheckoutWhatsAppLink se define una sola vez en el patch final.
   Los guards instalados abajo llaman a window.refreshCheckoutWhatsAppLink en tiempo de ejecución. */

window.installCheckoutNativeLinkGuards = function () {
    if (window.__milkarf_checkout_native_link_ready) return;
    window.__milkarf_checkout_native_link_ready = true;
    const attach = () => {
        const btn = document.getElementById('btn-finalizar-pedido');
        if (!btn || btn.__milkarf_native_link_bound) return;
        btn.__milkarf_native_link_bound = true;
        const prepare = () => window.refreshCheckoutWhatsAppLink?.();
        ['pointerdown', 'touchstart', 'mousedown', 'focus'].forEach(evt => {
            btn.addEventListener(evt, prepare, { passive: true });
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
    else attach();
};
window.installCheckoutNativeLinkGuards?.();

const __milkarfUpdateCartForWhatsApp = window.updateCart;
if (typeof __milkarfUpdateCartForWhatsApp === 'function') {
    window.updateCart = function (...args) {
        const result = __milkarfUpdateCartForWhatsApp.apply(this, args);
        window.refreshCheckoutWhatsAppLink?.();
        return result;
    };
}

window.PENDING_ORDER_SYNC_KEY = 'milkarf_pending_orders_to_sync';
window.queuePendingOrderForSync = function (order) {
    if (!order || !order.id) return;
    try {
        const pending = JSON.parse(localStorage.getItem(window.PENDING_ORDER_SYNC_KEY) || '[]');
        const filtered = pending.filter(o => o.id !== order.id);
        filtered.unshift({ ...order, queuedAt: new Date().toISOString(), localId: order.localId || order.id });
        localStorage.setItem(window.PENDING_ORDER_SYNC_KEY, JSON.stringify(filtered.slice(0, 10)));
    } catch (error) { console.warn('No se pudo guardar pedido pendiente de sincronizar:', error); }
};

window.syncPendingOrders = async function () {
    if (!db || !window.getOrderDocRef) return;
    let pending = [];
    try { pending = JSON.parse(localStorage.getItem(window.PENDING_ORDER_SYNC_KEY) || '[]'); } catch (e) { pending = []; }
    if (!pending.length) return;
    const remaining = [];
    for (const order of pending) {
        try {
            const orderId = order.localId || order.id || ('local_' + Date.now());
            let writeUid = auth?.currentUser?.uid || window.currentUser?.uid || null;
            if (!writeUid && auth) {
                try {
                    const anonCred = await signInAnonymously(auth);
                    writeUid = anonCred?.user?.uid || null;
                    window.currentUser = anonCred?.user || window.currentUser;
                } catch (authError) {
                    console.warn('No se pudo crear sesión anónima para sincronizar pedido:', authError);
                }
            }
            if (!writeUid) throw new Error('No hay sesión autenticada para sincronizar el pedido.');
            const cleanOrder = { ...order, uid: order.uid && order.uid !== 'anonimo' ? order.uid : writeUid, localOnly: false, localId: orderId };
            delete cleanOrder.id;
            await setDoc(window.getOrderDocRef(orderId), window.sanitizeClientOrderForWrite(cleanOrder), { merge: true });
            window.cacheUserOrderLocal?.({ ...order, id: orderId, localOnly: false });
        } catch (error) {
            console.warn('Pedido pendiente no sincronizado aún:', error);
            remaining.push(order);
        }
    }
    try { localStorage.setItem(window.PENDING_ORDER_SYNC_KEY, JSON.stringify(remaining)); } catch (e) { }
    if (pending.length !== remaining.length) window.startUserOrdersListener?.();
};

window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        window.syncPendingOrders?.();
        if (window.getActiveViewId?.() === 'view-cart') window.restoreCartPostOrderStateIfNeeded?.();
    }
});
window.addEventListener('pageshow', () => {
    if (window.getActiveViewId?.() === 'view-cart') window.restoreCartPostOrderStateIfNeeded?.();
});
window.addEventListener('online', () => window.syncPendingOrders?.());



/* =========================================================
   FIRESTORE ADMIN RESILIENTE + DIAGNÓSTICO DE PERMISOS
   Corrige fallos del resumen cuando una colección falla y
   muestra errores útiles sin romper todo el panel.
   ========================================================= */
window.getAdminAuthDebug = function () {
    const u = auth?.currentUser || window.currentUser || null;
    return {
        uid: u?.uid || '',
        email: (u?.email || '').toLowerCase(),
        anonymous: !!u?.isAnonymous,
        isAdminByCode: !!(u?.email && window.ADMIN_EMAILS?.includes((u.email || '').toLowerCase()))
    };
};

window.renderFirestorePermissionHelp = function (error, context = 'Firestore') {
    const info = window.getAdminAuthDebug?.() || {};
    const code = error?.code || error?.name || 'error';
    const msg = error?.message || 'Sin detalle del navegador.';
    const email = info.email || 'sin correo detectado';
    const uid = info.uid || 'sin uid detectado';
    return `
                <div class="rounded-3xl border border-pink/30 bg-pink/10 p-5 text-left">
                    <div class="flex items-start gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-pink/15 text-pink flex items-center justify-center shrink-0"><i data-lucide="shield-alert" class="w-5 h-5"></i></div>
                        <div class="min-w-0">
                            <h4 class="text-sm font-black text-pink uppercase tracking-widest">${String(code).toLowerCase().includes('type') ? 'Error de código en ' : 'Permiso bloqueado en '}${window.escapeHTML(context)}</h4>
                            <p class="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">${String(code).toLowerCase().includes('type') ? 'El panel encontró un error interno al construir esta sección. No es un problema de reglas; revisa el detalle técnico.' : 'Firestore rechazó esta lectura. Revisa que las reglas publicadas incluyan este correo como admin y que la consulta tenga limit().'}</p>
                            <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-bold text-purple-dark dark:text-white">
                                <div class="bg-white/80 dark:bg-darkcard rounded-xl p-3 border border-pink/10"><span class="opacity-50 uppercase tracking-widest block mb-1">Correo detectado</span>${window.escapeHTML(email)}</div>
                                <div class="bg-white/80 dark:bg-darkcard rounded-xl p-3 border border-pink/10"><span class="opacity-50 uppercase tracking-widest block mb-1">UID</span>${window.escapeHTML(uid)}</div>
                                <div class="bg-white/80 dark:bg-darkcard rounded-xl p-3 border border-pink/10"><span class="opacity-50 uppercase tracking-widest block mb-1">Código</span>${window.escapeHTML(code)}</div>
                                <div class="bg-white/80 dark:bg-darkcard rounded-xl p-3 border border-pink/10"><span class="opacity-50 uppercase tracking-widest block mb-1">Admin por código</span>${info.isAdminByCode ? 'Sí' : 'No'}</div>
                            </div>
                            <details class="mt-3 text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
                                <summary class="cursor-pointer font-black text-purple">Ver detalle técnico</summary>
                                <pre class="mt-2 whitespace-pre-wrap break-words bg-white dark:bg-[#0d0718] p-3 rounded-xl border border-purple-border/30">${window.escapeHTML(msg)}</pre>
                            </details>
                        </div>
                    </div>
                </div>`;
};

window.adminSafeGetCollection = async function (label, collectionRef, max = window.ADMIN_QUERY_LIMIT || 50) {
    try {
        const snap = await getDocs(window.secureAdminQuery(collectionRef, max));
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return { ok: true, label, items, error: null };
    } catch (error) {
        console.error(`Firestore admin error en ${label}:`, error);
        return { ok: false, label, items: [], error };
    }
};

window.loadAdminSummary = async function () {
    window.ensureAdminSummaryHelpers?.();
    const container = document.getElementById('admin-summary-container');
    if (!container) return;
    if (!window.isAdmin) { container.innerHTML = window.adminEmptyState('Acceso restringido', 'Debes iniciar sesión como administrador para ver el resumen.', 'lock'); return; }
    if (!db) { container.innerHTML = window.adminEmptyState('Firebase no disponible', 'No se pudo conectar con la base de datos.', 'wifi-off'); return; }
    container.innerHTML = window.adminLoadingState('Construyendo resumen operativo...');

    const [ordersResult, usersResult, redeemsResult] = await Promise.all([
        window.adminSafeGetCollection('pedidos', window.getOrdersCollectionRef(), 50),
        window.adminSafeGetCollection('usuarios', window.getUsersCollectionRef(), 50),
        window.adminSafeGetCollection('canjes', window.getRedeemsCollectionRef(), 30)
    ]);

    const orders = ordersResult.items;
    const users = usersResult.items;
    const redeems = redeemsResult.items;
    window.adminCache = { orders, users, redeems };

    const hardFailures = [ordersResult, usersResult].filter(r => !r.ok);
    const softFailures = [redeemsResult].filter(r => !r.ok);
    if (hardFailures.length) {
        container.innerHTML = `
                    ${hardFailures.map(r => window.renderFirestorePermissionHelp(r.error, r.label)).join('')}
                    ${softFailures.map(r => window.renderFirestorePermissionHelp(r.error, r.label)).join('')}
                `;
        window.refreshIcons?.(container);
        return;
    }

    const inProcess = orders.filter(o => ['pendiente', 'en_proceso', 'proceso', 'solicitado'].includes(String(o.status || o.estado || 'en_proceso').toLowerCase())).length;
    const confirmed = orders.filter(o => String(o.status || o.estado || '').toLowerCase() === 'confirmado').length;
    const completed = orders.filter(o => String(o.status || o.estado || '').toLowerCase() === 'completado').length;
    const pendingRedeems = redeems.filter(r => ['solicitado', 'pendiente'].includes(String(r.status || r.estado || '').toLowerCase())).length;
    const totalCompleted = orders.filter(o => String(o.status || o.estado || '').toLowerCase() === 'completado').reduce((sum, o) => sum + Number(o.totalWithDelivery || o.total || 0), 0);
    const productCount = {};
    orders.forEach(o => (Array.isArray(o.items) ? o.items : []).forEach(i => {
        const name = i.name || i.producto || 'Producto';
        productCount[name] = (productCount[name] || 0) + Number(i.qty || i.cantidad || 1);
    }));
    const topProduct = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin datos';
    const topUser = users.slice().sort((a, b) => Number(b.puntos_historicos || b.puntosHistoricos || b.pointsHistorical || b.puntos || 0) - Number(a.puntos_historicos || a.puntosHistoricos || a.pointsHistorical || a.puntos || 0))[0];
    const recentOrders = orders.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);
    const recentRedeems = redeems.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4);

    container.innerHTML = `
                ${softFailures.length ? `<div class="mb-5">${softFailures.map(r => window.renderFirestorePermissionHelp(r.error, r.label)).join('')}</div>` : ''}
                <div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
                    ${window.adminMetricCard('En proceso', inProcess, 'clock', 'pink')}
                    ${window.adminMetricCard('Confirmados', confirmed, 'check-circle', 'green')}
                    ${window.adminMetricCard('Completados', completed, 'package-check', 'purple')}
                    ${window.adminMetricCard('Clientes', users.length, 'users', 'purple')}
                    ${window.adminMetricCard('Canjes pendientes', pendingRedeems, 'gift', 'pink')}
                    ${window.adminMetricCard('Ventas completadas', '$' + totalCompleted.toFixed(2), 'trending-up', 'green')}
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                    <div class="bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-5 shadow-sm">
                        <p class="text-[10px] font-black uppercase tracking-widest text-purple/50 mb-1">Producto más pedido</p>
                        <h3 class="text-xl font-black text-purple-dark dark:text-white">${window.escapeHTML(topProduct)}</h3>
                    </div>
                    <div class="bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-5 shadow-sm">
                        <p class="text-[10px] font-black uppercase tracking-widest text-purple/50 mb-1">Cliente con más puntos</p>
                        <h3 class="text-xl font-black text-purple-dark dark:text-white">${window.escapeHTML(topUser?.nombre || topUser?.displayName || topUser?.email || 'Sin datos')}</h3>
                    </div>
                    <div class="bg-green/10 rounded-3xl border border-green/20 p-5 shadow-sm">
                        <p class="text-[10px] font-black uppercase tracking-widest text-green-dark mb-1">Acción sugerida</p>
                        <h3 class="text-base font-black text-purple-dark dark:text-white">Revisar pedidos en proceso y enviar nota de entrega.</h3>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div class="bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-5 shadow-sm">
                        <div class="flex items-center justify-between mb-4"><h3 class="text-sm font-black text-purple-dark dark:text-white uppercase tracking-widest">Pedidos recientes</h3><button onclick="window.switchAdminTab('pedidos')" class="text-[10px] font-black text-pink uppercase">Gestionar</button></div>
                        <div class="space-y-3">${recentOrders.length ? recentOrders.map(o => window.buildAdminMiniOrder(o)).join('') : window.adminEmptyState('Sin pedidos', 'Cuando entren pedidos aparecerán aquí.', 'shopping-bag')}</div>
                    </div>
                    <div class="bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-5 shadow-sm">
                        <div class="flex items-center justify-between mb-4"><h3 class="text-sm font-black text-purple-dark dark:text-white uppercase tracking-widest">Canjes recientes</h3><button onclick="window.switchAdminTab('canjes')" class="text-[10px] font-black text-pink uppercase">Gestionar</button></div>
                        <div class="space-y-3">${recentRedeems.length ? recentRedeems.map(r => window.buildAdminRedeemMini(r)).join('') : window.adminEmptyState('Sin canjes pendientes', 'Las solicitudes de puntos aparecerán aquí.', 'gift')}</div>
                    </div>
                </div>`;
    window.refreshIcons?.(container);
};

const __milkarfOriginalLoadAdminRedeems = window.loadAdminRedeems;
window.loadAdminRedeems = async function () {
    const container = document.getElementById('admin-redeems-container');
    if (!container) return;
    if (!window.isAdmin) { container.innerHTML = window.adminEmptyState('Acceso restringido', 'Debes iniciar sesión como administrador.', 'lock'); return; }
    if (!db) { container.innerHTML = window.adminEmptyState('Firebase no disponible', 'No se pudo conectar con la base de datos.', 'wifi-off'); return; }
    container.innerHTML = window.adminLoadingState('Cargando canjes...');
    const result = await window.adminSafeGetCollection('canjes', window.getRedeemsCollectionRef(), 30);
    if (!result.ok) {
        container.innerHTML = window.renderFirestorePermissionHelp(result.error, 'canjes');
        window.refreshIcons?.(container);
        return;
    }
    window.adminCache.redeems = result.items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    window.renderAdminRedeemsPanel?.();
};

window.reloadCurrentAdminTab = function () {
    if (!window.isAdmin) return;
    const tab = window.adminCurrentTab || 'resumen';
    if (tab === 'resumen') return window.loadAdminSummary?.();
    if (tab === 'pedidos') return window.loadAdminOrders?.();
    if (tab === 'usuarios') return window.loadAdminUsers?.();
    if (tab === 'canjes') return window.loadAdminRedeems?.();
    if (tab === 'cumples') return window.loadAdminBirthdays?.();
};


/* =========================================================
   ADMIN RESUMEN ANTI-BLOQUEO
   Evita que el panel se quede indefinidamente en
   "Construyendo resumen operativo" cuando Firestore tarda,
   falla una colección, falta un índice o hay permisos cerrados.
   ========================================================= */
window.withAdminTimeout = function (promise, label = 'consulta', ms = 6500) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`Tiempo de espera agotado al cargar ${label}.`);
            err.code = 'milkarf/timeout';
            reject(err);
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

window.adminSafeGetCollection = async function (label, collectionRef, max = window.ADMIN_QUERY_LIMIT || 50, timeoutMs = 6500) {
    try {
        if (!db) throw Object.assign(new Error('Firestore no está inicializado.'), { code: 'milkarf/no-db' });
        if (!collectionRef) throw Object.assign(new Error(`Referencia no disponible para ${label}.`), { code: 'milkarf/no-ref' });
        const safeLimit = Math.min(Number(max) || window.ADMIN_QUERY_LIMIT || 50, window.ADMIN_QUERY_LIMIT || 50);
        const q = window.secureAdminQuery ? window.secureAdminQuery(collectionRef, safeLimit) : query(collectionRef, limit(safeLimit));
        const snap = await window.withAdminTimeout(getDocs(q), label, timeoutMs);
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return { ok: true, label, items, error: null };
    } catch (error) {
        console.error(`Milkarf admin: error cargando ${label}:`, error);
        return { ok: false, label, items: [], error };
    }
};

window.renderAdminSummaryFallback = function (results = []) {
    const detail = results.filter(r => !r.ok).map(r => window.renderFirestorePermissionHelp?.(r.error, r.label) || '').join('');
    return `
                <div class="space-y-5">
                    <div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-7 text-center shadow-sm">
                        <div class="w-14 h-14 mx-auto rounded-2xl bg-purple-light dark:bg-purple/15 text-purple dark:text-green flex items-center justify-center mb-4"><i data-lucide="refresh-cw" class="w-7 h-7"></i></div>
                        <h3 class="text-xl font-black text-purple-dark dark:text-white">No se pudo completar el resumen</h3>
                        <p class="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-2 max-w-xl mx-auto leading-relaxed">El panel no se quedó cargando, pero Firestore no respondió correctamente en una o más colecciones. Puedes abrir las pestañas de Pedidos, Clientes o Canjes para revisar cada módulo por separado.</p>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                            <button onclick="window.switchAdminTab('pedidos')" class="bg-pink/10 text-pink border border-pink/20 font-black text-xs uppercase tracking-widest py-3 rounded-2xl">Pedidos</button>
                            <button onclick="window.switchAdminTab('usuarios')" class="bg-purple-light dark:bg-purple/20 text-purple dark:text-white font-black text-xs uppercase tracking-widest py-3 rounded-2xl">Clientes</button>
                            <button onclick="window.switchAdminTab('canjes')" class="bg-green/15 text-green-dark dark:text-green font-black text-xs uppercase tracking-widest py-3 rounded-2xl">Canjes</button>
                        </div>
                    </div>
                    ${detail}
                </div>`;
};

window.ensureAdminSummaryHelpers = function () {
    if (typeof window.adminMetricCard !== 'function') {
        window.adminMetricCard = function (label, value, icon = 'bar-chart-3', tone = 'purple', onClickStr = null) {
            const esc = window.escapeHTML || (v => String(v ?? ''));
            const colors = {
                purple: 'bg-purple-light dark:bg-purple/15 border-purple-border/40 text-purple dark:text-green',
                pink: 'bg-pink/10 border-pink/20 text-pink',
                green: 'bg-green/15 border-green/25 text-green-dark dark:text-green'
            };
            const c = colors[tone] || colors.purple;
            const clickAttr = onClickStr ? `onclick="${onClickStr}" role="button" tabindex="0"` : '';
            const clickClasses = onClickStr ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all' : '';
            return `<div ${clickAttr} class="rounded-3xl border ${c} ${clickClasses} p-4 md:p-5 shadow-sm min-h-[120px] flex flex-col justify-between">
                        <div class="flex items-center justify-between gap-3"><span class="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-purple/55 dark:text-gray-400 leading-tight">${esc(label)}</span><span class="w-9 h-9 rounded-2xl bg-white/80 dark:bg-darkcard/70 border border-white/60 dark:border-purple/20 flex items-center justify-center shrink-0"><i data-lucide="${icon}" class="w-4 h-4"></i></span></div>
                        <div class="mt-4 text-2xl md:text-3xl font-black text-purple-dark dark:text-white leading-none">${esc(value)}</div>
                    </div>`;
        };
    }
};

window.loadAdminSummary = async function () {
    window.ensureAdminSummaryHelpers?.();
    const container = document.getElementById('admin-summary-container');
    if (!container) return;
    if (!window.isAdmin) {
        container.innerHTML = window.adminEmptyState('Acceso restringido', 'Debes iniciar sesión como administrador para ver el resumen.', 'lock');
        window.refreshIcons?.(container);
        return;
    }
    if (!db) {
        container.innerHTML = window.adminEmptyState('Firebase no disponible', 'No se pudo conectar con la base de datos.', 'wifi-off');
        window.refreshIcons?.(container);
        return;
    }

    const runId = Date.now().toString(36);
    window.__adminSummaryRunId = runId;
    container.innerHTML = window.adminLoadingState('Construyendo resumen operativo...');

    // Watchdog visual: aunque Firestore tarde, el panel no queda pegado para siempre.
    const watchdog = setTimeout(() => {
        if (window.__adminSummaryRunId === runId && container.textContent.includes('Construyendo resumen operativo')) {
            container.innerHTML = `
                        <div class="bg-white dark:bg-darkcard border border-purple-border/30 dark:border-purple/20 rounded-3xl p-8 text-center shadow-sm">
                            <div class="w-14 h-14 mx-auto rounded-2xl bg-pink/10 text-pink flex items-center justify-center mb-4"><i data-lucide="wifi-off" class="w-7 h-7"></i></div>
                            <h3 class="text-xl font-black text-purple-dark dark:text-white">Firestore está tardando en responder</h3>
                            <p class="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-2 max-w-lg mx-auto leading-relaxed">El resumen no pudo completarse a tiempo. Revisa permisos, conexión o abre un módulo individual.</p>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                                <button onclick="window.switchAdminTab('pedidos')" class="bg-pink/10 text-pink border border-pink/20 font-black text-xs uppercase tracking-widest py-3 rounded-2xl">Pedidos</button>
                                <button onclick="window.switchAdminTab('usuarios')" class="bg-purple-light dark:bg-purple/20 text-purple dark:text-white font-black text-xs uppercase tracking-widest py-3 rounded-2xl">Clientes</button>
                                <button onclick="window.switchAdminTab('canjes')" class="bg-green/15 text-green-dark dark:text-green font-black text-xs uppercase tracking-widest py-3 rounded-2xl">Canjes</button>
                            </div>
                            <button onclick="window.loadAdminSummary()" class="mt-4 text-[10px] font-black uppercase tracking-widest text-purple">Reintentar resumen</button>
                        </div>`;
            window.refreshIcons?.(container);
        }
    }, 7200);

    try {
        const refs = {
            pedidos: window.getOrdersCollectionRef?.(),
            usuarios: window.getUsersCollectionRef?.(),
            canjes: window.getRedeemsCollectionRef?.()
        };

        const results = await Promise.allSettled([
            window.adminSafeGetCollection('pedidos', refs.pedidos, 50, 6000),
            window.adminSafeGetCollection('usuarios', refs.usuarios, 50, 6000),
            window.adminSafeGetCollection('canjes', refs.canjes, 30, 6000)
        ]);

        if (window.__adminSummaryRunId !== runId) return;
        clearTimeout(watchdog);

        const [ordersResult, usersResult, redeemsResult] = results.map((r, idx) => {
            const label = ['pedidos', 'usuarios', 'canjes'][idx];
            return r.status === 'fulfilled' ? r.value : { ok: false, label, items: [], error: r.reason };
        });

        const orders = ordersResult.ok ? ordersResult.items : [];
        const users = usersResult.ok ? usersResult.items : [];
        const redeems = redeemsResult.ok ? redeemsResult.items : [];
        window.adminCache = window.adminCache || {};
        Object.assign(window.adminCache, { orders, users, redeems });

        const hardFailures = [ordersResult, usersResult].filter(r => !r.ok);
        const softFailures = [redeemsResult].filter(r => !r.ok);

        if (hardFailures.length && !orders.length && !users.length) {
            container.innerHTML = window.renderAdminSummaryFallback([ordersResult, usersResult, redeemsResult]);
            window.refreshIcons?.(container);
            return;
        }

        const getStatus = o => String(o.status || o.estado || 'en_proceso').toLowerCase();
        const inProcess = orders.filter(o => ['pendiente', 'en_proceso', 'proceso', 'solicitado'].includes(getStatus(o))).length;
        const confirmed = orders.filter(o => getStatus(o) === 'confirmado').length;
        const completed = orders.filter(o => getStatus(o) === 'completado').length;
        const pendingRedeems = redeems.filter(r => ['solicitado', 'pendiente'].includes(String(r.status || r.estado || '').toLowerCase())).length;
        const totalCompleted = orders.filter(o => getStatus(o) === 'completado').reduce((sum, o) => sum + Number(o.totalWithDelivery || o.total || 0), 0);

        const productCount = {};
        orders.forEach(o => (Array.isArray(o.items) ? o.items : []).forEach(i => {
            const name = i.name || i.producto || i.title || 'Producto';
            productCount[name] = (productCount[name] || 0) + Number(i.qty || i.cantidad || 1);
        }));
        const topProduct = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sin datos';
        const topUser = users.slice().sort((a, b) => Number(b.puntos_historicos || b.puntosHistoricos || b.pointsHistorical || b.puntos || 0) - Number(a.puntos_historicos || a.puntosHistoricos || a.pointsHistorical || a.puntos || 0))[0];
        const recentOrders = orders.slice().sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)).slice(0, 5);
        const recentRedeems = redeems.slice().sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)).slice(0, 4);

        container.innerHTML = `
                    ${[...hardFailures, ...softFailures].length ? `<div class="mb-5 space-y-3">${[...hardFailures, ...softFailures].map(r => window.renderFirestorePermissionHelp?.(r.error, r.label) || '').join('')}</div>` : ''}
                    <div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
                        ${window.adminMetricCard('En proceso', inProcess, 'clock', 'pink', "window.applyAdminOrderFilter('en_proceso')")}
                        ${window.adminMetricCard('Confirmados', confirmed, 'check-circle', 'green', "window.applyAdminOrderFilter('confirmado')")}
                        ${window.adminMetricCard('Completados', completed, 'package-check', 'purple', "window.applyAdminOrderFilter('completado')")}
                        ${window.adminMetricCard('Clientes', users.length, 'users', 'purple', "window.switchAdminTab('usuarios')")}
                        ${window.adminMetricCard('Canjes pendientes', pendingRedeems, 'gift', 'pink', "window.switchAdminTab('canjes')")}
                        ${window.adminMetricCard('Ventas completadas', '$' + totalCompleted.toFixed(2), 'trending-up', 'green', "window.applyAdminOrderFilter('completado')")}
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                        <div class="bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-5 shadow-sm">
                            <p class="text-[10px] font-black uppercase tracking-widest text-purple/50 mb-1">Producto más pedido</p>
                            <h3 class="text-xl font-black text-purple-dark dark:text-white">${window.escapeHTML(topProduct)}</h3>
                        </div>
                        <div class="bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-5 shadow-sm">
                            <p class="text-[10px] font-black uppercase tracking-widest text-purple/50 mb-1">Cliente con más puntos</p>
                            <h3 class="text-xl font-black text-purple-dark dark:text-white">${window.escapeHTML(topUser?.nombre || topUser?.displayName || topUser?.email || 'Sin datos')}</h3>
                        </div>
                        <div class="bg-green/10 rounded-3xl border border-green/20 p-5 shadow-sm">
                            <p class="text-[10px] font-black uppercase tracking-widest text-green-dark mb-1">Acción sugerida</p>
                            <h3 class="text-base font-black text-purple-dark dark:text-white">Revisar pedidos en proceso y enviar nota de entrega.</h3>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div class="bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-5 shadow-sm">
                            <div class="flex items-center justify-between mb-4"><h3 class="text-sm font-black text-purple-dark dark:text-white uppercase tracking-widest">Pedidos recientes</h3><button onclick="window.switchAdminTab('pedidos')" class="text-[10px] font-black text-pink uppercase">Gestionar</button></div>
                            <div class="space-y-3">${recentOrders.length ? recentOrders.map(o => window.buildAdminMiniOrder ? window.buildAdminMiniOrder(o) : `<div>${window.escapeHTML(o.id || 'Pedido')}</div>`).join('') : window.adminEmptyState('Sin pedidos', 'Cuando entren pedidos aparecerán aquí.', 'shopping-bag')}</div>
                        </div>
                        <div class="bg-white dark:bg-darkcard rounded-3xl border border-purple-border/30 dark:border-purple/20 p-5 shadow-sm">
                            <div class="flex items-center justify-between mb-4"><h3 class="text-sm font-black text-purple-dark dark:text-white uppercase tracking-widest">Canjes recientes</h3><button onclick="window.switchAdminTab('canjes')" class="text-[10px] font-black text-pink uppercase">Gestionar</button></div>
                            <div class="space-y-3">${recentRedeems.length ? recentRedeems.map(r => window.buildAdminRedeemMini ? window.buildAdminRedeemMini(r) : `<div>${window.escapeHTML(r.id || 'Canje')}</div>`).join('') : window.adminEmptyState('Sin canjes pendientes', 'Las solicitudes de puntos aparecerán aquí.', 'gift')}</div>
                        </div>
                    </div>`;
        window.refreshIcons?.(container);
    } catch (error) {
        clearTimeout(watchdog);
        console.error('Milkarf admin: resumen falló fuera de consultas:', error);
        container.innerHTML = window.renderAdminSummaryFallback([{ ok: false, label: 'resumen', items: [], error }]);
        window.refreshIcons?.(container);
    }
};


/* PATCH UX/WHATSAPP CROSS-BROWSER 2026-07: apertura confiable en iPhone Safari/Chrome/Instagram y carrito post-pedido */
window.isMobileCheckoutBrowser = function () {
    const ua = navigator.userAgent || '';
    return !!(window.isMobileDevice?.() || /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS|Instagram|FBAN|FBAV/i.test(ua));
};

window.getCheckoutWhatsAppUrl = function (message, phone = window.WA_NUMBER) {
    const links = window.buildWhatsAppLinks(message, phone);
    const isMobile = window.isMobileCheckoutBrowser?.() || false;

    // En celulares, wa.me es el flujo más estable para Safari, Chrome iOS,
    // Android Chrome y navegadores internos de Instagram/Facebook.
    if (isMobile) return links.wa || links.api || links.app;

    // En escritorio priorizamos WhatsApp Web.
    return links.web || links.api || links.wa;
};

window.navigateToExternalWhatsApp = function (url, options = {}) {
    if (!url) return false;
    const isMobile = window.isMobileCheckoutBrowser?.() || false;
    const target = options.target || (isMobile ? '_self' : '_blank');

    try {
        if (isMobile || target === '_self') {
            // Solo para acciones generales fuera del botón nativo del carrito.
            // El checkout móvil no usa esta función: deja que el <a> siga su href.
            window.location.href = url;
            return true;
        }

        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        return !!opened;
    } catch (error) {
        try {
            window.location.href = url;
            return true;
        } catch (e) {
            return false;
        }
    }
};

window.openWhatsAppMessage = function (message, phone = window.WA_NUMBER, options = {}) {
    const url = window.getCheckoutWhatsAppUrl(message, phone);
    const opened = window.navigateToExternalWhatsApp(url, options);

    if (options.showFallback !== false) {
        setTimeout(() => {
            if (!opened || document.visibilityState === 'visible') {
                window.showWhatsAppManualFallback?.(url);
            }
        }, options.fallbackDelay || 1400);
    }

    return url;
};

window.prepareOrderForCheckout = function () {
    if (!window.cart || !window.cart.length) return null;

    // Calcular subtotal original total
    const totalOriginalSubtotal = window.cart.reduce((s, i) => {
        if (i.type === 'feeding_plan') {
            return s + (Number(i.originalSubtotal) || (Number(i.price || 0) * Number(i.qty || 1)));
        }
        return s + (Number(i.price || 0) * Number(i.qty || 1));
    }, 0);

    // Calcular descuento acumulado de planes
    const totalPlanDiscount = window.cart.reduce((s, i) => {
        if (i.type === 'feeding_plan') {
            return s + (Number(i.discountAmount) || 0);
        }
        return s;
    }, 0);

    // Validar si el cupón de bienvenida es aplicable
    if (window.descuentoAplicado) {
        const isLoggedUser = window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email);
        const alreadyUsed = window.currentUser?.data?.descuento_usado === true;
        if (!isLoggedUser || alreadyUsed) {
            window.descuentoAplicado = false;
        }
    }

    const welcomeSavings = window.descuentoAplicado ? (totalOriginalSubtotal * 0.20) : 0;
    let discountType = 'none';
    let discountAmount = 0;
    let discountLabel = '';

    if (window.descuentoAplicado) {
        if (welcomeSavings > totalPlanDiscount) {
            discountType = 'welcome';
            discountAmount = welcomeSavings;
            discountLabel = 'Descuento de bienvenida (-20%)';
        } else {
            discountType = totalPlanDiscount > 0 ? 'plan' : 'welcome';
            discountAmount = Math.max(totalPlanDiscount, welcomeSavings);
            discountLabel = totalPlanDiscount > 0 ? 'Descuento por plan' : 'Descuento de bienvenida (-20%)';
        }
    } else if (totalPlanDiscount > 0) {
        discountType = 'plan';
        discountAmount = totalPlanDiscount;
        discountLabel = 'Descuento por plan';
    }

    const discountApplied = discountAmount > 0;
    const finalTotal = Math.max(0, totalOriginalSubtotal - discountAmount);

    const clientToken = window.getClientToken?.() || '';
    const isLogged = !!(window.currentUser && (!window.currentUser.isAnonymous || window.currentUser.email));
    const contactPhone = window.normalizePhone?.(window.currentUser?.data?.telefono || window.currentUser?.data?.phone || window.currentUser?.data?.whatsapp || (() => { try { return localStorage.getItem('milkarf_contact_phone') || ''; } catch (e) { return ''; } })()) || '';
    const clientNameForOrder = (window.currentUser?.data?.nombre || window.currentUser?.data?.nombre_persona || window.currentUser?.data?.userName || window.currentUser?.displayName || window.currentUser?.email || '').trim();
    const sessionUid = auth?.currentUser?.uid || window.currentUser?.uid || 'anonimo';

    const hasFeedingPlans = window.cart.some(i => i.type === 'feeding_plan');
    const orderType = hasFeedingPlans ? 'feeding_plan_order' : 'legacy_product_order';

    const items = window.cart.map(i => {
        if (i.type === 'feeding_plan') {
            return {
                type: 'feeding_plan',
                name: `Plan ${i.durationDays}d - ${i.formulaName || 'Fórmula'}`,
                weight: `${(Number(i.totalGramsProvided || 0)/1000).toFixed(2)} kg`,
                qty: 1,
                price: Number(i.finalPrice || i.price || 0),
                originalSubtotal: Number(i.originalSubtotal || 0),
                discountPercent: Number(i.discountPercent || 0),
                discountAmount: Number(i.discountAmount || 0),
                finalPrice: Number(i.finalPrice || 0),
                forPet: i.petName || i.forPet || '',
                petName: i.petName || '',
                dailyGrams: Number(i.dailyGrams || 0),
                durationDays: Number(i.durationDays || 7),
                formula: i.formula || 'pollo',
                formulaName: i.formulaName || '',
                totalGramsRequired: Number(i.totalGramsRequired || 0),
                totalGramsProvided: Number(i.totalGramsProvided || 0),
                surplusGrams: Number(i.surplusGrams || 0),
                bags: i.bags || [],
                presentation: i.presentation || (Array.isArray(i.bags) && i.bags[0] ? i.bags[0].weight : '500gr'),
                presentationGrams: Number(i.presentationGrams || 0),
                presentationPrice: Number(i.presentationPrice || 0),
                bagsCount: Number(i.bagsCount) || (Array.isArray(i.bags) ? i.bags.reduce((s, b) => s + (Number(b.qty) || 0), 0) : 0),
                petWeight: Number(i.petWeight) || null,
                presentationBreakdown: i.presentationBreakdown || {
                    bagSize: i.presentation || (Array.isArray(i.bags) && i.bags[0] ? i.bags[0].weight : '500gr'),
                    bagGrams: Number(i.presentationGrams || 0),
                    bagPrice: Number(i.presentationPrice || 0),
                    bagsCount: Number(i.bagsCount) || 0,
                    requiredGrams: Number(i.totalGramsRequired || 0),
                    providedGrams: Number(i.totalGramsProvided || 0),
                    surplusGrams: Number(i.surplusGrams || 0)
                }
            };
        }
        return {
            name: i.name,
            weight: i.weight,
            qty: Math.max(1, Number(i.qty || 1)),
            price: Number(i.price || 0),
            forPet: i.forPet || ''
        };
    });

    const createdAt = new Date().toISOString();
    const localOrderId = 'local_' + Date.now();
    const msg = window.getWhatsAppTemplate('newOrder', {
        items,
        subtotal: totalOriginalSubtotal,
        discountApplied,
        discountType,
        discountAmount,
        discountLabel,
        finalTotal,
        contactPhone,
        userName: clientNameForOrder,
        orderId: localOrderId,
        location: window.userLocation || ''
    });
    const url = window.getCheckoutWhatsAppUrl(msg, window.WA_NUMBER);

    const primaryPet = items.find(i => i.petName)?.petName || window.state?.nombreMascota || '';

    const pendingOrder = {
        id: localOrderId,
        orderType,
        uid: isLogged ? window.currentUser.uid : sessionUid,
        clientToken,
        registeredUser: !!isLogged,
        userName: isLogged ? (clientNameForOrder || window.currentUser.email) : 'Usuario Invitado',
        nombre: isLogged ? clientNameForOrder : '',
        nombre_persona: isLogged ? clientNameForOrder : '',
        email: isLogged ? (window.currentUser.email || '') : '',
        phone: contactPhone,
        telefono: contactPhone,
        whatsapp: contactPhone,
        items,
        subtotal: totalOriginalSubtotal,
        total: finalTotal,
        descuentoAplicado: discountApplied,
        discountType,
        discountAmount,
        status: 'en_proceso',
        estado: 'en_proceso',
        pointsBase: Math.floor(finalTotal),
        selectedPet: primaryPet,
        createdAt,
        localOnly: true
    };

    return { subtotal: totalOriginalSubtotal, finalTotal, discountApplied, discountType, discountAmount, orderType, clientToken, isLogged, contactPhone, clientNameForOrder, sessionUid, items, createdAt, localOrderId, msg, url, pendingOrder };
};

window.savePreparedOrderNonBlocking = function (prepared) {
    if (!prepared) return;
    void (async () => {
        try {
            const { pendingOrder, isLogged, clientNameForOrder, contactPhone, clientToken, items, finalTotal, discountApplied, discountType, discountAmount, orderType, localOrderId, createdAt } = prepared;
            if (discountApplied && discountType === 'welcome' && isLogged) {
                try {
                    let reclamados = [];
                    try { reclamados = JSON.parse(localStorage.getItem('milkarf_descuentos_uids') || '[]'); } catch (e) { }
                    if (!reclamados.includes(window.currentUser.uid)) {
                        reclamados.push(window.currentUser.uid);
                        try { localStorage.setItem('milkarf_descuentos_uids', JSON.stringify(reclamados)); } catch (e) { }
                    }
                    if (window.currentUser.data) window.currentUser.data.descuento_usado = true;
                    if (db && window.currentUser?.uid) {
                        try {
                            await setDoc(window.getUserPath(window.currentUser.uid), {
                                uid: window.currentUser.uid,
                                descuento_usado: true,
                                updatedAt: serverTimestamp()
                            }, { merge: true });
                        } catch (errDoc) { console.warn('Error al marcar descuento_usado en Firestore:', errDoc); }
                    }
                } catch (e) { }
            }

            if (!db) return;

            let writeUid = auth?.currentUser?.uid || window.currentUser?.uid || null;
            if (!writeUid && auth) {
                try {
                    const anonCred = await signInAnonymously(auth);
                    writeUid = anonCred?.user?.uid || null;
                    window.currentUser = anonCred?.user || window.currentUser;
                } catch (authError) {
                    console.warn('No se pudo crear sesión anónima para registrar el pedido:', authError);
                }
            }
            if (!writeUid) throw new Error('No hay sesión autenticada para registrar el pedido.');

            const primaryPet = items.find(i => i.petName)?.petName || window.state?.nombreMascota || '';

            const orderData = {
                uid: isLogged ? window.currentUser.uid : writeUid,
                orderType: orderType || 'feeding_plan_order',
                registeredUser: !!isLogged,
                clientToken,
                userName: isLogged ? (clientNameForOrder || window.currentUser.email) : 'Usuario Invitado',
                nombre: isLogged ? clientNameForOrder : '',
                nombre_persona: isLogged ? clientNameForOrder : '',
                email: isLogged ? (window.currentUser.email || '') : '',
                phone: contactPhone,
                telefono: contactPhone,
                whatsapp: contactPhone,
                items,
                total: finalTotal,
                descuentoAplicado: discountApplied,
                discountType: discountType || 'none',
                discountAmount: discountAmount || 0,
                status: 'en_proceso',
                estado: 'en_proceso',
                pointsBase: Math.floor(finalTotal),
                selectedPet: primaryPet,
                createdAt
            };

            await setDoc(window.getOrderDocRef(localOrderId), window.sanitizeClientOrderForWrite({ ...orderData, localId: localOrderId }), { merge: true });
            pendingOrder.localOnly = false;
            window.lastOrderId = localOrderId;
            try { localStorage.setItem('milkarf_last_order_id', localOrderId); } catch (e) { }
            window.cacheUserOrderLocal?.(pendingOrder);
            window.persistCartPostOrderState?.(localOrderId);
            window.startUserOrdersListener?.();
        } catch (error) {
            console.warn('Pedido preparado en WhatsApp/local, pero Firestore no confirmó de inmediato:', error);
        }
    })();
};

window.finalizarPedido = function (event) {
    const btn = event?.currentTarget || document.getElementById('btn-finalizar-pedido');
    const isMobileCheckout = window.isMobileCheckoutBrowser?.() || false;

    if (!window.cart || !window.cart.length) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        window.showToast?.('Agrega productos antes de pedir por WhatsApp.');
        return false;
    }

    const prepared = window.prepareOrderForCheckout?.();
    if (!prepared || !prepared.url) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        window.showToast?.('No se pudo preparar el pedido. Intenta nuevamente.');
        return false;
    }

    if (btn) {
        btn.setAttribute('href', prepared.url);
        btn.setAttribute('target', isMobileCheckout ? '_self' : '_blank');
        btn.setAttribute('rel', 'noopener noreferrer');
    }

    // Estado local primero: si el usuario vuelve desde WhatsApp, ya verá el pedido en proceso.
    window.cacheUserOrderLocal?.(prepared.pendingOrder);
    window.queuePendingOrderForSync?.(prepared.pendingOrder);
    try { localStorage.setItem('milkarf_last_order_id', prepared.localOrderId); } catch (e) { }
    window.renderUserOrders?.(window.getLocalUserOrders?.() || [prepared.pendingOrder]);
    window.actualizarUIAuth?.();
    window.showCartPostOrderState?.(prepared.localOrderId);
    window.showToast?.('Tu pedido quedó en proceso. Continúa por WhatsApp para confirmar disponibilidad y entrega.', 'success');

    // showCartPostOrderState/updateCartUI pueden cambiar el href a # porque el carrito se vacía.
    // Por eso se vuelve a fijar justo antes de entregar el control al navegador.
    if (btn) {
        btn.setAttribute('href', prepared.url);
        btn.setAttribute('target', isMobileCheckout ? '_self' : '_blank');
        btn.setAttribute('rel', 'noopener noreferrer');
    }

    // Firestore corre en paralelo y nunca bloquea la salida hacia WhatsApp.
    window.savePreparedOrderNonBlocking?.(prepared);

    if (isMobileCheckout) {
        // Clave del bug: no usar preventDefault, window.open ni a.click().
        // El navegador móvil debe seguir el href real del <a> como navegación nativa.
        setTimeout(() => {
            if (document.visibilityState === 'visible') {
                window.showWhatsAppManualFallback?.(prepared.url);
            }
        }, 1800);
        return true;
    }

    // Escritorio: sí evitamos la navegación nativa para abrir WhatsApp Web en una pestaña nueva.
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const opened = window.open(prepared.url, '_blank', 'noopener,noreferrer');
    if (!opened) window.showWhatsAppManualFallback?.(prepared.url);
    return false;
};

window.refreshCheckoutWhatsAppLink = function () {
    const btn = document.getElementById('btn-finalizar-pedido');
    if (!btn) return;

    if (!window.cart || !window.cart.length) {
        btn.setAttribute('href', '#');
        btn.setAttribute('target', '_self');
        btn.setAttribute('rel', 'noopener noreferrer');
        return;
    }

    try {
        const prepared = window.prepareOrderForCheckout?.();
        const isMobile = window.isMobileCheckoutBrowser?.() || false;
        btn.setAttribute('href', prepared?.url || '#');
        btn.setAttribute('target', isMobile ? '_self' : '_blank');
        btn.setAttribute('rel', 'noopener noreferrer');
    } catch (error) {
        btn.setAttribute('href', '#');
        btn.setAttribute('target', '_self');
        btn.setAttribute('rel', 'noopener noreferrer');
    }
};

window.initMobileBottomNavAutoHide = function () {
    const nav = document.getElementById('mobile-bottom-nav');
    if (!nav || nav.dataset.autohideReady === '1') return;
    nav.dataset.autohideReady = '1';
    let lastY = 0;
    let ticking = false;
    const show = () => nav.classList.remove('mobile-nav-hidden');
    const hide = () => nav.classList.add('mobile-nav-hidden');
    const onScroll = (source) => {
        if (!source) return;
        const y = source.scrollTop || 0;
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const delta = y - lastY;
            const active = window.getActiveViewId?.() || '';
            if (active === 'view-cart' || active === 'view-dashboard' || y < 40 || delta < -8) show();
            else if (delta > 10 && y > 80) hide();
            lastY = y;
            ticking = false;
        });
    };
    document.querySelectorAll('.view').forEach(view => {
        view.addEventListener('scroll', () => onScroll(view), { passive: true });
    });
    ['touchstart', 'pointerdown', 'mousemove', 'keydown'].forEach(evt => {
        document.addEventListener(evt, () => show(), { passive: true });
    });
};



/* PATCH AUTH/REGISTRO/CARRITO 2026-07: Google móvil, creación de cuenta robusta y estado post-pedido */
window.isInAppBrowser = function () {
    const ua = navigator.userAgent || '';
    return /Instagram|FBAN|FBAV|Line|TikTok/i.test(ua);
};

window.isMobileAuthBrowser = function () {
    return window.isInAppBrowser();
};

window.setAuthError = function (message, tone = 'error') {
    const err = document.getElementById('auth-error');
    if (!err) {
        if (message) window.showToast?.(String(message));
        return;
    }
    err.textContent = String(message || 'Ocurrió un error. Intenta nuevamente.');
    if (tone === 'success') {
        err.className = 'mt-3 text-xs font-bold text-green-dark bg-green/20 border border-green/30 p-2.5 rounded-lg text-center leading-tight';
    } else if (tone === 'info') {
        err.className = 'mt-3 text-xs font-bold text-purple-dark bg-purple/10 border border-purple/20 p-2.5 rounded-lg text-center leading-tight';
    } else {
        err.className = 'mt-3 text-xs font-bold text-pink bg-pink/10 border border-pink/20 p-2.5 rounded-lg text-center leading-tight';
    }
    err.classList.remove('hidden');
};

window.clearAuthError = function () {
    const err = document.getElementById('auth-error');
    if (err) err.classList.add('hidden');
};

window.traductorErrores = function (code) {
    switch (String(code || '')) {
        case 'auth/email-already-in-use':
        case 'auth/credential-already-in-use':
            return 'Este correo ya se encuentra registrado. Inicia sesión o utiliza otro correo electrónico.';
        case 'auth/invalid-email': return 'Ingresa un correo electrónico válido.';
        case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
        case 'auth/missing-password': return 'Ingresa una contraseña para continuar.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'El correo electrónico o la contraseña son incorrectos.';
        case 'auth/popup-blocked': return 'El navegador bloqueó la ventana de Google. Se intentará abrir con redirección.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request': return 'El inicio con Google fue cancelado antes de completarse.';
        case 'auth/unauthorized-domain': return 'Este dominio no está autorizado en Firebase Authentication. Agrégalo en Firebase Console > Authentication > Settings > Authorized domains.';
        case 'auth/operation-not-allowed': return 'Este método de acceso no está habilitado en Firebase. Activa Email/Password y Google en Authentication > Sign-in method.';
        case 'auth/network-request-failed': return 'Hay un problema de conexión. Revisa internet e intenta de nuevo.';
        case 'auth/account-exists-with-different-credential': return 'Este correo ya existe con otro método de inicio de sesión.';
        case 'permission-denied': return 'La cuenta se creó, pero Firestore no permitió guardar el perfil. Revisa las reglas de la base de datos.';
        default: return 'No se pudo completar la acción. Intenta nuevamente.';
    }
};

window.getRegisterFormPayload = function () {
    const emailEl = document.getElementById('auth-email-reg');
    const nameEl = document.getElementById('auth-name-reg');
    const phoneEl = document.getElementById('auth-phone-reg');
    const passEl = document.getElementById('auth-pass-reg');
    const tipoEl = document.getElementById('reg-pet-tipo');
    const nombreEl = document.getElementById('reg-pet-nombre');
    const edadEl = document.getElementById('reg-pet-edad');
    const pesoEl = document.getElementById('reg-pet-peso');
    const razaEl = document.getElementById('reg-pet-raza');
    const cumpleEl = document.getElementById('reg-pet-cumple');

    const payload = {
        els: { emailEl, nameEl, phoneEl, passEl, tipoEl, nombreEl, edadEl, pesoEl, razaEl, cumpleEl },
        email: emailEl ? emailEl.value.trim().toLowerCase() : '',
        clientName: nameEl ? nameEl.value.trim() : '',
        rawPhone: phoneEl ? phoneEl.value.trim() : '',
        phone: window.normalizePhone?.(phoneEl ? phoneEl.value.trim() : '') || '',
        pass: passEl ? passEl.value : '',
        tipo: tipoEl ? tipoEl.value : 'perro',
        nombre: nombreEl ? nombreEl.value.trim() : '',
        edad: edadEl ? edadEl.value.trim() : '',
        peso: pesoEl ? pesoEl.value.trim() : '',
        raza: razaEl ? razaEl.value.trim() : '',
        cumple: cumpleEl ? cumpleEl.value : ''
    };
    payload.mascota = {
        id: Date.now().toString(),
        tipo: payload.tipo,
        nombre: payload.nombre,
        edad: payload.edad,
        peso: payload.peso,
        raza: payload.raza || 'Mestizo',
        cumple: payload.cumple || ''
    };
    return payload;
};

window.savePendingUserProfileLocal = function (uid, data) {
    try {
        localStorage.setItem('milkarf_pending_user_profile_' + uid, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
    } catch (error) { }
};

window.writeUserProfileSafe = async function (uid, data) {
    if (!uid || !db) throw new Error('missing-user-or-db');
    try {
        await setDoc(window.getUserPath(uid), data, { merge: true });
        return { ok: true };
    } catch (error) {
        console.warn('No se pudo guardar perfil en Firestore. Se conservará localmente:', error);
        window.savePendingUserProfileLocal?.(uid, data);
        return { ok: false, error };
    }
};

window.registrarYGuardarMascota = async function () {
    window.vibrate?.(20);
    if (!auth || !db) { window.showToast?.('Firebase no está configurado.'); return; }

    const payload = window.getRegisterFormPayload();
    const { els, email, clientName, phone, pass, nombre, edad, peso, cumple, mascota } = payload;

    if (!clientName || !email || !phone || phone.length < 10 || !pass || pass.length < 6 || !nombre || !edad || !peso) {
        window.setAuthError?.('Completa tu nombre, correo, WhatsApp, contraseña y los datos requeridos de tu mascota.');
        return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        window.setAuthError?.('Ingresa un correo válido.');
        return;
    }
    if (cumple && window.isFutureBirthday?.(cumple)) {
        window.setAuthError?.('La fecha de nacimiento no puede ser futura.');
        return;
    }

    const btn = document.getElementById('btn-reg-email');
    try {
        window.clearAuthError?.();
        if (btn) { btn.textContent = 'Creando cuenta...'; btn.disabled = true; }

        let cred = null;
        const activeUser = auth.currentUser;

        if (activeUser && activeUser.isAnonymous) {
            const emailCredential = EmailAuthProvider.credential(email, pass);
            cred = await linkWithCredential(activeUser, emailCredential);
        } else {
            cred = await createUserWithEmailAndPassword(auth, email, pass);
        }

        const user = cred.user;
        try { await updateProfile(user, { displayName: clientName }); } catch (profileErr) { console.warn('No se pudo actualizar displayName:', profileErr); }
        try { await user.getIdToken(true); } catch (tokenErr) { console.warn('No se pudo refrescar token antes de guardar perfil:', tokenErr); }

        const userData = {
            uid: user.uid,
            mascotas: [mascota],
            puntos: 0,
            puntos_historicos: 0,
            email: user.email || email,
            nombre: clientName,
            nombre_persona: clientName,
            userName: clientName,
            displayName: clientName,
            telefono: phone,
            phone: phone,
            whatsapp: phone,
            updatedAt: serverTimestamp()
        };

        const write = await window.writeUserProfileSafe(user.uid, userData);
        window.currentUser = user;
        window.currentUser.data = { ...userData, updatedAt: new Date().toISOString() };
        window.state.nombreMascota = nombre;

        try { localStorage.setItem('milkarf_contact_phone', phone); } catch (error) { }
        Object.values(els).forEach(el => { if (el && 'value' in el) el.value = ''; });

        window.actualizarUIAuth?.();
        window.cerrarModalAuth?.();

        if (write.ok) {
            window.showToast?.('Cuenta, contacto y mascota guardados con éxito.', 'success');
        } else {
            window.showToast?.('Cuenta creada. El perfil quedó guardado localmente mientras se revisa la sincronización.', 'success');
        }
    } catch (error) {
        console.error('Error registrando usuario:', error);
        window.setAuthError?.(window.traductorErrores?.(error.code) || 'No se pudo crear la cuenta. Intenta nuevamente.');
    } finally {
        if (btn) { btn.textContent = 'Crear Cuenta y Entrar'; btn.disabled = false; }
    }
};

window.finishGoogleLogin = async function (user) {
    if (!user) return false;
    if (window._finishGoogleLoginProcessing === user.uid && (Date.now() - (window._lastGoogleLoginTimestamp || 0)) < 3000) {
        return true;
    }
    window._finishGoogleLoginProcessing = user.uid;
    window._lastGoogleLoginTimestamp = Date.now();

    let data = null;
    try {
        if (window._loadedProfileUid === user.uid && window.currentUser?.data) {
            data = window.currentUser.data;
        } else {
            const userRef = window.getUserPath(user.uid);
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                data = docSnap.data();
            } else {
                data = {
                    uid: user.uid,
                    email: user.email || '',
                    nombre: user.displayName || '',
                    nombre_persona: user.displayName || '',
                    userName: user.displayName || '',
                    displayName: user.displayName || '',
                    mascotas: [],
                    puntos: 0,
                    puntos_historicos: 0,
                    updatedAt: serverTimestamp()
                };
                await window.writeUserProfileSafe?.(user.uid, data);
            }
            window._loadedProfileUid = user.uid;
        }
    } catch (error) {
        console.warn('Google login OK, pero no se pudo leer/crear perfil:', error);
        data = { mascotas: [], puntos: 0, puntos_historicos: 0 };
    }

    window.currentUser = user;
    window.currentUser.data = data || { mascotas: [], puntos: 0, puntos_historicos: 0 };
    const isAdminPage = window.location.pathname.endsWith('admin.html');
    const emailUser = (user.email || '').toLowerCase();
    const isAdminEmail = await window.checkIsAdminDynamic(emailUser);

    if (isAdminPage) {
        if (isAdminEmail) {
            window.isAdmin = true;
            window.enterAdminMode?.({ navigate: false, load: true });
        } else {
            const err = document.getElementById('admin-error');
            if (err) {
                err.textContent = "Tu cuenta de Google (" + emailUser + ") no tiene permisos de administrador.";
                err.classList.remove('hidden');
            }
            await signOut(auth);
        }
        return true;
    }

    window.isAdmin = false;

    const hasPets = Array.isArray(window.currentUser.data?.mascotas) && window.currentUser.data.mascotas.length > 0;
    if (!hasPets) {
        window.abrirModalAuth?.();
        setTimeout(() => {
            window.mostrarFormularioMascota?.('add');
            window.setAuthError?.('Google ya inició sesión. Completa los datos de tu mascota para finalizar tu perfil.', 'info');
        }, 80);
    } else {
        window.cerrarModalAuth?.();
    }

    window.actualizarUIAuth?.();
    return true;
};

window.loginConGoogle = async function () {
    window.vibrate?.(30);
    if (!auth || !db) { window.showToast?.('Firebase no está configurado.'); return; }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const btn = document.getElementById('auth-google-btn');
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.isInAppBrowser?.();

    try {
        window.clearAuthError?.();
        if (btn) { btn.disabled = true; btn.classList.add('opacity-60', 'pointer-events-none'); }

        try {
            localStorage.setItem('milkarf_google_login_in_progress', '1');
            sessionStorage.setItem('milkarf_google_redirect_pending', '1');
        } catch (error) { }

        const forceRedirectOnly = window.isInAppBrowser?.() || false;
        if (forceRedirectOnly) {
            await signInWithRedirect(auth, provider);
            return;
        }

        try {
            const cred = await signInWithPopup(auth, provider);
            try { localStorage.removeItem('milkarf_google_login_in_progress'); } catch (e) { }
            try { sessionStorage.removeItem('milkarf_google_redirect_pending'); } catch (e) { }
            await window.finishGoogleLogin?.(cred.user);
            window.showToast?.('Sesión iniciada con Google.', 'success');
        } catch (popupError) {
            await signInWithRedirect(auth, provider);
        }
    } catch (error) {
        console.error('Error Google Auth:', error);
        try { localStorage.removeItem('milkarf_google_login_in_progress'); } catch (e) { }
        try { sessionStorage.removeItem('milkarf_google_redirect_pending'); } catch (e) { }
        window.setAuthError?.(window.traductorErrores?.(error.code) || 'Hubo un problema con Google. Intenta nuevamente.');
    } finally {
        if (btn && !isMobile) { btn.disabled = false; btn.classList.remove('opacity-60', 'pointer-events-none'); }
    }
};

window.handleGoogleRedirectResult = async function () {
    if (!auth) return;
    let wasPending = false;
    try {
        wasPending = sessionStorage.getItem('milkarf_google_redirect_pending') === '1' ||
            localStorage.getItem('milkarf_google_login_in_progress') === '1';
    } catch (error) { }

    try {
        const result = await getRedirectResult(auth);
        const resolvedUser = result?.user || (auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser : null);
        if (resolvedUser && (!resolvedUser.isAnonymous || resolvedUser.email)) {
            try { localStorage.removeItem('milkarf_google_login_in_progress'); } catch (error) { }
            try { sessionStorage.removeItem('milkarf_google_redirect_pending'); } catch (error) { }
            await window.finishGoogleLogin?.(resolvedUser);
            window.showToast?.('Sesión iniciada con Google.', 'success');
        } else if (wasPending) {
            // En Android Chrome, el almacenamiento IndexedDB puede tardar en inicializar
            let attempts = 0;
            const checkInterval = setInterval(async () => {
                attempts++;
                const u = auth.currentUser;
                if (u && (!u.isAnonymous || u.email)) {
                    clearInterval(checkInterval);
                    try { localStorage.removeItem('milkarf_google_login_in_progress'); } catch (error) { }
                    try { sessionStorage.removeItem('milkarf_google_redirect_pending'); } catch (error) { }
                    await window.finishGoogleLogin?.(u);
                    window.showToast?.('Sesión iniciada con Google.', 'success');
                } else if (attempts >= 25) {
                    clearInterval(checkInterval);
                    try { localStorage.removeItem('milkarf_google_login_in_progress'); } catch (error) { }
                    try { sessionStorage.removeItem('milkarf_google_redirect_pending'); } catch (error) { }
                }
            }, 200);
        }
    } catch (error) {
        console.error('Error procesando redirect Google:', error);
        try { localStorage.removeItem('milkarf_google_login_in_progress'); } catch (e) { }
        try { sessionStorage.removeItem('milkarf_google_redirect_pending'); } catch (e) { }
        window.abrirModalAuth?.();
        window.setAuthError?.(window.traductorErrores?.(error.code) || 'No se pudo completar el inicio con Google.');
    }
};

// PATCH FINAL: limpieza robusta del carrito después de enviar a WhatsApp.
// Motivo: en móviles, al abrir WhatsApp/wa.me, Safari, Chrome iOS e Instagram Browser pueden
// restaurar la página desde BFCache y mostrar el carrito anterior si el estado no se fuerza al volver.
window.forceClearCartAfterWhatsAppOrder = function (prepared = null, options = {}) {
    const opts = { persist: true, toast: true, ...options };
    const orderId = prepared?.localOrderId || window.lastOrderId || null;

    window.cartPostOrderActive = true;
    if (orderId) window.lastOrderId = orderId;

    // Vaciar memoria de carrito y cantidades de forma explícita.
    window.cart = [];
    try { localStorage.removeItem('milkarf_cart'); } catch (e) { }
    try { window.saveCartToStorage?.(); } catch (e) { }
    window.qtys = { pollo: 0, res: 0 };
    window.descuentoAplicado = false;
    window.userLocation = null;

    // Limpiar controles visibles del menú/carrito.
    try { window.resetMenuQuantities?.(); } catch (error) { }
    try { window.resetCartDeliveryUI?.(); } catch (error) { }

    // Persistir estado post-pedido para cuando el usuario vuelva desde WhatsApp.
    if (opts.persist) {
        try { window.persistCartPostOrderState?.(orderId); } catch (error) { }
    }

    const empty = document.getElementById('cart-empty');
    const cont = document.getElementById('cart-items-container');
    const sum = document.getElementById('cart-summary');
    const post = document.getElementById('cart-post-order');
    const fab = document.getElementById('cart-fab');
    const badge = document.getElementById('cart-badge');
    const title = document.getElementById('cart-title');
    const backBtn = document.getElementById('cart-back-shop-btn');
    const summaryLines = document.getElementById('cart-summary-lines');
    const cartTotal = document.getElementById('cart-total');
    const cartTotalOriginal = document.getElementById('cart-total-original');
    const locationStatus = document.getElementById('location-status');
    const locationText = document.getElementById('location-btn-text');

    if (empty) empty.classList.add('hidden');
    if (cont) {
        cont.classList.add('hidden');
        cont.innerHTML = '';
    }
    if (sum) sum.classList.add('hidden');
    if (post) post.classList.remove('hidden');
    if (title) title.textContent = 'Pedido preparado para enviar por WhatsApp';
    if (backBtn) backBtn.classList.add('hidden');
    if (fab) fab.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    if (badge) badge.textContent = '0';
    if (summaryLines) summaryLines.innerHTML = '';
    if (cartTotal) cartTotal.textContent = '$0.00';
    if (cartTotalOriginal) {
        cartTotalOriginal.textContent = '';
        cartTotalOriginal.classList.add('hidden');
    }
    if (locationStatus) {
        locationStatus.textContent = '';
        locationStatus.classList.add('hidden');
    }
    if (locationText) locationText.textContent = 'Compartir ubicación para coordinar entrega';

    try { window.refreshIcons?.(); } catch (error) { }

    if (prepared) {
        try { window.renderUserOrders?.(window.getLocalUserOrders?.() || [prepared.pendingOrder]); } catch (error) { }
        try { window.actualizarUIAuth?.(); } catch (error) { }
        if (opts.toast) window.showToast?.('Pedido preparado. Continuemos por WhatsApp para confirmar disponibilidad y entrega.', 'success');
    }
};

window.completeCheckoutLocalState = function (prepared) {
    if (!prepared) return;
    window.cacheUserOrderLocal?.(prepared.pendingOrder);
    window.queuePendingOrderForSync?.(prepared.pendingOrder);
    try { localStorage.setItem('milkarf_last_order_id', prepared.localOrderId); } catch (error) { }
    window.forceClearCartAfterWhatsAppOrder?.(prepared, { persist: true, toast: true });
};

window.finalizarPedido = function (event) {
    const btn = event?.currentTarget || document.getElementById('btn-finalizar-pedido');
    const isMobileCheckout = window.isMobileCheckoutBrowser?.() || false;

    if (!window.cart || !window.cart.length) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        window.showToast?.('Agrega productos antes de pedir por WhatsApp.');
        return false;
    }

    // Preparar el pedido ANTES de limpiar el carrito, porque el mensaje de WhatsApp necesita los ítems.
    const prepared = window.prepareOrderForCheckout?.();
    if (!prepared || !prepared.url) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        window.showToast?.('No se pudo preparar el pedido. Intenta nuevamente.');
        return false;
    }

    if (btn) {
        btn.setAttribute('href', prepared.url);
        btn.setAttribute('target', isMobileCheckout ? '_self' : '_blank');
        btn.setAttribute('rel', 'noopener noreferrer');
    }

    // Limpieza inmediata y persistente: se ejecuta antes de salir a WhatsApp.
    window.completeCheckoutLocalState?.(prepared);

    // Firestore no debe bloquear la salida a WhatsApp.
    window.savePreparedOrderNonBlocking?.(prepared);

    // Algunas funciones de UI pueden cambiar el href al dejar el carrito vacío. Lo restauramos justo antes de navegar.
    if (btn) {
        btn.setAttribute('href', prepared.url);
        btn.setAttribute('target', isMobileCheckout ? '_self' : '_blank');
        btn.setAttribute('rel', 'noopener noreferrer');
    }

    if (isMobileCheckout) {
        setTimeout(() => {
            if (document.visibilityState === 'visible') {
                window.showWhatsAppManualFallback?.(prepared.url);
            }
        }, 1800);
        // Importante en móvil: dejar que el <a> navegue de forma nativa.
        return true;
    }

    if (event) { event.preventDefault(); event.stopPropagation(); }
    const opened = window.open(prepared.url, '_blank', 'noopener,noreferrer');
    if (!opened) window.showWhatsAppManualFallback?.(prepared.url);
    return false;
};

window.restorePostCheckoutStateOnReturn = function () {
    try {
        const raw = sessionStorage.getItem(window.POST_ORDER_STATE_KEY);
        if (!raw) return false;
        const state = JSON.parse(raw);
        const recent = state?.savedAt && (Date.now() - Number(state.savedAt) < 1000 * 60 * 30);
        if (!state?.active || !recent) {
            window.clearCartPostOrderPersistedState?.();
            return false;
        }
        window.lastOrderId = state.orderId || window.lastOrderId || null;
        window.forceClearCartAfterWhatsAppOrder?.(null, { persist: false, toast: false });
        return true;
    } catch (error) {
        window.clearCartPostOrderPersistedState?.();
        return false;
    }
};

// Al volver desde WhatsApp, muchos móviles restauran desde BFCache y no disparan DOMContentLoaded.
window.addEventListener('pageshow', () => {
    window.restorePostCheckoutStateOnReturn?.();
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        window.restorePostCheckoutStateOnReturn?.();
    }
});

const runInitAndRedirect = () => {
    window.handleGoogleRedirectResult?.();
    window.handleResetPasswordUrl?.();
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    window.setMaxBirthdayDates();
    initApp();
    window.initMkaStepsAccordion?.();
    window.initFastMobileNav?.();
    window.initMobileBottomNavAutoHide?.();
    window.initHistoryNavigation?.();
    window.syncPendingOrders?.();
    window.refreshCheckoutWhatsAppLink?.();
    const checkoutBtn = document.getElementById('btn-finalizar-pedido');
    if (checkoutBtn && !checkoutBtn.dataset.fastWaReady) {
        checkoutBtn.dataset.fastWaReady = '1';
        checkoutBtn.addEventListener('pointerdown', () => window.refreshCheckoutWhatsAppLink?.(), { passive: true });
        checkoutBtn.addEventListener('touchstart', () => window.refreshCheckoutWhatsAppLink?.(), { passive: true });
        checkoutBtn.addEventListener('mouseenter', () => window.refreshCheckoutWhatsAppLink?.(), { passive: true });
    }
    if ((window.location.hash || '') === '#carrito') window.restoreCartPostOrderStateIfNeeded?.();
    window.loadCartFromLocalStorage?.();
    window.initPreloader();
    setTimeout(() => window.repairViewState?.(window.getActiveViewId?.() || 'view-home'), 1200);
};

if (document.readyState !== 'loading') {
    runInitAndRedirect();
} else {
    window.addEventListener('DOMContentLoaded', runInitAndRedirect);
}

// Fallback: ensure icons and basic delegated actions are available even if some init steps fail
window.initFallbackEventDelegation = function () {
    try {
        // Ensure lucide icons are rendered
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            try { window.lucide.createIcons(); } catch (e) { console.warn('lucide.createIcons failed', e); }
        }
        if (typeof window.refreshIcons === 'function') window.refreshIcons();

        // Delegate simple data-action clicks to existing handlers (safe, idempotent)
        if (!document._milkarf_delegation_ready) {
            document._milkarf_delegation_ready = true;
            document.addEventListener('click', function (ev) {
                const btn = ev.target.closest && ev.target.closest('[data-action]');
                if (!btn) return;
                const act = btn.getAttribute('data-action');
                if (!act) return;
                ev.preventDefault(); ev.stopPropagation();
                try {
                    if (act === 'open-login') return window.abrirModalAuth?.('login');
                    if (act === 'open-register') return window.abrirModalAuth?.('register');
                    if (act === 'go-dashboard') return window.navigateTo?.('view-dashboard');
                    if (act === 'logout') return window.cerrarSesion?.();
                } catch (e) { console.warn('delegated action error', act, e); }
            }, { capture: false, passive: false });
        }
    } catch (e) { console.warn('initFallbackEventDelegation failed', e); }
};

// Run the fallback shortly after init to recover icons/listeners if something blocked earlier
setTimeout(() => { try { window.initFallbackEventDelegation(); } catch (e) {} }, 600);
