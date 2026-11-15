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
import './Recommendations.css'

const ICONOS = { Clima: '☀', Suelo: '▤', Vegetación: '♧' }

// VEGETACIÓN: orden de las estaciones de la tabla cultivos
const ORDEN_ESTACIONES = ['Primavera-Verano', 'Otoño-Invierno', 'Perennes']

// VEGETACIÓN: normaliza nombres (sin acentos, minúsculas)
const normalizar = (texto) =>
  (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

// Mapa pequeño del municipio seleccionado
function AjustarMapa({ feature }) {
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

function Recommendations({ nombre, onBack }) {

  const [feature, setFeature] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  // Datos reales y reglas activas del municipio
  const [info, setInfo] = useState(null)
  const [cargandoInfo, setCargandoInfo] = useState(true)

  // VEGETACIÓN: cultivos del municipio (tabla "cultivos")
  const [cultivos, setCultivos] = useState([])

  // Obtener el contorno geográfico del municipio
  useEffect(() => {
    let activo = true

    async function cargarMapa() {
      try {
        setCargando(true)
        setError(false)

        const response = await fetch(
          'https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/10'
        )

        if (!response.ok) {
          throw new Error('No se pudo consultar INEGI')
        }

        const data = await response.json()

        const encontrado = data.features.find(item =>
          item.properties?.nomgeo?.toLowerCase() === nombre?.toLowerCase()
        )

        if (!encontrado) {
          throw new Error('Municipio no encontrado')
        }

        if (activo) setFeature(encontrado)

      } catch (err) {
        console.error(err)
        if (activo) setError(true)
      } finally {
        if (activo) setCargando(false)
      }
    }

    if (nombre) cargarMapa()

    return () => {
      activo = false
    }
  }, [nombre])

  // Obtener datos ambientales y recomendaciones desde Supabase
  useEffect(() => {
    let activo = true

    async function cargarInfo() {
      try {
        setCargandoInfo(true)

        const { data, error: err } = await supabase.rpc(
          'recomendaciones_municipio',
          { p_nombre: nombre }
        )

        if (err) throw err
        if (activo) setInfo(data)

      } catch (err) {
        console.error('Error cargando recomendaciones:', err)
        if (activo) setInfo(null)
      } finally {
        if (activo) setCargandoInfo(false)
      }
    }

    if (nombre) cargarInfo()

    return () => {
      activo = false
    }
  }, [nombre])

  // VEGETACIÓN: cargar los cultivos del municipio desde Supabase
  useEffect(() => {
    if (!nombre) return

    let activo = true

    async function cargarCultivos() {
      const { data, error: errorDb } = await supabase
        .from('cultivos')
        .select(
          'id, municipio, estacion, cultivo_recomendado, anios_evaluados, volumen_promedio_ton, rendimiento_prom, valor_promedio_mxn, exito_cosecha_pct'
        )

      if (!activo) return

      if (errorDb) {
        console.error('Error leyendo cultivos:', errorDb)
      }

      setCultivos(
        (data ?? []).filter(
          c => normalizar(c.municipio) === normalizar(nombre)
        )
      )
    }

    cargarCultivos()

    return () => {
      activo = false
    }
  }, [nombre])

  const datos = info?.datos || {}
  const reglas = info?.reglas || []
  const hayDatos = Object.keys(datos).length > 0

  // VEGETACIÓN: cultivo recomendado por estación y el de mayor éxito de cosecha
  const mejorCultivo = cultivos.reduce(
    (mejor, c) =>
      !mejor || Number(c.exito_cosecha_pct) > Number(mejor.exito_cosecha_pct)
        ? c
        : mejor,
    null
  )

  const resumenCultivos = ORDEN_ESTACIONES
    .map(estacion => {
      const c = cultivos.find(
        x => normalizar(x.estacion) === normalizar(estacion)
      )
      return c ? `${estacion}: ${c.cultivo_recomendado}` : null
    })
    .filter(Boolean)
    .join(' · ')

  // Recomendaciones generales (siempre visibles, no dependen de datos)
  const recomendacionesGenerales = [
    {
      categoria: 'Suelo',
      icono: '▤',
      titulo: 'Evaluación de las condiciones del suelo',
      descripcion:
        'Revisa las características físicas y químicas del suelo antes de establecer actividades agrícolas.',
      tipo: 'Recomendación',
      nivel: 'Preventivo'
    },
    {
      // VEGETACIÓN: ahora usa los datos de la tabla cultivos
      categoria: 'Vegetación',
      icono: '♧',
      titulo: 'Cultivos recomendados por estación',
      descripcion: mejorCultivo
        ? `${resumenCultivos}. Mayor éxito de cosecha: ${mejorCultivo.cultivo_recomendado} (${mejorCultivo.estacion}) con ${mejorCultivo.exito_cosecha_pct}%.`
        : 'Aún no hay cultivos cargados para este municipio.',
      tipo: 'Recomendación',
      nivel: mejorCultivo
        ? `${mejorCultivo.exito_cosecha_pct}% de éxito`
        : 'Sin datos'
    }
  ]

  const recomendaciones = reglas.filter(r => r.tipo !== 'Advertencia')
  const advertencias = reglas.filter(r => r.tipo === 'Advertencia')

  // Texto de un indicador: "16.6 °C" o null si no hay dato
  const dato = (indicador) => {
    const d = datos[indicador]
    return d ? `${d.valor} ${d.unidad}` : null
  }

  // Línea de valores para cada tarjeta de condiciones
  const resumenClima = [
    dato('temp_media_anual') && `Temp. media: ${dato('temp_media_anual')}`,
    dato('precip_anual') && `Lluvia: ${dato('precip_anual')}`
  ].filter(Boolean).join(' · ')

  const resumenSuelo = [
    dato('humedad_suelo') && `Humedad: ${dato('humedad_suelo')}`,
    dato('temp_suelo') && `Temp.: ${dato('temp_suelo')}`
  ].filter(Boolean).join(' · ')

  // Fuentes de datos usadas (sin repetir)
  const fuentes = [...new Set(Object.values(datos).map(d => d.fuente))]

  return (
    <div className="recommendations-page">

      {/* ENCABEZADO */}
      <header className="recommendations-header">

        <button
          className="recommendations-back"
          onClick={onBack}
        >
          ← Volver al municipio
        </button>

        <div className="recommendations-brand">
          <span>A</span>
          agroDGO
        </div>

        <div className="recommendations-location">
          DURANGO, MÉXICO
        </div>

      </header>

      <main className="recommendations-content">

        {/* TÍTULO Y MAPA */}
        <section className="recommendations-top">

          <div className="recommendations-title">

            <span className="recommendations-eyebrow">
              ANÁLISIS TERRITORIAL Y AMBIENTAL
            </span>

            <h1>
              Sugerencias y recomendaciones
            </h1>

            <p>
              Consulta las recomendaciones y posibles
              advertencias ambientales de:
            </p>

            <h2>{nombre}</h2>

          </div>

          <div className="recommendations-map">

            {cargando ? (
              <div className="recommendations-map-message">
                Cargando mapa...
              </div>
            ) : error || !feature ? (
              <div className="recommendations-map-message">
                No se pudo cargar el mapa
              </div>
            ) : (
              <MapContainer
                center={[24.02, -104.65]}
                zoom={8}
                scrollWheelZoom={false}
                className="recommendations-leaflet"
              >

                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <AjustarMapa feature={feature} />

                <GeoJSON
                  data={feature}
                  style={{
                    color: '#244B34',
                    weight: 2,
                    fillColor: '#8EAD79',
                    fillOpacity: 0.65
                  }}
                />

              </MapContainer>
            )}

          </div>

        </section>

        {/* CONDICIONES AMBIENTALES */}
        <section className="recommendations-section">

          <div className="recommendations-section-title">
            <span>01 · EVALUACIÓN</span>
            <h2>Condiciones ambientales</h2>
            <p>
              Valores medidos o estimados para {nombre}.
            </p>
          </div>

          <div className="condition-grid">

            <article className="condition-card">
              <div className="condition-icon climate-icon">☀</div>
              <h3>Clima</h3>
              <p>
                Temperatura, humedad, precipitación
                y condiciones meteorológicas.
              </p>
              {resumenClima && <span>{resumenClima}</span>}
            </article>

            <article className="condition-card">
              <div className="condition-icon soil-icon">▤</div>
              <h3>Suelo</h3>
              <p>
                Tipo de suelo, textura, propiedades
                y características edafológicas.
              </p>
              {resumenSuelo && <span>{resumenSuelo}</span>}
              <span>Pendiente de datos reales</span>
            </article>

            {/* VEGETACIÓN: usa los datos de la tabla cultivos */}
            <article className="condition-card">
              <div className="condition-icon vegetation-icon">♧</div>
              <h3>Vegetación</h3>
              <p>
                Cultivos recomendados por estación, rendimiento
                y éxito de cosecha.
              </p>
              <span>
                {mejorCultivo
                  ? `${cultivos.length} cultivos registrados · mejor: ${mejorCultivo.cultivo_recomendado}`
                  : 'Pendiente de datos reales'}
              </span>
            </article>

          </div>

        </section>

        {/* RECOMENDACIONES */}
        <section className="recommendations-section">

          <div className="recommendations-section-title">
            <span>02 · ORIENTACIÓN AMBIENTAL</span>
            <h2>Sugerencias y recomendaciones</h2>
            <p>
              Acciones sugeridas a partir de los datos del municipio.
            </p>
          </div>

          <div className="recommendation-list">

            {recomendaciones.map((item, index) => (

              <article
                className="recommendation-item"
                key={index}
              >

                <div className="recommendation-item-icon">
                  {ICONOS[item.categoria]}
                </div>

                <div className="recommendation-item-content">

                  <span>{item.categoria} · {item.tipo}</span>

                  <h3>{item.titulo}</h3>

                  <p>{item.descripcion}</p>

                </div>

                <span className="recommendation-status">
                  {item.nivel}
                </span>

              </article>

            ))}

            {recomendacionesGenerales.map((item, index) => (

              <article
                className="recommendation-item"
                key={`general-${index}`}
              >

                <div className="recommendation-item-icon">
                  {item.icono}
                </div>

                <div className="recommendation-item-content">

                  <span>{item.categoria} · {item.tipo}</span>

                  <h3>{item.titulo}</h3>

                  <p>{item.descripcion}</p>

                </div>

                <span className="recommendation-status">
                  {item.nivel}
                </span>

              </article>

            ))}

          </div>

        </section>

        {/* ADVERTENCIAS */}
        <section className="warnings-section">

          <div className="warnings-heading">
            <span>03 · PREVENCIÓN</span>
            <h2>Advertencias ambientales</h2>
            <p>
              Aspectos que deben monitorearse para identificar
              posibles riesgos.
            </p>
          </div>

          {advertencias.map((item, index) => (

            <div className="warning-card" key={index}>

              <div className="warning-symbol">!</div>

              <div>
                <h3>{item.titulo}</h3>
                <p>{item.descripcion}</p>
              </div>

              <span>{item.nivel}</span>

            </div>

          ))}

          {!cargandoInfo && advertencias.length === 0 && (

            <div className="warning-card">

              <div className="warning-symbol">!</div>

              <div>
                <h3>
                  {hayDatos
                    ? 'Sin advertencias con los datos actuales'
                    : 'Información de alertas no disponible'}
                </h3>

                <p>
                  {hayDatos
                    ? `Con los datos disponibles no se detectan riesgos específicos en ${nombre}.`
                    : `Aún no hay datos ambientales cargados para determinar riesgos en ${nombre}.`}
                </p>
              </div>

              <span>{hayDatos ? 'Sin alertas' : 'Sin evaluar'}</span>

            </div>

          )}

          <div className="warning-note">
            {hayDatos
              ? `Fuentes: ${fuentes.join('; ')}. Las recomendaciones usan umbrales generales.`
              : 'Las advertencias se habilitarán cuando haya datos ambientales cargados.'}
          </div>

        </section>

      </main>


    </div>
  )
}

export default Recommendations