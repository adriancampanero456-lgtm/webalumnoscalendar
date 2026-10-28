
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
let filtroActual = "ALL";

const $ = id => document.getElementById(id);

const fechaInicial = new Date();
let mesActual = fechaInicial.getMonth() + 1;
let añoActual = fechaInicial.getFullYear();

/* =========================================
   FECHAS
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
    // El formato de datos.txt no incluye año.
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
   CARGAR DATOS.TXT

   Eventos normales:
   dia,mes,categoria,asignatura,descripcion

   Cumpleaños:
   dia,mes,C,persona
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

            // Ignorar líneas vacías y comentarios.
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
                // Cumpleaños: cuatro campos.
                if (partes.length !== 4) {
                    throw new Error(
                        `El cumpleaños de la línea ${i + 1} debe tener 4 campos: dia,mes,C,persona.`
                    );
                }

                asignatura = partes[3];
                descripcion = "Cumpleaños";

            } else {
                // Resto de eventos: cinco campos o más.
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
        !estaDentroDelCurso(añoActual, mesActual - 1);

    $("mesSiguiente").disabled =
        !estaDentroDelCurso(añoActual, mesActual + 1);

    document.querySelectorAll("[data-filtro]").forEach(boton => {
        const activo = boton.dataset.filtro === filtroActual;

        boton.classList.toggle("activo", activo);
        boton.setAttribute("aria-pressed", String(activo));
    });

    const cantidad = eventosFiltrados().length;

    $("contadorEventos").textContent =
        `${cantidad} ${cantidad === 1 ? "evento" : "eventos"}`;

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

    // Lunes = 0, domingo = 6.
    const desplazamiento = (primerDia + 6) % 7;
    const totalDias = diasDelMes(mesActual, añoActual);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const lista = eventosFiltrados();

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

        const eventosDia = lista.filter(evento =>
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
   DETALLES DEL EVENTO
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
   FILTROS
========================================= */

document.querySelectorAll("[data-filtro]").forEach(boton => {
    boton.addEventListener("click", () => {
        filtroActual = boton.dataset.filtro;
        actualizarVista();
    });
});

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

$("hoyBtn").addEventListener("click", () => {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const año = hoy.getFullYear();

    if (estaDentroDelCurso(año, mes)) {
        mesActual = mes;
        añoActual = año;
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
