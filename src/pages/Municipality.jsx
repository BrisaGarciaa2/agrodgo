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

// Datos de presentación de cada categoría.
// Los valores reales salen de la tabla "municipios" en Supabase
// (fuente: INEGI, Compendio de información geográfica municipal 2010).
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
    titulo: 'Cobertura vegetal',
    descripcion: 'Consulta los tipos de vegetación presentes en el municipio.',
    color: '#83A779',
    columna: 'vegetacion',
    paleta: ['#D5E2C0', '#A6C18A', '#6D956B', '#3F704C']
  }
}

const SIN_DATO = 'Sin dato'

// Grupos asignados a cada nivel (criterio del proyecto, ver script generar.cjs)
const GRUPO_SUELO = {
  1: 'Someros o poco desarrollados',
  2: 'Forestales con acumulación de arcilla',
  3: 'Ricos en materia orgánica',
  4: 'Arcillosos, calcáreos, salinos, aluviales o arenosos'
}

const GRUPO_VEGETACION = {
  1: 'Matorral',
  2: 'Pastizal o mezquital',
  3: 'Selva',
  4: 'Bosque'
}

const mayus = (texto) =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto

// "Semiseco templado (35.4% del municipio). ..." -> { nombre, pct }
// "Suelo dominante: Leptosol (35.2% del municipio)." -> { nombre, pct }
function extraerPrincipal(texto) {
  const m = texto?.match(/(?:^|: )([^:]+?) \(([\d.]+)% del municipio\)/)
  return m ? { nombre: m[1].trim(), pct: m[2] } : null
}

// "... Temperatura 08 – 22°C, precipitación 400 – 1 200 mm." -> { temperatura, precipitacion }
function extraerTempPrecip(texto) {
  const m = texto?.match(/Temperatura (.+?°C), precipitación (.+?mm)/)
  if (!m) return null

  const limpiar = (s) =>
    s.replace(/\b0(\d)\b/g, '$1').replace('°C', ' °C').replace(/(\d)mm/, '$1 mm')

  return { temperatura: limpiar(m[1]), precipitacion: limpiar(m[2]) }
}

// Tipo de humedad a partir del nombre del clima dominante
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

function construirDatos(categoria, fila) {
  if (categoria === 'Clima') {
    const clima = extraerPrincipal(fila?.descripcion_clima)
    const rangos = extraerTempPrecip(fila?.descripcion_clima)

    return [
      { nombre: 'Temperatura', valor: rangos?.temperatura ?? SIN_DATO },
      { nombre: 'Humedad', valor: clima ? humedadDe(clima.nombre) : SIN_DATO },
      { nombre: 'Precipitación', valor: rangos?.precipitacion ?? SIN_DATO },
      {
        nombre: 'Clima predominante',
        valor: clima ? `${mayus(clima.nombre)} · ${clima.pct}%` : SIN_DATO
      }
    ]
  }

  if (categoria === 'Suelo') {
    const suelo = extraerPrincipal(fila?.descripcion_suelo)

    return [
      { nombre: 'Suelo dominante', valor: suelo ? suelo.nombre : SIN_DATO },
      {
        nombre: 'Superficie que ocupa',
        valor: suelo ? `${suelo.pct}% del municipio` : SIN_DATO
      },
      { nombre: 'Grupo de suelo', valor: GRUPO_SUELO[fila?.suelo] ?? SIN_DATO }
    ]
  }

  const veg = extraerPrincipal(fila?.descripcion_vegetacion)

  return [
    { nombre: 'Vegetación predominante', valor: veg ? veg.nombre : SIN_DATO },
    {
      nombre: 'Superficie que ocupa',
      valor: veg ? `${veg.pct}% del municipio` : SIN_DATO
    },
    {
      nombre: 'Grupo de cobertura',
      valor: GRUPO_VEGETACION[fila?.vegetacion] ?? SIN_DATO
    }
  ]
}

function AjustarMunicipio({ feature }) {
  const map = useMap()

  useEffect(() => {
    if (!feature) return

    const capa = L.geoJSON(feature)
    const bounds = capa.getBounds()

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [15, 15] })
    }
  }, [feature, map])

  return null
}

function Municipality({ nombre, onBack, onRecommendations }) {
  const [categoria, setCategoria] = useState('Clima')
  const [feature, setFeature] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  // Datos ambientales reales (Supabase)
  const [fila, setFila] = useState(null)
  const [cargandoDatos, setCargandoDatos] = useState(true)

  // Límites del municipio (INEGI)
  useEffect(() => {
    let activo = true

    async function cargarMunicipio() {
      try {
        setCargando(true)
        setError(false)

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

        if (activo) setFeature(encontrado)

      } catch (err) {
        console.error(err)
        if (activo) setError(true)
      } finally {
        if (activo) setCargando(false)
      }
    }

    if (nombre) cargarMunicipio()

    return () => {
      activo = false
    }
  }, [nombre])

  // Datos de clima, suelo y vegetación del municipio (Supabase)
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

      if (errorDb) console.error('Error leyendo Supabase:', errorDb)

      setFila(data ?? null)
      setCargandoDatos(false)
    }

    cargarDatos()

    return () => {
      activo = false
    }
  }, [feature])

  const actual = informacion[categoria]
  const nivel = fila?.[actual.columna]
  const datos = cargandoDatos
    ? construirDatos(categoria, null).map(d => ({ ...d, valor: 'Cargando...' }))
    : construirDatos(categoria, fila)

  return (
    <div className="municipality-page">

      <header className="municipality-header">

        <button className="municipality-back" onClick={onBack}>
          ← Volver al mapa
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
                    fillColor: nivel ? actual.paleta[nivel - 1] : actual.color,
                    fillOpacity: 0.7
                  }}
                />
              </MapContainer>
            )}

          </div>
        </section>

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

            <div className="environment-data">

              {datos.map(dato => (
                <article className="environment-data-item" key={dato.nombre}>
                  <span>{dato.nombre}</span>
                  <strong>{dato.valor}</strong>
                </article>
              ))}

            </div>

            <div className="environment-notice">
              {fila
                ? `Fuente: ${fila.fuente ?? 'INEGI'}. Se muestra el elemento que predomina en el municipio.`
                : cargandoDatos
                  ? 'Consultando la base de datos...'
                  : 'Este municipio todavía no tiene datos ambientales cargados.'}
            </div>

          </div>

        </section>

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

      <footer className="municipality-footer">
        METEDGO · EXPLORACIÓN AMBIENTAL DE DURANGO
      </footer>

    </div>
  )
}

export default Municipality
