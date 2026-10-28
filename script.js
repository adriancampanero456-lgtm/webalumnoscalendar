
"use strict";

/* =========================================
   CONFIGURACIÓN DEL CALENDARIO
========================================= */

const CATEGORIAS = {
    E: "Exámenes",
    T: "Trabajos",
    R: "Lecturas",
    O: "Exposiciones",
    C: "Cumpleaños"
};

const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
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
   FUNCIONES DE FECHAS
========================================= */

function estaDentroDelCurso(año, mes) {
    const fecha = año * 12 + mes;
    const inicio = INICIO_CURSO.año * 12 + INICIO_CURSO.mes;
    const fin = FIN_CURSO.año * 12 + FIN_CURSO.mes;

    return fecha >= inicio && fecha <= fin;
}

function diasDelMes(mes, año) {
    return new Date(año, mes, 0).getDate();
}

function fechaEvento(evento) {
    const año = evento.mes >= 9 ? 2026 : 2027;
    return new Date(año, evento.mes - 1, evento.dia);
}

function formatoFecha(fecha) {
    return new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(fecha);
}

function fechaCorta(fecha) {
    return new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "short"
    }).format(fecha);
}

function normalizarTexto(texto) {
    return texto.trim();
}

function mostrarFechaHoy() {
    const elemento = $("hoy");
    if (!elemento) return;

    elemento.textContent = "Hoy es " + formatoFecha(new Date());
}

/* =========================================
   CARGA DE DATOS.TXT
========================================= */

async function cargarDatos() {
    const contenido = $("contenidoCalendario");
    const errorDB = $("errorDB");
    const mensajeError = $("mensajeError");

    if (contenido) contenido.hidden = true;
    if (errorDB) errorDB.hidden = true;

    try {
        const respuesta = await fetch("datos.txt", {
            cache: "no-store"
        });

        if (!respuesta.ok) {
            throw new Error(
                "No se ha podido leer datos.txt (HTTP " +
                respuesta.status + ")."
            );
        }

        const texto = await respuesta.text();
        const lineas = texto.split(/\r?\n/);
        const nuevosEventos = [];

        for (let i = 0; i < lineas.length; i++) {
            const linea = lineas[i].trim();

            if (!linea || linea.startsWith("#")) {
                continue;
            }

            const partes = linea.split(",").map(normalizarTexto);

            if (partes.length < 4) {
                console.warn(
                    `Línea ${i + 1} ignorada: faltan campos.`,
                    linea
                );
                continue;
            }

            const dia = Number(partes[0]);
            const mes = Number(partes[1]);
            const categoria = partes[2];

            if (
                !Number.isInteger(dia) ||
                !Number.isInteger(mes) ||
                mes < 1 ||
                mes > 12 ||
                !CATEGORIAS[categoria]
            ) {
                console.warn(
                    `Línea ${i + 1} ignorada: fecha o categoría inválida.`,
                    linea
                );
                continue;
            }

            let asignatura;
            let descripcion;

            if (categoria === "C") {
                // Formato cumpleaños: día,mes,C,nombre
                if (partes.length < 4 || !partes[3]) {
                    console.warn(
                        `Línea ${i + 1} ignorada: falta el nombre.`,
                        linea
                    );
                    continue;
                }

                asignatura = partes.slice(3).join(", ");
                descripcion = "Cumpleaños";
            } else {
                // Formato normal: día,mes,categoría,asignatura,descripción
                if (
                    partes.length < 5 ||
                    !partes[3] ||
                    !partes.slice(4).join(", ").trim()
                ) {
                    console.warn(
                        `Línea ${i + 1} ignorada: faltan datos del evento.`,
                        linea
                    );
                    continue;
                }

                asignatura = partes[3];
                descripcion = partes.slice(4).join(", ");
            }

            const año = mes >= 9 ? 2026 : 2027;

            if (
                !estaDentroDelCurso(año, mes) ||
                dia < 1 ||
                dia > diasDelMes(mes, año)
            ) {
                console.warn(
                    `Línea ${i + 1} ignorada: fecha fuera del curso o inexistente.`,
                    linea
                );
                continue;
            }

            nuevosEventos.push({
                dia,
                mes,
                categoria,
                asignatura,
                descripcion,
                fecha: new Date(año, mes - 1, dia)
            });
        }

        eventos = nuevosEventos;

        if (eventos.length === 0) {
            console.warn("datos.txt se ha leído, pero no contiene eventos válidos.");
        }

        actualizarVista();

        if (contenido) contenido.hidden = false;
        if (errorDB) errorDB.hidden = true;

    } catch (error) {
        console.error("Error al cargar el calendario:", error);

        if (contenido) contenido.hidden = true;
        if (errorDB) errorDB.hidden = false;

        if (mensajeError) {
            mensajeError.textContent =
                "No se han podido cargar los eventos. " +
                "Comprueba que datos.txt esté en la misma carpeta y " +
                "que la página se esté ejecutando desde un servidor web.";
        }
    }
}

/* =========================================
   ACTUALIZACIÓN DE LA VISTA
========================================= */

function eventosDelMes(mes, año) {
    return eventos.filter(evento => {
        const fecha = fechaEvento(evento);

        return (
            fecha.getMonth() + 1 === mes &&
            fecha.getFullYear() === año &&
            (filtroActual === "ALL" ||
                evento.categoria === filtroActual)
        );
    });
}

function actualizarVista() {
    const titulo = $("mesActual");

    if (titulo) {
        titulo.textContent =
            MESES[mesActual - 1].charAt(0).toLocaleUpperCase("es-ES") +
            MESES[mesActual - 1].slice(1) +
            " " + añoActual;
    }

    const anterior = $("mesAnterior");
    const siguiente = $("mesSiguiente");

    if (anterior) {
        anterior.disabled =
            !estaDentroDelCurso(añoActual, mesActual - 1) &&
            !(mesActual === 1 &&
              estaDentroDelCurso(añoActual - 1, 12));
    }

    if (siguiente) {
        siguiente.disabled =
            !estaDentroDelCurso(añoActual, mesActual + 1) &&
            !(mesActual === 12 &&
              estaDentroDelCurso(añoActual + 1, 1));
    }

    document.querySelectorAll("[data-filtro]").forEach(boton => {
        const activo = boton.dataset.filtro === filtroActual;
        boton.classList.toggle("activo", activo);
        boton.setAttribute("aria-pressed", String(activo));
    });

    generarCalendario();
    generarProximos();

    const contador = $("contadorEventos");
    if (contador) {
        contador.textContent = eventosDelMes(mesActual, añoActual).length;
    }
}

/* =========================================
   GENERAR CALENDARIO MENSUAL
========================================= */

function generarCalendario() {
    const contenedor = $("calendario");
    if (!contenedor) return;

    contenedor.replaceChildren();

    const primerDia = new Date(añoActual, mesActual - 1, 1);
    const desplazamiento = (primerDia.getDay() + 6) % 7;
    const totalDias = diasDelMes(mesActual, añoActual);

    const hoy = new Date();
    const hoyDia = hoy.getDate();
    const hoyMes = hoy.getMonth() + 1;
    const hoyAño = hoy.getFullYear();

    for (let i = 0; i < 42; i++) {
        const numeroDia = i - desplazamiento + 1;
        const celda = document.createElement("div");

        if (numeroDia < 1 || numeroDia > totalDias) {
            celda.className = "dia vacio";
            celda.setAttribute("aria-hidden", "true");
            contenedor.appendChild(celda);
            continue;
        }

        celda.className = "dia";

        if (
            numeroDia === hoyDia &&
            mesActual === hoyMes &&
            añoActual === hoyAño
        ) {
            celda.classList.add("hoy");
        }

        const numero = document.createElement("span");
        numero.className = "numero-dia";
        numero.textContent = numeroDia;
        celda.appendChild(numero);

        const eventosDia = eventosDelMes(mesActual, añoActual)
            .filter(evento => evento.dia === numeroDia);

        eventosDia.forEach(evento => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "evento " + evento.categoria;
            boton.title = `${evento.asignatura}: ${evento.descripcion}`;

            const asignatura = document.createElement("strong");
            asignatura.textContent = evento.asignatura;

            const descripcion = document.createElement("span");
            descripcion.textContent = evento.descripcion;

            boton.append(asignatura, descripcion);
            boton.addEventListener("click", () => mostrarDetalle(evento));

            celda.appendChild(boton);
        });

        contenedor.appendChild(celda);
    }
}

/* =========================================
   DETALLES DEL EVENTO
========================================= */

function mostrarDetalle(evento) {
    const dialogo = $("detalleDialog");
    if (!dialogo) return;

    const categoria = $("detalleCategoria");
    const fecha = $("detalleFecha");
    const asignatura = $("detalleAsignatura");
    const descripcion = $("detalleDescripcion");

    if (categoria) {
        categoria.textContent = CATEGORIAS[evento.categoria];
        categoria.className = "etiqueta " + evento.categoria;
    }

    if (fecha) {
        fecha.textContent = formatoFecha(fechaEvento(evento));
    }

    if (asignatura) {
        asignatura.textContent = evento.asignatura;
    }

    if (descripcion) {
        descripcion.textContent = evento.descripcion;
    }

    if (!dialogo.open) {
        dialogo.showModal();
    }
}

function cerrarDetalle() {
    const dialogo = $("detalleDialog");
    if (dialogo && dialogo.open) {
        dialogo.close();
    }
}

/* =========================================
   PRÓXIMOS EVENTOS
========================================= */

function generarProximos() {
    const lista = $("listaProximos");
    if (!lista) return;

    lista.replaceChildren();

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const proximos = eventos
        .filter(evento => {
            return filtroActual === "ALL" ||
                evento.categoria === filtroActual;
        })
        .map(evento => ({
            ...evento,
            fecha: fechaEvento(evento)
        }))
        .filter(evento => evento.fecha >= hoy)
        .sort((a, b) => a.fecha - b.fecha)
        .slice(0, 6);

    if (proximos.length === 0) {
        const mensaje = document.createElement("p");
        mensaje.textContent = "No hay próximos eventos.";
        lista.appendChild(mensaje);
        return;
    }

    proximos.forEach(evento => {
        const elemento = document.createElement("button");
        elemento.type = "button";
        elemento.className =
            "proximo-evento " + evento.categoria;

        const fecha = document.createElement("span");
        fecha.className = "proximo-fecha";
        fecha.textContent = fechaCorta(evento.fecha);

        const info = document.createElement("span");
        info.className = "proximo-info";

        const titulo = document.createElement("strong");
        titulo.textContent = evento.asignatura;

        const detalle = document.createElement("span");
        detalle.textContent = evento.descripcion;

        info.append(titulo, detalle);
        elemento.append(fecha, info);

        elemento.addEventListener("click", () => {
            mesActual = evento.fecha.getMonth() + 1;
            añoActual = evento.fecha.getFullYear();
            actualizarVista();
            mostrarDetalle(evento);
        });

        lista.appendChild(elemento);
    });
}

/* =========================================
   NAVEGACIÓN ENTRE MESES
========================================= */

function cambiarMes(cantidad) {
    const nuevaFecha = new Date(
        añoActual,
        mesActual - 1 + cantidad,
        1
    );

    const nuevoMes = nuevaFecha.getMonth() + 1;
    const nuevoAño = nuevaFecha.getFullYear();

    if (!estaDentroDelCurso(nuevoAño, nuevoMes)) return;

    mesActual = nuevoMes;
    añoActual = nuevoAño;

    actualizarVista();
}

function irAlMesActual() {
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const año = ahora.getFullYear();

    if (estaDentroDelCurso(año, mes)) {
        mesActual = mes;
        añoActual = año;
    } else {
        mesActual = INICIO_CURSO.mes;
        añoActual = INICIO_CURSO.año;
    }

    actualizarVista();
}

/* =========================================
   FILTROS
========================================= */

function configurarFiltros() {
    document.querySelectorAll("[data-filtro]").forEach(boton => {
        boton.addEventListener("click", () => {
            filtroActual = boton.dataset.filtro;
            actualizarVista();
        });
    });
}

/* =========================================
   TEMA CLARO / OSCURO
========================================= */

function aplicarTema(tema) {
    const oscuro = tema === "dark";

    document.body.classList.toggle("dark", oscuro);

    const boton = $("temaBtn");
    if (boton) {
        boton.innerHTML = oscuro
            ? '<span aria-hidden="true">☀️</span>'
            : '<span aria-hidden="true">🌙</span>';

        boton.setAttribute(
            "aria-label",
            oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
        );
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute("content", oscuro ? "#0f172a" : "#f1f5f9");
    }
}

function configurarTema() {
    let temaGuardado = null;

    try {
        temaGuardado = localStorage.getItem("tema");
    } catch (error) {
        console.warn("No se ha podido leer el tema guardado.", error);
    }

    aplicarTema(temaGuardado === "dark" ? "dark" : "light");

    const boton = $("temaBtn");
    if (!boton) return;

    boton.addEventListener("click", () => {
        const nuevoTema =
            document.body.classList.contains("dark") ? "light" : "dark";

        aplicarTema(nuevoTema);

        try {
            localStorage.setItem("tema", nuevoTema);
        } catch (error) {
            console.warn("No se ha podido guardar el tema.", error);
        }
    });
}

/* =========================================
   RELOJ Y FECHA DE INTERNET
========================================= */

(() => {
    const fechaElemento = $("relojFecha");
    const horaElemento = $("relojHora");
    const estadoElemento = $("relojEstado");

    if (!fechaElemento || !horaElemento || !estadoElemento) return;

    const ZONA_HORARIA = "Europe/Madrid";

    let diferenciaInternet = 0;
    let sincronizando = false;
    let ultimaSincronizacion = null;

    function mostrarReloj() {
        // Si no hay sincronización, utiliza la hora del dispositivo.
        const ahora = new Date(Date.now() + diferenciaInternet);

        fechaElemento.textContent = new Intl.DateTimeFormat("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: ZONA_HORARIA
        }).format(ahora);

        horaElemento.textContent = new Intl.DateTimeFormat("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZone: ZONA_HORARIA
        }).format(ahora);
    }

    async function sincronizarReloj() {
        if (sincronizando) return;
        sincronizando = true;

        const inicio = Date.now();
        const controlador = new AbortController();
        const timeout = setTimeout(() => controlador.abort(), 8000);

        try {
            const respuesta = await fetch(
                "https://worldtimeapi.org/api/timezone/Europe/Madrid",
                {
                    cache: "no-store",
                    signal: controlador.signal
                }
            );

            if (!respuesta.ok) {
                throw new Error("El servicio horario no está disponible.");
            }

            const datos = await respuesta.json();
            const final = Date.now();
            const horaServidor = new Date(datos.datetime).getTime();

            if (!Number.isFinite(horaServidor)) {
                throw new Error("La respuesta del servicio horario no es válida.");
            }

            // Compensa aproximadamente la latencia de la petición.
            const puntoMedio = inicio + (final - inicio) / 2;
            diferenciaInternet = horaServidor - puntoMedio;
            ultimaSincronizacion = final;

            estadoElemento.textContent = "✓ Hora sincronizada con Internet";
            mostrarReloj();

        } catch (error) {
            console.warn("No se ha podido sincronizar el reloj:", error);

            estadoElemento.textContent = ultimaSincronizacion
                ? "Sin conexión: usando la última hora sincronizada"
                : "Sin conexión horaria: usando el reloj del dispositivo";

        } finally {
            clearTimeout(timeout);
            sincronizando = false;
        }
    }

    mostrarReloj();
    sincronizarReloj();

    setInterval(mostrarReloj, 1000);
    setInterval(sincronizarReloj, 5 * 60 * 1000);
})();

/* =========================================
   INICIALIZACIÓN
========================================= */

function iniciarCalendario() {
    mostrarFechaHoy();
    configurarFiltros();
    configurarTema();

    $("mesAnterior")?.addEventListener("click", () => cambiarMes(-1));
    $("mesSiguiente")?.addEventListener("click", () => cambiarMes(1));
    $("hoyBtn")?.addEventListener("click", irAlMesActual);

    $("cerrarDetalle")?.addEventListener("click", cerrarDetalle);
    $("cerrarDetalleBtn")?.addEventListener("click", cerrarDetalle);

    $("detalleDialog")?.addEventListener("click", evento => {
        if (evento.target === $("detalleDialog")) {
            cerrarDetalle();
        }
    });

    $("reintentarBtn")?.addEventListener("click", cargarDatos);

    // Si la fecha actual no pertenece al curso, empieza en septiembre de 2026.
    if (!estaDentroDelCurso(añoActual, mesActual)) {
        mesActual = INICIO_CURSO.mes;
        añoActual = INICIO_CURSO.año;
    }

    cargarDatos();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarCalendario);
} else {
    iniciarCalendario();
}
