import { useEffect, useState } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap
} from 'react-leaflet'

import { supabase } from '../supabaseClient'

import 'leaflet/dist/leaflet.css'
import './Municipality.css'

// ==========================================
// INFORMACIÓN DE CATEGORÍAS AMBIENTALES
// ==========================================

const informacion = {
  Clima: {
    icono: '☀',
    titulo: 'Condiciones climáticas',
    descripcion: 'Consulta las condiciones climáticas del municipio.',
    color: '#B9D9E8',
    columna: 'clima',
    paleta: ['#B9D9E8', '#77B8D1', '#E8C77B', '#D98564']
  },

  Suelo: {
    icono: '▤',
    titulo: 'Características del suelo',
    descripcion: 'Información sobre las propiedades y tipos de suelo.',
    color: '#C5A477',
    columna: 'suelo',
    paleta: ['#D8C09A', '#B99469', '#98734F', '#E4D6B8']
  },

  Vegetación: {
    icono: '♧',
    // VEGETACIÓN: textos adaptados a la tabla cultivos
    titulo: 'Cultivos recomendados',
    descripcion: 'Consulta los cultivos recomendados por estación para el municipio.',
    color: '#83A779',
    columna: 'vegetacion',
    paleta: ['#D5E2C0', '#A6C18A', '#6D956B', '#3F704C']
  }
}

const SIN_DATO = 'Sin dato'

// ==========================================
// CLASIFICACIONES AMBIENTALES
// ==========================================

const GRUPO_SUELO = {
  1: 'Someros o poco desarrollados',
  2: 'Forestales con acumulación de arcilla',
  3: 'Ricos en materia orgánica',
  4: 'Arcillosos, calcáreos, salinos, aluviales o arenosos'
}

// VEGETACIÓN: orden de las estaciones de la tabla cultivos
const ORDEN_ESTACIONES = ['Primavera-Verano', 'Otoño-Invierno', 'Perennes']

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

const mayus = (texto) =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto

// VEGETACIÓN: normaliza nombres (sin acentos, minúsculas)
const normalizar = (texto) =>
  (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

// VEGETACIÓN: números con separador de miles
const formatoNum = (n) => Number(n).toLocaleString('es-MX')

// VEGETACIÓN: cultivo con mayor éxito de cosecha
const mejorCultivo = (filas) =>
  filas.reduce(
    (mejor, f) =>
      !mejor || Number(f.exito_cosecha_pct) > Number(mejor.exito_cosecha_pct)
        ? f
        : mejor,
    null
  )

function extraerPrincipal(texto) {
  const m = texto?.match(/(?:^|: )([^:]+?) \(([\d.]+)% del municipio\)/)

  return m
    ? { nombre: m[1].trim(), pct: m[2] }
    : null
}

function extraerTempPrecip(texto) {
  const m = texto?.match(/Temperatura (.+?°C), precipitación (.+?mm)/)

  if (!m) return null

  const limpiar = (s) =>
    s.replace(/\b0(\d)\b/g, '$1')
      .replace('°C', ' °C')
      .replace(/(\d)mm/, '$1 mm')

  return {
    temperatura: limpiar(m[1]),
    precipitacion: limpiar(m[2])
  }
}

function humedadDe(clima = '') {
  const c = clima.toLowerCase()

  let tipo = SIN_DATO

  if (c.includes('subhúmedo')) tipo = 'Subhúmedo'
  else if (c.includes('muy seco')) tipo = 'Muy seco'
  else if (c.includes('semiseco')) tipo = 'Semiseco'
  else if (c.includes('seco')) tipo = 'Seco'
  else if (c.includes('húmedo')) tipo = 'Húmedo'

  if (c.includes('mayor humedad')) return `${tipo} (mayor humedad)`
  if (c.includes('menor humedad')) return `${tipo} (menor humedad)`
  if (c.includes('humedad media')) return `${tipo} (humedad media)`

  return tipo
}

// ==========================================
// CONSTRUIR DATOS DE SUPABASE
// ==========================================

// VEGETACIÓN: tercer parámetro opcional "cultivos" (solo lo usa Vegetación)
function construirDatos(categoria, fila, cultivos = []) {
  if (categoria === 'Clima') {
    const clima = extraerPrincipal(fila?.descripcion_clima)
    const rangos = extraerTempPrecip(fila?.descripcion_clima)

    return [
      {
        nombre: 'Temperatura',
        valor: rangos?.temperatura ?? SIN_DATO
      },
      {
        nombre: 'Humedad',
        valor: clima ? humedadDe(clima.nombre) : SIN_DATO
      },
      {
        nombre: 'Precipitación',
        valor: rangos?.precipitacion ?? SIN_DATO
      },
      {
        nombre: 'Clima predominante',
        valor: clima
          ? `${mayus(clima.nombre)} · ${clima.pct}%`
          : SIN_DATO
      }
    ]
  }

  if (categoria === 'Suelo') {
    const suelo = extraerPrincipal(fila?.descripcion_suelo)

    return [
      {
        nombre: 'Suelo dominante',
        valor: suelo ? suelo.nombre : SIN_DATO
      },
      {
        nombre: 'Superficie que ocupa',
        valor: suelo ? `${suelo.pct}% del municipio` : SIN_DATO
      },
      {
        nombre: 'Grupo de suelo',
        valor: GRUPO_SUELO[fila?.suelo] ?? SIN_DATO
      }
    ]
  }

  // VEGETACIÓN: un dato por estación + el de mayor éxito de cosecha
  const porEstacion = ORDEN_ESTACIONES.map(estacion => {
    const c = cultivos.find(
      x => normalizar(x.estacion) === normalizar(estacion)
    )

    return {
      nombre: `Cultivo recomendado · ${estacion}`,
      valor: c ? c.cultivo_recomendado : SIN_DATO,
      detalle: c
        ? `Éxito de cosecha ${c.exito_cosecha_pct}% · Rendimiento ${c.rendimiento_prom} · Volumen ${formatoNum(c.volumen_promedio_ton)} ton · Valor $${formatoNum(c.valor_promedio_mxn)} MXN · ${c.anios_evaluados} años evaluados`
        : null
    }
  })

  const mejor = cultivos.length ? mejorCultivo(cultivos) : null

  return [
    ...porEstacion,
    {
      nombre: 'Mayor éxito de cosecha',
      valor: mejor
        ? `${mejor.cultivo_recomendado} (${mejor.estacion}) · ${mejor.exito_cosecha_pct}%`
        : SIN_DATO
    }
  ]
}

// ==========================================
// AJUSTAR MAPA AL MUNICIPIO
// ==========================================

function AjustarMunicipio({ feature }) {
  const map = useMap()

  useEffect(() => {
    if (!feature) return

    const capa = L.geoJSON(feature)
    const bounds = capa.getBounds()

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [15, 15]
      })
    }
  }, [feature, map])

  return null
}

// ==========================================
// PANTALLA MUNICIPALITY
// ==========================================

function Municipality({ nombre, onBack, onRecommendations }) {

  const [categoria, setCategoria] = useState('Clima')
  const [feature, setFeature] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  // Datos ambientales de Supabase
  const [fila, setFila] = useState(null)
  const [cargandoDatos, setCargandoDatos] = useState(true)

  // VEGETACIÓN: cultivos del municipio (tabla "cultivos")
  const [cultivos, setCultivos] = useState([])
  const [cargandoCultivos, setCargandoCultivos] = useState(true)

  // ==========================================
  // VOLVER AL INICIO DE LA PANTALLA
  // ==========================================

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant'
    })
  }, [nombre])

  // ==========================================
  // CARGAR LÍMITES DEL MUNICIPIO DESDE INEGI
  // ==========================================

  useEffect(() => {
    let activo = true

    async function cargarMunicipio() {
      try {
        setCargando(true)
        setError(false)
        setFeature(null)

        const response = await fetch(
          'https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/10'
        )

        if (!response.ok) {
          throw new Error('No se pudieron consultar los municipios')
        }

        const data = await response.json()

        const encontrado = data.features.find(item =>
          item.properties?.nomgeo?.toLowerCase() === nombre?.toLowerCase()
        )

        if (!encontrado) {
          throw new Error('No se encontró el municipio')
        }

        if (activo) {
          setFeature(encontrado)
        }

      } catch (err) {
        console.error(err)

        if (activo) {
          setError(true)
        }

      } finally {
        if (activo) {
          setCargando(false)
        }
      }
    }

    if (nombre) {
      cargarMunicipio()
    }

    return () => {
      activo = false
    }
  }, [nombre])

  // ==========================================
  // CARGAR DATOS AMBIENTALES DESDE SUPABASE
  // ==========================================

  useEffect(() => {
    const clave = feature?.properties?.cvegeo

    if (!clave) return

    let activo = true

    async function cargarDatos() {
      setCargandoDatos(true)

      const { data, error: errorDb } = await supabase
        .from('municipios')
        .select('*')
        .eq('clave', clave)
        .maybeSingle()

      if (!activo) return

      if (errorDb) {
        console.error('Error leyendo Supabase:', errorDb)
      }

      setFila(data ?? null)
      setCargandoDatos(false)
    }

    cargarDatos()

    return () => {
      activo = false
    }
  }, [feature])

  // ==========================================
  // VEGETACIÓN: CARGAR CULTIVOS DESDE SUPABASE
  // ==========================================

  useEffect(() => {
    if (!nombre) return

    let activo = true

    async function cargarCultivos() {
      setCargandoCultivos(true)

      const { data, error: errorDb } = await supabase
        .from('cultivos')
        .select(
          'id, municipio, estacion, cultivo_recomendado, anios_evaluados, volumen_promedio_ton, rendimiento_prom, valor_promedio_mxn, exito_cosecha_pct'
        )

      if (!activo) return

      if (errorDb) {
        console.error('Error leyendo cultivos:', errorDb)
      }

      // Filtra por municipio ignorando acentos y mayúsculas
      setCultivos(
        (data ?? []).filter(
          c => normalizar(c.municipio) === normalizar(nombre)
        )
      )
      setCargandoCultivos(false)
    }

    cargarCultivos()

    return () => {
      activo = false
    }
  }, [nombre])

  // ==========================================
  // DATOS DE LA CATEGORÍA SELECCIONADA
  // ==========================================

  const actual = informacion[categoria]

  // VEGETACIÓN: nivel de color según el mayor éxito de cosecha (1 a 4)
  // Clima y Suelo siguen usando fila?.[actual.columna] como antes
  const nivel =
    categoria === 'Vegetación'
      ? cultivos.length
        ? Math.min(
            4,
            Math.max(
              1,
              Math.ceil(Number(mejorCultivo(cultivos).exito_cosecha_pct) / 25)
            )
          )
        : null
      : fila?.[actual.columna]

  const datos =
    categoria === 'Vegetación'
      ? // VEGETACIÓN: datos desde la tabla cultivos
        cargandoCultivos
        ? construirDatos(categoria, null, []).map(d => ({
            ...d,
            valor: 'Cargando...',
            detalle: null
          }))
        : construirDatos(categoria, null, cultivos)
      : cargandoDatos
        ? construirDatos(categoria, null).map(d => ({
            ...d,
            valor: 'Cargando...'
          }))
        : construirDatos(categoria, fila)

  // ==========================================
  // DISEÑO DE LA PANTALLA
  // ==========================================

  return (
    <div className="municipality-page">

      {/* ENCABEZADO */}

      <header className="municipality-header">

        <button
          className="municipality-back"
          onClick={onBack}
          aria-label="Volver al mapa"
          title="Volver al mapa"
        >
          ←
        </button>

        <div className="municipality-brand">
          <span>M</span>
          METEDGO
        </div>

        <div className="municipality-location">
          DURANGO, MÉXICO
        </div>

      </header>

      <main className="municipality-content">

        {/* NOMBRE Y MAPA DEL MUNICIPIO */}

        <section className="municipality-heading">

          <div>
            <span className="municipality-eyebrow">
              EXPLORACIÓN MUNICIPAL
            </span>

            <h1>{nombre}</h1>

            <p>
              Información territorial y ambiental del municipio
              seleccionado.
            </p>
          </div>

          {/* MAPA */}

          <div className="municipality-map">

            {cargando ? (

              <div className="municipality-map-message">
                Cargando mapa...
              </div>

            ) : error || !feature ? (

              <div className="municipality-map-message">
                No se pudo cargar el municipio
              </div>

            ) : (

              <MapContainer
                center={[24.02, -104.65]}
                zoom={8}
                scrollWheelZoom={false}
                dragging={true}
                className="small-municipality-map"
              >

                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <AjustarMunicipio feature={feature} />

                <GeoJSON
                  key={`${nombre}-${categoria}-${nivel ?? 0}`}
                  data={feature}
                  style={{
                    color: '#31553A',
                    weight: 2,
                    fillColor: nivel
                      ? actual.paleta[nivel - 1]
                      : actual.color,
                    fillOpacity: 0.7
                  }}
                />

              </MapContainer>

            )}

          </div>

        </section>

        {/* RESUMEN OCULTO */}

        <section className="municipality-overview">

          <div>
            <span>Municipio seleccionado</span>
            <h2>{nombre}</h2>
          </div>

          <div className="overview-status">
            <span>Información ambiental</span>

            <strong>
              {cargandoDatos
                ? 'Cargando...'
                : fila
                  ? 'Consulta disponible'
                  : 'Sin datos cargados'}
            </strong>
          </div>

        </section>

        {/* ANÁLISIS AMBIENTAL */}

        <section className="environment-section">

          <div className="environment-heading">

            <span className="municipality-eyebrow">
              ANÁLISIS AMBIENTAL
            </span>

            <h2>Explora sus características</h2>

            <p>
              Selecciona una categoría para consultar su información.
            </p>

          </div>

          {/* BOTONES DE CATEGORÍAS */}

          <div className="environment-tabs">

            {Object.keys(informacion).map(item => (

              <button
                key={item}
                className={
                  categoria === item
                    ? 'environment-tab selected'
                    : 'environment-tab'
                }
                onClick={() => setCategoria(item)}
              >
                <span>{informacion[item].icono}</span>
                {item}
              </button>

            ))}

          </div>

          {/* INFORMACIÓN AMBIENTAL */}

          <div className="environment-card">

            <div className="environment-card-heading">

              <div
                className="environment-icon"
                style={{ background: actual.color }}
              >
                {actual.icono}
              </div>

              <div>
                <h3>{actual.titulo}</h3>
                <p>{actual.descripcion}</p>
              </div>

            </div>

            {/* DATOS */}

            <div className="environment-data">

              {datos.map(dato => (

                <article
                  className="environment-data-item"
                  key={dato.nombre}
                >
                  <span>{dato.nombre}</span>
                  <strong>{dato.valor}</strong>

                  {/* VEGETACIÓN: detalle del cultivo (solo existe en esta categoría) */}
                  {dato.detalle && <small>{dato.detalle}</small>}
                </article>

              ))}

            </div>

            {/* FUENTE DE INFORMACIÓN */}

            <div className="environment-notice">

              {categoria === 'Vegetación'
                ? // VEGETACIÓN: aviso propio de la tabla cultivos
                  cultivos.length
                  ? 'Fuente: tabla de cultivos. Se muestra el cultivo recomendado por estación y el de mayor éxito de cosecha.'
                  : cargandoCultivos
                    ? 'Consultando la base de datos...'
                    : 'Este municipio todavía no tiene cultivos cargados.'
                : fila
                  ? `Fuente: ${fila.fuente ?? 'INEGI'}. Se muestra el elemento que predomina en el municipio.`
                  : cargandoDatos
                    ? 'Consultando la base de datos...'
                    : 'Este municipio todavía no tiene datos ambientales cargados.'}

            </div>

          </div>

        </section>

        {/* ACCESO A RECOMENDACIONES */}

        <section className="municipality-next">

          <div>

            <span>¿QUÉ SIGUE?</span>

            <h2>Consulta las recomendaciones ambientales</h2>

            <p>
              Accede al análisis de sugerencias, recomendaciones
              y posibles advertencias para este municipio.
            </p>

          </div>

          <button onClick={onRecommendations}>
            Ver recomendaciones →
          </button>

        </section>

      </main>

      {/* PIE DE PÁGINA OCULTO */}

      <footer className="municipality-footer">
        METEDGO · EXPLORACIÓN AMBIENTAL DE DURANGO
      </footer>

    </div>
  )
}

export default Municipality