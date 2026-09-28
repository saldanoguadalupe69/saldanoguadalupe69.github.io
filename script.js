/* Modo oscuro y caja de ritmos */

(function () {
  /* ---------- Modo claro / oscuro ---------- */
  const raiz = document.documentElement;
  try { const t = localStorage.getItem("guada-tema"); if (t) raiz.dataset.theme = t; } catch (e) {}
  document.getElementById("tema").addEventListener("click", () => {
    const oscuro = raiz.dataset.theme
      ? raiz.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    raiz.dataset.theme = oscuro ? "light" : "dark";
    try { localStorage.setItem("guada-tema", raiz.dataset.theme); } catch (e) {}
  });

  /* ---------- Nombre en letras (para que late con el bombo) ---------- */
  const nombre = document.getElementById("nombre");
  nombre.innerHTML = [...nombre.textContent].map(l => `<span aria-hidden="true">${l}</span>`).join("");
  const letras = [...nombre.children];
  const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Caja de ritmos ---------- */
  const PISTAS = [
    { id: "bombo", nombre: "Bombo",      color: "var(--bombo)", patron: [0, 7, 8, 10] },
    { id: "redo",  nombre: "Redoblante", color: "var(--redo)",  patron: [4, 12] },
    { id: "hat",   nombre: "Hi-hat",     color: "var(--hat)",   patron: [0, 2, 4, 6, 8, 10, 12, 14] }
  ];
  const estado = {};
  const botones = {};
  const cont = document.getElementById("secuenciador");

  PISTAS.forEach(p => {
    estado[p.id] = Array.from({ length: 16 }, (_, i) => p.patron.includes(i));
    const fila = document.createElement("div");
    fila.className = "pista";
    fila.dataset.sonido = p.id;
    fila.innerHTML = `<div class="pista-nombre"><i style="background:${p.color}"></i>${p.nombre}</div><div class="pasos" role="group" aria-label="${p.nombre}"></div>`;
    const pasos = fila.querySelector(".pasos");
    botones[p.id] = estado[p.id].map((on, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", on);
      b.setAttribute("aria-label", `${p.nombre}, tiempo ${i + 1}`);
      b.addEventListener("click", () => {
        estado[p.id][i] = !estado[p.id][i];
        b.setAttribute("aria-pressed", estado[p.id][i]);
        if (estado[p.id][i] && !sonando) { iniciarAudio(); sonar(p.id, ctx.currentTime); }
      });
      pasos.appendChild(b);
      return b;
    });
    cont.appendChild(fila);
  });

  let ctx, salida, ruido, sonando = false, paso = 0, proximo = 0, reloj, bpm = 100;
  const cola = [];

  function iniciarAudio() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    salida = ctx.createGain();
    salida.gain.value = 0.7;
    salida.connect(ctx.destination);
    ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function envolvente(nodo, pico, dur, t) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(pico, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    nodo.connect(g); g.connect(salida);
    return g;
  }
  function fuenteRuido(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = ruido; s.start(t); s.stop(t + dur);
    return s;
  }

  function sonar(id, t) {
    if (id === "bombo") {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      envolvente(o, 1, 0.45, t);
      o.start(t); o.stop(t + 0.5);
    } else if (id === "redo") {
      const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1500;
      fuenteRuido(t, 0.2).connect(f);
      envolvente(f, 0.55, 0.18, t);
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = 190;
      envolvente(o, 0.35, 0.1, t);
      o.start(t); o.stop(t + 0.12);
    } else {
      const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7500;
      fuenteRuido(t, 0.06).connect(f);
      envolvente(f, 0.22, 0.05, t);
    }
  }

  function programar() {
    while (proximo < ctx.currentTime + 0.1) {
      PISTAS.forEach(p => { if (estado[p.id][paso]) sonar(p.id, proximo); });
      cola.push({ paso, t: proximo });
      proximo += 60 / bpm / 4;
      paso = (paso + 1) % 16;
    }
  }

  let marcado = -1;
  function dibujar() {
    if (!sonando) return;
    while (cola.length && cola[0].t <= ctx.currentTime) {
      const { paso: p } = cola.shift();
      PISTAS.forEach(pi => {
        if (marcado >= 0) botones[pi.id][marcado].classList.remove("ahora");
        botones[pi.id][p].classList.add("ahora");
      });
      marcado = p;
      if (estado.bombo[p] && !sinMovimiento) {
        letras.forEach(l => { l.classList.remove("late"); void l.offsetWidth; l.classList.add("late"); });
      }
    }
    requestAnimationFrame(dibujar);
  }

  const btnPlay = document.getElementById("play");
  const textoPlay = document.getElementById("play-texto");
  const icono = document.getElementById("icono");

  function detener() {
    sonando = false;
    clearInterval(reloj);
    cola.length = 0;
    if (marcado >= 0) PISTAS.forEach(p => botones[p.id][marcado].classList.remove("ahora"));
    marcado = -1;
    btnPlay.setAttribute("aria-pressed", "false");
    textoPlay.textContent = "Tocar";
    icono.setAttribute("d", "M1 0 L10 5 L1 10 Z");
  }

  btnPlay.addEventListener("click", () => {
    if (sonando) { detener(); return; }
    iniciarAudio();
    sonando = true;
    paso = 0;
    proximo = ctx.currentTime + 0.05;
    reloj = setInterval(programar, 25);
    programar();
    requestAnimationFrame(dibujar);
    btnPlay.setAttribute("aria-pressed", "true");
    textoPlay.textContent = "Parar";
    icono.setAttribute("d", "M1 1 H9 V9 H1 Z");
  });

  const rango = document.getElementById("bpm");
  rango.addEventListener("input", () => {
    bpm = +rango.value;
    document.getElementById("bpm-valor").textContent = bpm + " bpm";
    document.getElementById("pie-bpm").textContent = bpm;
  });

  document.getElementById("limpiar").addEventListener("click", () => {
    PISTAS.forEach(p => {
      estado[p.id].fill(false);
      botones[p.id].forEach(b => b.setAttribute("aria-pressed", "false"));
    });
  });

  document.addEventListener("visibilitychange", () => { if (document.hidden && sonando) detener(); });
})();