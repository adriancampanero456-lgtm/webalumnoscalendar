"use strict";

/* =========================================
   CONFIGURACIÓN
========================================= */

const CATEGORIAS = {
    E: "Exámenes",
    T: "Trabajos",
    R: "Lecturas",
    O: "Exposiciones",
    C: "Cumpleaños"
};

const MESES = [
    "enero", "febrero", "marzo", "abril",
    "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"
];

const DIAS = [
    "domingo", "lunes", "martes", "miércoles",
    "jueves", "viernes", "sábado"
];

const INICIO_CURSO = { mes: 9, año: 2026 };
const FIN_CURSO = { mes: 6, año: 2027 };

let eventos = [];

const $ = id => document.getElementById(id);

const fechaInicial = new Date();
let mesActual = fechaInicial.getMonth() + 1;
let añoActual = fechaInicial.getFullYear();

/* =========================================
   FECHAS Y HORA DE INTERNET
========================================= */

function estaDentroDelCurso(año, mes) {
    const valor = año * 12 + mes;
    const inicio = INICIO_CURSO.año * 12 + INICIO_CURSO.mes;
    const fin = FIN_CURSO.año * 12 + FIN_CURSO.mes;

    return valor >= inicio && valor <= fin;
}

function diasDelMes(mes, año) {
    return new Date(año, mes, 0).getDate();
}

function fechaEvento(evento) {
    const año = evento.mes >= 9 ? 2026 : 2027;

    return new Date(año, evento.mes - 1, evento.dia);
}

function formatoFecha(fecha) {
    return `${DIAS[fecha.getDay()]}, ${fecha.getDate()} de ${
        MESES[fecha.getMonth()]
    } de ${fecha.getFullYear()}`;
}

function mostrarFechaHoy() {
    $("hoy").textContent = `Hoy es ${formatoFecha(new Date())}`;
}

// Sincronizar hora y fecha de internet mediante fetch HTTP headers o API pública gratuita
async function iniciarRelojInternet() {
    let offsetMs = 0;

    async function sincronizarConServidor() {
        try {
            const inicioPeticion = performance.now();
            // Solicitud ligera a un servidor público de hora de internet o cabecera de respuesta propia
            const respuesta = await fetch("https://worldtimeapi.org/api/ip", { cache: "no-store" });
            const finPeticion = performance.now();
            
            if (respuesta.ok) {
                const datos = await respuesta.json();
                const fechaServidor = new Date(datos.datetime);
                const tiempoRedonda = (finPeticion - inicioPeticion) / 2;
                const horaEstimadaServidor = fechaServidor.getTime() + tiempoRedonda;
                offsetMs = horaEstimadaServidor - Date.now();
            }
        } catch (e) {
            // Si falla la API externa, usa la hora local del dispositivo automáticamente
            offsetMs = 0;
        }
    }

    // Sincronizar al iniciar y cada 30 minutos
    await sincronizarConServidor();
    setInterval(sincronizarConServidor, 30 * 60 * 1000);

    // Actualizar cada segundo en pantalla con formato hh:mm:ss
    setInterval(() => {
        const ahora = new Date(Date.now() + offsetMs);
        const horas = String(ahora.getHours()).padStart(2, "0");
        const minutos = String(ahora.getMinutes()).padStart(2, "0");
        const segundos = String(ahora.getSeconds()).padStart(2, "0");
        
        const relojEl = $("relojInternet");
        if (relojEl) {
            relojEl.textContent = `${horas}:${minutos}:${segundos}`;
        }
    }, 1000);
}

/* =========================================
   COMPROBAR MANTENIMIENTO
========================================= */

async function comprobarMantenimiento() {
    try {
        const respuesta = await fetch("mantenimiento.txt", {
            cache: "no-store"
        });

        if (respuesta.ok) {
            const texto = await respuesta.text();
            if (texto.trim() === "1") {
                $("pantallaMantenimiento").hidden = false;
                return true;
            }
        }
    } catch (error) {
        // Si no existe o da error, la web funciona normalmente
    }
    return false;
}

/* =========================================
   CARGAR DATOS.TXT
========================================= */

async function cargarDatos() {
    const enMantenimiento = await comprobarMantenimiento();
    if (enMantenimiento) {
        return;
    }

    $("contenidoCalendario").hidden = true;
    $("errorDB").hidden = true;
    $("reintentarBtn").disabled = true;

    try {
        const respuesta = await fetch("datos.txt", {
            cache: "no-store"
        });

        if (!respuesta.ok) {
            throw new Error(
                `No se pudo leer base de datos.`
            );
        }

        const texto = await respuesta.text();

        if (!texto.trim()) {
            throw new Error("El archivo datos.txt está vacío.");
        }

        const lineas = texto.split(/\r?\n/);
        const datos = [];

        for (let i = 0; i < lineas.length; i++) {
            const linea = lineas[i].trim();

            if (!linea || linea.startsWith("#")) {
                continue;
            }

            const partes = linea.split(",").map(p => p.trim());

            const diaTexto = partes[0];
            const mesTexto = partes[1];
            const categoria = (partes[2] || "").toUpperCase();

            if (
                !/^\d+$/.test(diaTexto || "") ||
                !/^\d+$/.test(mesTexto || "")
            ) {
                throw new Error(
                    `Fecha incorrecta en la línea ${i + 1}: ${linea}`
                );
            }

            const dia = Number(diaTexto);
            const mes = Number(mesTexto);

            if (mes < 1 || mes > 12) {
                throw new Error(`Mes incorrecto en la línea ${i + 1}.`);
            }

            const año = mes >= 9 ? 2026 : 2027;

            if (
                !estaDentroDelCurso(año, mes) ||
                dia < 1 ||
                dia > diasDelMes(mes, año)
            ) {
                throw new Error(
                    `Fecha inexistente o fuera del curso en la línea ${i + 1}.`
                );
            }

            if (!Object.hasOwn(CATEGORIAS, categoria)) {
                throw new Error(
                    `Categoría desconocida en la línea ${i + 1}: ${categoria}`
                );
            }

            let asignatura;
            let descripcion;

            if (categoria === "C") {
                if (partes.length !== 4) {
                    throw new Error(
                        `El cumpleaños de la línea ${i + 1} debe tener 4 campos: dia,mes,C,persona.`
                    );
                }

                asignatura = partes[3];
                descripcion = "Cumpleaños";

            } else {
                if (partes.length < 5) {
                    throw new Error(
                        `El evento de la línea ${i + 1} necesita 5 campos: dia,mes,categoria,asignatura,descripcion.`
                    );
                }

                asignatura = partes[3];
                descripcion = partes.slice(4).join(",").trim();
            }

            if (!asignatura) {
                throw new Error(
                    `Falta el nombre o asignatura en la línea ${i + 1}.`
                );
            }

            if (categoria !== "C" && !descripcion) {
                throw new Error(
                    `Falta la descripción en la línea ${i + 1}.`
                );
            }

            datos.push({
                dia,
                mes,
                categoria,
                asignatura,
                descripcion
            });
        }

        if (datos.length === 0) {
            throw new Error("No hay eventos válidos en datos.txt.");
        }

        eventos = datos;

        $("errorDB").hidden = true;
        $("contenidoCalendario").hidden = false;

        actualizarVista();

    } catch (error) {
        console.error("Error al cargar el calendario:", error);

        $("contenidoCalendario").hidden = true;
        $("errorDB").hidden = false;

        $("mensajeError").textContent =
            `${error.message} Comprueba datos.txt y vuelve a intentarlo.`;

    } finally {
        $("reintentarBtn").disabled = false;
    }
}

/* =========================================
   ACTUALIZAR VISTA
========================================= */

function actualizarVista() {
    $("mesActual").textContent =
        `${MESES[mesActual - 1]} ${añoActual}`;

    $("mesAnterior").disabled =
        !estaDentroDelCurso(añoActual, mesActual - 1);

    $("mesSiguiente").disabled =
        !estaDentroDelCurso(añoActual, mesActual + 1);

    generarCalendario();
    generarProximos();
}

/* =========================================
   GENERAR CALENDARIO
========================================= */

function generarCalendario() {
    const calendario = $("calendario");
    const fragmento = document.createDocumentFragment();

    calendario.replaceChildren();

    const primerDia = new Date(
        añoActual,
        mesActual - 1,
        1
    ).getDay();

    const desplazamiento = (primerDia + 6) % 7;
    const totalDias = diasDelMes(mesActual, añoActual);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (let posicion = 0; posicion < 42; posicion++) {
        const numeroDia = posicion - desplazamiento + 1;
        const celda = document.createElement("div");

        celda.className = "dia";

        if (numeroDia < 1 || numeroDia > totalDias) {
            celda.classList.add("vacio");
            celda.setAttribute("aria-hidden", "true");
            fragmento.appendChild(celda);
            continue;
        }

        const fecha = new Date(
            añoActual,
            mesActual - 1,
            numeroDia
        );

        if (fecha.getTime() === hoy.getTime()) {
            celda.classList.add("hoy");
        }

        const numero = document.createElement("div");
        numero.className = "numero-dia";
        numero.textContent = numeroDia;

        celda.appendChild(numero);

        const eventosDia = eventos.filter(evento =>
            evento.dia === numeroDia &&
            evento.mes === mesActual
        );

        eventosDia.forEach(evento => {
            const boton = document.createElement("button");

            boton.type = "button";
            boton.className = `evento ${evento.categoria}`;

            boton.setAttribute(
                "aria-label",
                `${CATEGORIAS[evento.categoria]}: ${evento.asignatura}. ${evento.descripcion}`
            );

            const nombre = document.createElement("strong");
            nombre.textContent = evento.asignatura;

            const descripcion = document.createElement("span");
            descripcion.textContent = evento.descripcion;

            boton.append(nombre, descripcion);

            boton.addEventListener("click", () => {
                mostrarDetalle(evento);
            });

            celda.appendChild(boton);
        });

        fragmento.appendChild(celda);
    }

    calendario.appendChild(fragmento);
}

/* =========================================
   DETALLES DEL EVENTO Y HORARIO
========================================= */

function mostrarDetalle(evento) {
    $("detalleCategoria").textContent =
        CATEGORIAS[evento.categoria];

    $("detalleCategoria").className =
        `etiqueta categoria-${evento.categoria}`;

    $("detalleFecha").textContent =
        formatoFecha(fechaEvento(evento));

    $("detalleAsignatura").textContent =
        evento.categoria === "C"
            ? `🎂 ${evento.asignatura}`
            : evento.asignatura;

    $("detalleDescripcion").textContent =
        evento.descripcion;

    $("detalleDialog").showModal();
}

function cerrarDetalle() {
    $("detalleDialog").close();
}

function abrirHorario() {
    $("horarioDialog").showModal();
}

function cerrarHorario() {
    $("horarioDialog").close();
}

/* =========================================
   PRÓXIMOS EVENTOS
========================================= */

function generarProximos() {
    const lista = $("listaProximos");
    const hoy = new Date();

    hoy.setHours(0, 0, 0, 0);

    const proximos = eventos
        .map(evento => ({
            evento,
            fecha: fechaEvento(evento)
        }))
        .filter(item => item.fecha >= hoy)
        .sort((a, b) => a.fecha - b.fecha)
        .slice(0, 6);

    lista.replaceChildren();

    if (proximos.length === 0) {
        const mensaje = document.createElement("p");

        mensaje.className = "sin-eventos";
        mensaje.textContent =
            "No hay próximos eventos.";

        lista.appendChild(mensaje);
        return;
    }

    proximos.forEach(({ evento, fecha }) => {
        const tarjeta = document.createElement("article");

        tarjeta.className =
            `proximo-evento ${evento.categoria}`;

        tarjeta.tabIndex = 0;
        tarjeta.setAttribute("role", "button");

        tarjeta.setAttribute(
            "aria-label",
            `${formatoFecha(fecha)}: ${evento.asignatura}`
        );

        const fechaCaja = document.createElement("div");
        fechaCaja.className = "proximo-fecha";

        const numero = document.createElement("strong");
        numero.textContent = fecha.getDate();

        const mes = document.createElement("span");
        mes.textContent = MESES[fecha.getMonth()].slice(0, 3);

        fechaCaja.append(numero, mes);

        const info = document.createElement("div");
        info.className = "proximo-info";

        const asignatura = document.createElement("strong");
        asignatura.textContent =
            evento.categoria === "C"
                ? `🎂 ${evento.asignatura}`
                : evento.asignatura;

        const descripcion = document.createElement("p");
        descripcion.textContent = evento.descripcion;

        const fechaTexto = document.createElement("p");
        fechaTexto.textContent = formatoFecha(fecha);

        info.append(asignatura, descripcion, fechaTexto);
        tarjeta.append(fechaCaja, info);

        tarjeta.addEventListener("click", () => {
            mesActual = fecha.getMonth() + 1;
            añoActual = fecha.getFullYear();

            actualizarVista();
            mostrarDetalle(evento);

            $("mesActual").scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        });

        tarjeta.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                tarjeta.click();
            }
        });

        lista.appendChild(tarjeta);
    });
}

/* =========================================
   CAMBIAR MES
========================================= */

function cambiarMes(direccion) {
    const fecha = new Date(
        añoActual,
        mesActual - 1 + direccion,
        1
    );

    const nuevoMes = fecha.getMonth() + 1;
    const nuevoAño = fecha.getFullYear();

    if (!estaDentroDelCurso(nuevoAño, nuevoMes)) {
        return;
    }

    mesActual = nuevoMes;
    añoActual = nuevoAño;

    actualizarVista();
}

$("mesAnterior").addEventListener("click", () => cambiarMes(-1));
$("mesSiguiente").addEventListener("click", () => cambiarMes(1));

/* =========================================
   MODO OSCURO
========================================= */

function aplicarTema(oscuro) {
    document.body.classList.toggle("dark", oscuro);

    $("temaBtn").textContent = oscuro ? "☀️" : "🌙";

    $("temaBtn").setAttribute(
        "aria-label",
        oscuro ? "Activar modo claro" : "Activar modo oscuro"
    );

    document.querySelector('meta[name="theme-color"]')
        .setAttribute(
            "content",
            oscuro ? "#0b1120" : "#f1f5f9"
        );
}

let temaGuardado = null;

try {
    temaGuardado = localStorage.getItem("tema");
} catch (error) {
    console.warn("No se pudo leer el tema guardado.");
}

aplicarTema(
    temaGuardado === "dark" ||
    (
        temaGuardado === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    )
);

$("temaBtn").addEventListener("click", () => {
    const oscuro = !document.body.classList.contains("dark");

    aplicarTema(oscuro);

    try {
        localStorage.setItem("tema", oscuro ? "dark" : "light");
    } catch (error) {
        console.warn("No se pudo guardar el tema.");
    }
});

/* =========================================
   CONTROLES
========================================= */

$("cerrarDetalle").addEventListener("click", cerrarDetalle);
$("cerrarDetalleBtn").addEventListener("click", cerrarDetalle);
$("abrirHorarioBtn").addEventListener("click", abrirHorario);
$("cerrarHorario").addEventListener("click", cerrarHorario);
$("cerrarHorarioBtn").addEventListener("click", cerrarHorario);
$("reintentarBtn").addEventListener("click", cargarDatos);

/* =========================================
   INICIO
========================================= */

mostrarFechaHoy();
iniciarRelojInternet();

if (!estaDentroDelCurso(añoActual, mesActual)) {
    mesActual = 9;
    añoActual = 2026;
}

cargarDatos();
