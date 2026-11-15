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

const informacion = {
  Clima: {
    icono: '☀',
    titulo: 'Clima y Lluvias',
    descripcion: 'Temperaturas y temporada de precipitaciones.',
    color: '#B9D9E8',
    columna: 'clima',
    paleta: ['#B9D9E8', '#77B8D1', '#E8C77B', '#D98564']
  },

  Suelo: {
    icono: '▤',
    titulo: 'Estado de la Tierra',
    descripcion: 'Tipo de suelo, uso agrícola y tiempo de descanso necesario.',
    color: '#C5A477',
    columna: 'suelo',
    paleta: ['#D8C09A', '#B99469', '#98734F', '#E4D6B8']
  },

  Vegetación: {
    icono: '♧',
    titulo: 'Vegetación y Pastos',
    descripcion: 'Cobertura vegetal y zonas de agostadero.',
    color: '#83A779',
    columna: 'vegetacion',
    paleta: ['#D5E2C0', '#A6C18A', '#6D956B', '#3F704C']
  }
}

const SIN_DATO = 'Sin dato'

const GRUPO_SUELO = {
  1: 'Tierras delgadas o con piedra',
  2: 'Tierras de bosque con barro',
  3: 'Tierras oscuras y fértiles',
  4: 'Tierras arcillosas o arenosas'
}

const GRUPO_VEGETACION = {
  1: 'Matorral',
  2: 'Pastizal o mezquital',
  3: 'Selva',
  4: 'Bosque'
}

const mayus = (texto) =>
  texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto

function limpiarTextoSuelo(texto) {
  if (!texto) return 'Tierra apta para cultivo y agostadero'
  const partes = texto.split('(')
  return partes[0].trim()
}

// Lógica únicamente para calcular el estado y tiempo de descanso según el movimiento de hectáreas
function calcularEstadoYDescanso(datosActuales, historial) {
  if (!datosActuales) {
    return {
      estado: 'Uso normal',
      descanso: '6 meses (entre cosechas)'
    }
  }

  const totalActual = Number(datosActuales.hectareas_totales || 0)
  const suma = historial.reduce((acc, item) => acc + Number(item.hectareas_totales || 0), 0)
  const promedio = historial.length ? suma / historial.length : totalActual

  if (totalActual > promedio * 1.05) {
    return {
      estado: 'Alta exigencia / Muy trabajado',
      descanso: '1 año completo de descanso o abono'
    }
  }

  if (totalActual < promedio * 0.90) {
    return {
      estado: 'En recuperación / Actividad baja',
      descanso: '3 a 4 meses de preparación'
    }
  }

  return {
    estado: 'Uso equilibrado',
    descanso: '6 meses de descanso tradicional'
  }
}

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

  if (c.includes('mayor humedad')) return `${tipo} (húmedo)`
  if (c.includes('menor humedad')) return `${tipo} (seco)`
  if (c.includes('humedad media')) return `${tipo} (medio)`

  return tipo
}

function construirDatos(categoria, fila, datosSuelo, historialSuelo, anio) {
  if (categoria === 'Clima') {
    const clima = extraerPrincipal(fila?.descripcion_clima)
    const rangos = extraerTempPrecip(fila?.descripcion_clima)

    return [
      { nombre: 'Temperatura promedio', valor: rangos?.temperatura ?? SIN_DATO },
      { nombre: 'Humedad ambiental', valor: clima ? humedadDe(clima.nombre) : SIN_DATO },
      { nombre: 'Lluvia anual', valor: rangos?.precipitacion ?? SIN_DATO },
      { nombre: 'Clima dominante', valor: clima ? `${mayus(clima.nombre)} (${clima.pct}%)` : SIN_DATO }
    ]
  }

  if (categoria === 'Suelo') {
    if (datosSuelo) {
      const diagnostico = calcularEstadoYDescanso(datosSuelo, historialSuelo)

      return [
        { nombre: `Condición de la tierra (${anio})`, valor: diagnostico.estado },
        { nombre: 'Tiempo de descanso sugerido', valor: diagnostico.descanso },
        { nombre: 'Tipo de suelo', valor: limpiarTextoSuelo(datosSuelo.suelos_dominantes) },
        { nombre: 'Vocación principal', valor: datosSuelo.vocacion_edafica ?? SIN_DATO },
        { nombre: 'Temporada de siembra', valor: datosSuelo.ciclo_dominante ?? SIN_DATO },
        { nombre: 'Superficie de temporal (lluvia)', valor: `${Math.round(Number(datosSuelo.hectareas_temporal || 0)).toLocaleString()} hectáreas` },
        { nombre: 'Superficie con riego', valor: `${Math.round(Number(datosSuelo.hectareas_riego || 0)).toLocaleString()} hectáreas` },
        { nombre: 'Superficie total sembrada', valor: `${Math.round(Number(datosSuelo.hectareas_totales || 0)).toLocaleString()} hectáreas` }
      ]
    }

    const suelo = extraerPrincipal(fila?.descripcion_suelo)

    return [
      { nombre: 'Tipo de suelo principal', valor: suelo ? suelo.nombre : SIN_DATO },
      { nombre: 'Porcentaje del municipio', valor: suelo ? `${suelo.pct}%` : SIN_DATO },
      { nombre: 'Clasificación', valor: GRUPO_SUELO[fila?.suelo] ?? SIN_DATO }
    ]
  }

  const veg = extraerPrincipal(fila?.descripcion_vegetacion)

  return [
    { nombre: 'Vegetación principal', valor: veg ? veg.nombre : SIN_DATO },
    { nombre: 'Superficie cubierta', valor: veg ? `${veg.pct}% del municipio` : SIN_DATO },
    { nombre: 'Tipo de cobertura', valor: GRUPO_VEGETACION[fila?.vegetacion] ?? SIN_DATO }
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

  const [fila, setFila] = useState(null)
  const [cargandoDatos, setCargandoDatos] = useState(true)

  const [anio, setAnio] = useState(2026)
  const [historialSuelo, setHistorialSuelo] = useState([])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [nombre])

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

        if (!response.ok) throw new Error('Error al consultar INEGI')

        const data = await response.json()
        const encontrado = data.features.find(item =>
          item.properties?.nomgeo?.toLowerCase() === nombre?.toLowerCase()
        )

        if (!encontrado) throw new Error('Municipio no encontrado')

        if (activo) setFeature(encontrado)
      } catch (err) {
        console.error(err)
        if (activo) setError(true)
      } finally {
        if (activo) setCargando(false)
      }
    }

    if (nombre) cargarMunicipio()
    return () => { activo = false }
  }, [nombre])

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
      if (errorDb) console.error(errorDb)

      setFila(data ?? null)
      setCargandoDatos(false)
    }

    cargarDatos()
    return () => { activo = false }
  }, [feature])

  useEffect(() => {
    if (!nombre) return
    let activo = true

    async function cargarHistorialSuelo() {
      const { data, error: errorSuelo } = await supabase
        .from('estadisticas_anuales_municipio')
        .select('*')
        .ilike('municipio', nombre)
        .order('anio', { ascending: true })

      if (!activo) return
      if (errorSuelo) console.error(errorSuelo)

      setHistorialSuelo(data ?? [])
    }

    cargarHistorialSuelo()
    return () => { activo = false }
  }, [nombre])

  const datosSuelo = historialSuelo.find(item => item.anio === anio) ?? null
  const actual = informacion[categoria]
  const nivel = fila?.[actual.columna]

  const datos = cargandoDatos
    ? construirDatos(categoria, null, null, [], anio).map(d => ({ ...d, valor: 'Cargando...' }))
    : construirDatos(categoria, fila, datosSuelo, historialSuelo, anio)

  return (
    <div className="municipality-page">

      <header className="municipality-header">
        <button className="municipality-back" onClick={onBack} title="Volver">←</button>
        <div className="municipality-brand"><span>M</span> METEDGO</div>
        <div className="municipality-location">DURANGO, MÉXICO</div>
      </header>

      <main className="municipality-content">

        <section className="municipality-heading">
          <div>
            <span className="municipality-eyebrow">EXPLORACIÓN MUNICIPAL</span>
            <h1>{nombre}</h1>
            <p>Información ambiental y del campo seleccionada para este municipio.</p>
          </div>

          <div className="municipality-map">
            {cargando ? (
              <div className="municipality-map-message">Cargando mapa...</div>
            ) : error || !feature ? (
              <div className="municipality-map-message">Sin mapa disponible</div>
            ) : (
              <MapContainer center={[24.02, -104.65]} zoom={8} scrollWheelZoom={false} className="small-municipality-map">
                <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
            <span>Municipio</span>
            <h2>{nombre}</h2>
          </div>
          <div className="overview-status">
            <span>Disponibilidad</span>
            <strong>{cargandoDatos ? 'Cargando...' : 'Datos listos'}</strong>
          </div>
        </section>

        <section className="environment-section">
          <div className="environment-heading">
            <span className="municipality-eyebrow">CARACTERÍSTICAS</span>
            <h2>Selecciona una categoría</h2>
          </div>

          <div className="environment-tabs">
            {Object.keys(informacion).map(item => (
              <button
                key={item}
                className={categoria === item ? 'environment-tab selected' : 'environment-tab'}
                onClick={() => setCategoria(item)}
              >
                <span>{informacion[item].icono}</span>
                {item}
              </button>
            ))}
          </div>

          <div className="environment-card">
            <div className="environment-card-heading">
              <div className="environment-icon" style={{ background: actual.color }}>
                {actual.icono}
              </div>
              <div>
                <h3>{actual.titulo}</h3>
                <p>{actual.descripcion}</p>
              </div>
            </div>

            {categoria === 'Suelo' && (
              <div style={{ margin: '12px 0' }}>
                <label style={{ fontSize: '13px', marginRight: '8px', fontWeight: 'bold' }}>
                  Seleccionar año:
                </label>
                <select
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                  style={{ padding: '4px 8px', borderRadius: '4px' }}
                >
                  {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="environment-data">
              {datos.map(dato => (
                <article className="environment-data-item" key={dato.nombre}>
                  <span>{dato.nombre}</span>
                  <strong>{dato.valor}</strong>
                </article>
              ))}
            </div>

            <div className="environment-notice">
              {categoria === 'Suelo' && datosSuelo
                ? `Estadísticas agrícolas oficiales de Durango analizadas para el año ${anio}.`
                : 'Datos de referencia territorial oficiales.'}
            </div>
          </div>
        </section>

        <section className="municipality-next">
          <div>
            <span>¿QUÉ SIGUE?</span>
            <h2>Recomendaciones para el campo</h2>
            <p>Consulta sugerencias y consejos prácticos para las tierras de este municipio.</p>
          </div>
          <button onClick={onRecommendations}>Ver recomendaciones →</button>
        </section>

      </main>

      <footer className="municipality-footer">
        METEDGO · EXPLORACIÓN AMBIENTAL DE DURANGO
      </footer>
    </div>
  )
}

export default Municipality