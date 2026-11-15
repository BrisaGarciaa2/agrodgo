
import { useEffect, useState } from 'react'
import L from 'leaflet'
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'
import './Municipality.css'

// Información provisional para construir la interfaz.
// Posteriormente se conectará con datos ambientales reales.
const informacion = {
  Clima: {
    icono: '☀',
    titulo: 'Condiciones climáticas',
    descripcion: 'Consulta las condiciones meteorológicas del municipio.',
    datos: [
      { nombre: 'Temperatura', valor: 'Pendiente' },
      { nombre: 'Humedad', valor: 'Pendiente' },
      { nombre: 'Precipitación', valor: 'Pendiente' },
      { nombre: 'Condición actual', valor: 'Sin conectar' }
    ],
    color: '#B9D9E8'
  },

  Suelo: {
    icono: '▤',
    titulo: 'Características del suelo',
    descripcion: 'Información sobre las propiedades y tipos de suelo.',
    datos: [
      { nombre: 'Tipo de suelo', valor: 'Por determinar' },
      { nombre: 'Textura', valor: 'Por determinar' },
      { nombre: 'Características', valor: 'Por determinar' },
      { nombre: 'Uso potencial', valor: 'Por determinar' }
    ],
    color: '#C5A477'
  },

  Vegetación: {
    icono: '♧',
    titulo: 'Cobertura vegetal',
    descripcion: 'Consulta los tipos de vegetación presentes en el municipio.',
    datos: [
      { nombre: 'Vegetación predominante', valor: 'Por determinar' },
      { nombre: 'Cobertura vegetal', valor: 'Por determinar' },
      { nombre: 'Tipo de ecosistema', valor: 'Por determinar' },
      { nombre: 'Superficie vegetal', valor: 'Por determinar' }
    ],
    color: '#83A779'
  }
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

  const actual = informacion[categoria]

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
                  key={`${nombre}-${categoria}`}
                  data={feature}
                  style={{
                    color: '#31553A',
                    weight: 2,
                    fillColor: actual.color,
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
            <strong>Consulta disponible</strong>
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

              {actual.datos.map(dato => (
                <article className="environment-data-item" key={dato.nombre}>
                  <span>{dato.nombre}</span>
                  <strong>{dato.valor}</strong>
                </article>
              ))}

            </div>

            <div className="environment-notice">
              Los datos ambientales todavía están pendientes de
              integración con sus fuentes correspondientes.
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
