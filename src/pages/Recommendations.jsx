import { useEffect, useState } from 'react'
import L from 'leaflet'

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap
} from 'react-leaflet'

import { supabase } from '../supabaseClient'// VEGETACIÓN: AJUSTA esta ruta a tu proyecto

import 'leaflet/dist/leaflet.css'
import './Recommendations.css'

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

  // Información demostrativa, pendiente de conectar a datos reales
  const recomendaciones = [
    {
      categoria: 'Clima',
      icono: '☀',
      titulo: 'Monitoreo de condiciones climáticas',
      descripcion:
        'Consulta periódicamente la temperatura, humedad y precipitación del municipio.',
      tipo: 'Sugerencia',
      nivel: 'Informativo'
    },
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
            <strong>En integración</strong>
          </div>

        </section>

        {/* CONDICIONES AMBIENTALES */}
        <section className="recommendations-section">

          <div className="recommendations-section-title">
            <span>01 · EVALUACIÓN</span>
            <h2>Condiciones ambientales</h2>
            <p>
              Áreas que deben considerarse para el análisis
              del municipio.
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
              <span>Pendiente de datos reales</span>
            </article>

            <article className="condition-card">
              <div className="condition-icon soil-icon">▤</div>
              <h3>Suelo</h3>
              <p>
                Tipo de suelo, textura, propiedades
                y características edafológicas.
              </p>
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
              Acciones generales para apoyar el seguimiento
              de las condiciones ambientales.
            </p>
          </div>

          <div className="recommendation-list">

            {recomendaciones.map((item, index) => (

              <article
                className="recommendation-item"
                key={index}
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

          <div className="warning-card">

            <div className="warning-symbol">!</div>

            <div>
              <h3>Información de alertas no disponible</h3>

              <p>
                Aún no se cuenta con datos meteorológicos
                y ambientales conectados para determinar
                riesgos específicos en {nombre}.
              </p>
            </div>

            <span>Sin evaluar</span>

          </div>

          <div className="warning-note">
            Las advertencias se habilitarán cuando se integren
            las fuentes de datos ambientales correspondientes.
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