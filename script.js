
"use strict";

/* =========================================
   CONFIGURACIÓN
========================================= */

const INICIO_CURSO = { mes: 9, año: 2026 };
const FIN_CURSO = { mes: 6, año: 2027 };

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

/* =========================================
   ESTADO
========================================= */

let eventos = [];
let filtroActual = "ALL";

const ahora = new Date();

let mesActual = ahora.getMonth() + 1;
let añoActual = ahora.getFullYear();

const $ = id => document.getElementById(id);

/* =========================================
   FECHAS
========================================= */

function compararMeses(año1, mes1, año2, mes2) {
    return año1 * 12 + mes1 - (año2 * 12 + mes2);
}

function estaDentroDelCurso(año, mes) {
    return (
        compararMeses(año, mes, 2026, 9) >= 0 &&
        compararMeses(año, mes, 2027, 6) <= 0
    );
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

/* =========================================
   CARGA DE DATOS
   Formato:
   dia,mes,categoria,asignatura,descripcion
========================================= */

async function cargarDatos() {
    $("contenidoCalendario").hidden = true;
    $("errorDB").hidden = true;
    $("reintentarBtn").disabled = true;

    try {
        const respuesta = await fetch("datos.txt", {
            cache: "no-store"
        });

        if (!respuesta.ok) {
            throw new Error(
                `No se pudo leer datos.txt (HTTP ${respuesta.status}).`
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

            if (!linea) continue;

            const partes = linea.split(",");

            if (partes.length < 5) {
                throw new Error(
                    `La línea ${i + 1} no tiene todos los campos.`
                );
            }

            const diaTexto = partes[0].trim();
            const mesTexto = partes[1].trim();
            const categoria = partes[2].trim().toUpperCase();
            const asignatura = partes[3].trim();
            const descripcion = partes.slice(4).join(",").trim();

            if (!/^\d+$/.test(diaTexto) ||
                !/^\d+$/.test(mesTexto)) {
                throw new Error(
                    `Fecha incorrecta en la línea ${i + 1}.`
                );
            }

            const dia = Number(diaTexto);
            const mes = Number(mesTexto);
            const año = mes >= 9 ? 2026 : 2027;

            if (mes < 1 || mes > 12) {
                throw new Error(
                    `Mes incorrecto en la línea ${i + 1}.`
                );
            }

            if (
                !estaDentroDelCurso(año, mes) ||
                dia < 1 ||
                dia > diasDelMes(mes, año)
            ) {
                throw new Error(
                    `Fecha fuera del curso o inexistente en la línea ${i + 1}.`
                );
            }

            if (!Object.hasOwn(CATEGORIAS, categoria)) {
                throw new Error(
                    `Categoría "${categoria}" desconocida en la línea ${i + 1}.`
                );
            }

            if (!asignatura || !descripcion) {
                throw new Error(
                    `Falta asignatura o descripción en la línea ${i + 1}.`
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
            `${error.message} Comprueba el archivo y vuelve a intentarlo.`;

    } finally {
        $("reintentarBtn").disabled = false;
    }
}

/* =========================================
   ACTUALIZAR LA VISTA
========================================= */

function eventosFiltrados() {
    return eventos.filter(evento =>
        filtroActual === "ALL" ||
        evento.categoria === filtroActual
    );
}

function actualizarVista() {
    $("mesActual").textContent =
        `${MESES[mesActual - 1]} ${añoActual}`;

    $("mesAnterior").disabled =
        !estaDentroDelCurso(
            añoActual,
            mesActual - 1
        );

    $("mesSiguiente").disabled =
        !estaDentroDelCurso(
            añoActual,
            mesActual + 1
        );

    document.querySelectorAll("[data-filtro]").forEach(boton => {
        const activo = boton.dataset.filtro === filtroActual;

        boton.classList.toggle("activo", activo);
        boton.setAttribute("aria-pressed", String(activo));
    });

    $("contadorEventos").textContent =
        `${eventosFiltrados().length} ${
            eventosFiltrados().length === 1 ? "evento" : "eventos"
        }`;

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

    // Convertir domingo = 0 a lunes = 0.
    const desplazamiento = (primerDia + 6) % 7;
    const totalDias = diasDelMes(mesActual, añoActual);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const seleccionada = new Date(
        añoActual,
        mesActual - 1,
        1
    );

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

        const esHoy = fecha.getTime() === hoy.getTime();

        if (esHoy) {
            celda.classList.add("hoy");
        }

        const numero = document.createElement("div");
        numero.className = "numero-dia";
        numero.textContent = numeroDia;

        if (esHoy) {
            numero.setAttribute("aria-label", "Hoy");
            numero.title = "Hoy";
        }

        celda.appendChild(numero);

        const eventosDia = eventosFiltrados().filter(evento =>
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

            const asignatura = document.createElement("strong");
            asignatura.textContent = evento.asignatura;

            const descripcion = document.createElement("span");
            descripcion.textContent = evento.descripcion;

            boton.append(asignatura, descripcion);
            boton.addEventListener("click", () => mostrarDetalle(evento));

            celda.appendChild(boton);
        });

        fragmento.appendChild(celda);
    }

    calendario.appendChild(fragmento);
}

/* =========================================
   DETALLES DEL EVENTO
========================================= */

function mostrarDetalle(evento) {
    $("detalleCategoria").textContent =
        CATEGORIAS[evento.categoria];

    $("detalleCategoria").className =
        `etiqueta categoria-${evento.categoria}`;

    $("detalleFecha").textContent =
        formatoFecha(fechaEvento(evento));

    $("detalleAsignatura").textContent = evento.asignatura;
    $("detalleDescripcion").textContent = evento.descripcion;

    $("detalleDialog").showModal();
}

function cerrarDetalle() {
    $("detalleDialog").close();
}

/* =========================================
   PRÓXIMOS EVENTOS
========================================= */

function generarProximos() {
    const lista = $("listaProximos");
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const proximos = eventosFiltrados()
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
            "No hay próximos eventos para esta categoría.";
        lista.appendChild(mensaje);
        return;
    }

    proximos.forEach(({ evento, fecha }) => {
        const tarjeta = document.createElement("article");
        tarjeta.className =
            `proximo-evento ${evento.categoria}`;

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
        asignatura.textContent = evento.asignatura;

        const descripcion = document.createElement("p");
        descripcion.textContent = evento.descripcion;

        const fechaTexto = document.createElement("p");
        fechaTexto.textContent = formatoFecha(fecha);

        info.append(asignatura, descripcion, fechaTexto);
        tarjeta.append(fechaCaja, info);

        tarjeta.tabIndex = 0;
        tarjeta.setAttribute(
            "aria-label",
            `${formatoFecha(fecha)}: ${evento.asignatura}`
        );

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
   FILTROS
========================================= */

document.querySelectorAll("[data-filtro]").forEach(boton => {
    boton.addEventListener("click", () => {
        filtroActual = boton.dataset.filtro;
        actualizarVista();
    });
});

/* =========================================
   NAVEGACIÓN ENTRE MESES
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

$("hoyBtn").addEventListener("click", () => {
    const hoy = new Date();

    if (estaDentroDelCurso(hoy.getFullYear(), hoy.getMonth() + 1)) {
        mesActual = hoy.getMonth() + 1;
        añoActual = hoy.getFullYear();
    } else {
        mesActual = 9;
        añoActual = 2026;
    }

    actualizarVista();
});

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
        .setAttribute("content", oscuro ? "#0b1120" : "#f1f5f9");
}

let temaGuardado = null;

try {
    temaGuardado = localStorage.getItem("tema");
} catch (error) {
    console.warn("No se pudo leer el tema guardado.");
}

aplicarTema(
    temaGuardado === "dark" ||
    (temaGuardado === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
);

$("temaBtn").addEventListener("click", () => {
    const oscuro = !document.body.classList.contains("dark");

    aplicarTema(oscuro);

    try {
        localStorage.setItem("tema", oscuro ? "dark" : "light");
    } catch (error) {
        console.warn("No se pudo guardar la preferencia de tema.");
    }
});

/* =========================================
   CONTROLES DEL DIÁLOGO
========================================= */

$("cerrarDetalle").addEventListener("click", cerrarDetalle);
$("cerrarDetalleBtn").addEventListener("click", cerrarDetalle);
$("reintentarBtn").addEventListener("click", cargarDatos);

/* =========================================
   INICIO
========================================= */

mostrarFechaHoy();

if (!estaDentroDelCurso(añoActual, mesActual)) {
    mesActual = 9;
    añoActual = 2026;
}

cargarDatos();
