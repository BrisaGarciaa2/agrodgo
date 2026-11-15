
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

const ICONOS = {
  Clima: '☀',
  Suelo: '▤',
  Vegetación: '♧'
}

const ORDEN_ESTACIONES = [
  'Primavera-Verano',
  'Otoño-Invierno',
  'Perennes'
]

const normalizar = (texto) =>
  (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

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

  // Información general y reglas de Supabase
  const [info, setInfo] = useState(null)
  const [cargandoInfo, setCargandoInfo] = useState(true)

  // Cultivos del municipio
  const [cultivos, setCultivos] = useState([])

  // DATOS DE SUELO: misma consulta que Municipality.jsx
  const [anio, setAnio] = useState(2026)
  const [datosSuelo, setDatosSuelo] = useState(null)
  const [cargandoSuelo, setCargandoSuelo] = useState(true)

  // Cargar mapa municipal
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

  // Cargar información ambiental y recomendaciones
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

  // CULTIVOS: consultar tabla cultivos
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

  // SUELO: MISMA CONSULTA DEL PRIMER ARCHIVO
  useEffect(() => {
    if (!nombre) return

    let activo = true

    async function cargarDatosSuelo() {
      try {
        setCargandoSuelo(true)

        const { data, error: errorSuelo } = await supabase
          .from('estadisticas_anuales_municipio')
          .select('*')
          .ilike('municipio', nombre)
          .eq('anio', anio)
          .maybeSingle()

        if (!activo) return

        if (errorSuelo) {
          console.error('Error leyendo datos de suelo:', errorSuelo)
        }

        setDatosSuelo(data ?? null)

      } catch (err) {
        console.error('Error consultando suelo:', err)

        if (activo) setDatosSuelo(null)

      } finally {
        if (activo) setCargandoSuelo(false)
      }
    }

    cargarDatosSuelo()

    return () => {
      activo = false
    }
  }, [nombre, anio])

  // Información recibida desde la función RPC
  const datos = info?.datos || {}
  const reglas = info?.reglas || []
  const hayDatos = Object.keys(datos).length > 0

  // Cultivo con mayor porcentaje de éxito
  const mejorCultivo = cultivos.reduce(
    (mejor, c) =>
      !mejor ||
      Number(c.exito_cosecha_pct) > Number(mejor.exito_cosecha_pct)
        ? c
        : mejor,
    null
  )

  // Cultivos por estación
  const resumenCultivos = ORDEN_ESTACIONES
    .map(estacion => {
      const c = cultivos.find(
        x => normalizar(x.estacion) === normalizar(estacion)
      )

      return c
        ? `${estacion}: ${c.cultivo_recomendado}`
        : null
    })
    .filter(Boolean)
    .join(' · ')

  // Recomendaciones generales
  const recomendacionesGenerales = [
    {
      categoria: 'Suelo',
      icono: '▤',
      titulo: 'Evaluación de las condiciones del suelo',
      descripcion: datosSuelo
        ? `Los suelos dominantes son ${datosSuelo.suelos_dominantes || 'Sin dato'}. La vocación edáfica registrada es: ${datosSuelo.vocacion_edafica || 'Sin dato'}.`
        : 'Revisa las características físicas y químicas del suelo antes de establecer actividades agrícolas.',
      tipo: 'Recomendación',
      nivel: 'Preventivo'
    },
    {
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

  const recomendaciones = reglas.filter(
    r => r.tipo !== 'Advertencia'
  )

  const advertencias = reglas.filter(
    r => r.tipo === 'Advertencia'
  )

  // Indicadores generales
  const dato = (indicador) => {
    const d = datos[indicador]
    return d ? `${d.valor} ${d.unidad}` : null
  }

  const resumenClima = [
    dato('temp_media_anual') &&
      `Temp. media: ${dato('temp_media_anual')}`,
    dato('precip_anual') &&
      `Lluvia: ${dato('precip_anual')}`
  ].filter(Boolean).join(' · ')

  // RESUMEN DE SUELO CON DATOS REALES
  const resumenSuelo = datosSuelo
    ? [
        datosSuelo.suelos_dominantes &&
          `Suelos: ${datosSuelo.suelos_dominantes}`,
        datosSuelo.vocacion_edafica &&
          `Vocación: ${datosSuelo.vocacion_edafica}`
      ].filter(Boolean).join(' · ')
    : ''

  // Superficies agrícolas
  const superficieTemporal = datosSuelo
    ? `${Number(datosSuelo.hectareas_temporal || 0).toLocaleString()} ha`
    : 'Sin dato'

  const superficieRiego = datosSuelo
    ? `${Number(datosSuelo.hectareas_riego || 0).toLocaleString()} ha`
    : 'Sin dato'

  const superficieTotal = datosSuelo
    ? `${Number(datosSuelo.hectareas_totales || 0).toLocaleString()} ha`
    : 'Sin dato'

  const fuentes = [
    ...new Set(
      Object.values(datos).map(d => d.fuente).filter(Boolean)
    )
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
              Sugerencias y Advertencias 
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

        {/* RECOMENDACIONES */}
        <section className="recommendations-section">

          <div className="recommendations-section-title">
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

              <span>
                {hayDatos ? 'Sin alertas' : 'Sin evaluar'}
              </span>

            </div>

          )}

          <div className="warning-note">
            {hayDatos
              ? `Fuentes: ${fuentes.join('; ')}. Las recomendaciones usan umbrales generales y son orientativas: valídalas con un especialista local.`
              : 'Las advertencias se habilitarán cuando haya datos ambientales cargados.'}
          </div>

        </section>

      </main>


    </div>
  )
}

export default Recommendations
