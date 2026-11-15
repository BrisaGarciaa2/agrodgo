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

  const datos = info?.datos || {}

  // Solo hay datos de Clima; Suelo y Vegetación se muestran sin datos
  const reglas = (info?.reglas || []).filter(r => r.categoria === 'Clima')

  const recomendacionesSinDatos = [
    {
      categoria: 'Suelo',
      icono: '▤',
      titulo: 'Suelo: sin datos disponibles',
      descripcion: `Aún no hay datos de suelo para generar recomendaciones en ${nombre}.`,
      tipo: 'Recomendación',
      nivel: 'Sin datos'
    },
    {
      categoria: 'Vegetación',
      icono: '♧',
      titulo: 'Vegetación: sin datos disponibles',
      descripcion: `Aún no hay datos de vegetación para generar recomendaciones en ${nombre}.`,
      tipo: 'Recomendación',
      nivel: 'Sin datos'
    }
  ]
  const hayDatos = Object.keys(datos).length > 0

  const recomendaciones = reglas.filter(r => r.tipo !== 'Advertencia')
  const advertencias = reglas.filter(r => r.tipo === 'Advertencia')

  // Texto de un indicador: "16.6 °C" o null si no hay dato
  const dato = (indicador) => {
    const d = datos[indicador]
    return d && d.valor !== null && d.valor !== undefined
      ? `${d.valor} ${d.unidad}`
      : null
  }

  // Promedios anuales (NASA POWER)
  const resumenClima = [
    dato('temp_media_anual') && `Temp. media: ${dato('temp_media_anual')}`,
    dato('precip_anual') && `Lluvia: ${dato('precip_anual')}`
  ].filter(Boolean).join(' · ')

  // Condiciones actuales (Open-Meteo)
  const resumenAhora = [
    datos.condicion_clima?.etiqueta,
    dato('temp_actual') && `Temp.: ${dato('temp_actual')}`,
    dato('humedad_aire') && `Humedad: ${dato('humedad_aire')}`,
    dato('viento') && `Viento: ${dato('viento')}`,
    dato('precip_actual') && `Precip.: ${dato('precip_actual')}`
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
          <span>M</span>
          METEDGO
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

        {/* RESUMEN */}
        <section className="recommendations-summary">

          <div>
            <span>Municipio analizado</span>
            <strong>{nombre}</strong>
          </div>

          <div>
            <span>Áreas de evaluación</span>
            <strong>3 categorías</strong>
          </div>

          <div>
            <span>Estado del análisis</span>
            <strong>
              {cargandoInfo
                ? 'Cargando...'
                : hayDatos
                  ? 'Con datos reales'
                  : 'Sin datos cargados'}
            </strong>
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
              <div className="condition-values">
                {resumenClima && (
                  <span className="condition-value">{resumenClima}</span>
                )}
                {resumenAhora && (
                  <span className="condition-value">Ahora: {resumenAhora}</span>
                )}
                {!resumenClima && !resumenAhora && (
                  <span className="condition-value">Pendiente de datos reales</span>
                )}
              </div>
            </article>

            <article className="condition-card">
              <div className="condition-icon soil-icon">▤</div>
              <h3>Suelo</h3>
              <p>
                Tipo de suelo, textura, propiedades
                y características edafológicas.
              </p>
              <div className="condition-values">
                <span className="condition-value">Sin datos disponibles</span>
              </div>
            </article>

            <article className="condition-card">
              <div className="condition-icon vegetation-icon">♧</div>
              <h3>Vegetación</h3>
              <p>
                Cobertura vegetal, ecosistemas
                y distribución de la vegetación.
              </p>
              <div className="condition-values">
                <span className="condition-value">Sin datos disponibles</span>
              </div>
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

            {recomendacionesSinDatos.map((item, index) => (

              <article
                className="recommendation-item"
                key={`sin-datos-${index}`}
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
              ? `Fuentes: ${fuentes.join('; ')}. Las recomendaciones usan umbrales generales y son orientativas: valídalas con un especialista local.`
              : 'Las advertencias se habilitarán cuando haya datos ambientales cargados.'}
          </div>

        </section>

      </main>

      <footer className="recommendations-footer">
        METEDGO · EXPLORACIÓN AMBIENTAL DE DURANGO
      </footer>

    </div>
  )
}

export default Recommendations