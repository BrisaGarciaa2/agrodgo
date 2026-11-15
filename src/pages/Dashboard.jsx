
import { useEffect, useState } from 'react'
import L from 'leaflet'

import {
  MapContainer,
  TileLayer,
  useMap,
  GeoJSON
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'
import './Dashboard.css'

// Paletas de colores ilustrativas
const colores = {
  Clima: ['#B9D9E8', '#77B8D1', '#E8C77B', '#D98564'],
  Suelo: ['#D8C09A', '#B99469', '#98734F', '#E4D6B8'],
  Vegetación: ['#D5E2C0', '#A6C18A', '#6D956B', '#3F704C']
}

// Ajustar automáticamente el mapa
function AjustarMapa({ datos }) {
  const map = useMap()

  useEffect(() => {
    if (!datos?.features?.length) return

    const capa = L.geoJSON(datos)
    const limites = capa.getBounds()

    if (limites.isValid()) {
      map.fitBounds(limites, { padding: [20, 20] })
    }
  }, [datos, map])

  return null
}

// Componente que dibuja los municipios
function MunicipalityLayer({ datos, estilo, onSelect }) {

  const eventosMunicipio = (feature, layer) => {
    const nombre = feature.properties?.nomgeo || 'Municipio'

    layer.bindTooltip(nombre)

    layer.on({
      click: () => onSelect(nombre)
    })
  }

  if (!datos?.features?.length) return null

  return (
    <GeoJSON
      key="municipios-durango"
      data={datos}
      style={estilo}
      onEachFeature={eventosMunicipio}
    />
  )
}

function Dashboard({ onSelectMunicipality, onBack }) {

  const [municipios, setMunicipios] = useState(null)
  const [municipio, setMunicipio] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [capa, setCapa] = useState('Clima')
  const [error, setError] = useState('')

  // Consultar límites municipales de Durango
  useEffect(() => {
    const cargarMunicipios = async () => {
      try {
        const response = await fetch(
          'https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/10'
        )

        if (!response.ok) {
          throw new Error('No se pudo consultar INEGI')
        }

        const data = await response.json()

        if (!data.features || !data.features.length) {
          throw new Error('La respuesta no contiene municipios')
        }

        setMunicipios(data)
        setError('')

      } catch (err) {
        console.error('Error cargando municipios:', err)
        setError(err.message)
      }
    }

    cargarMunicipios()
  }, [])

  const lista = municipios?.features || []

  // Buscador
  const filtrados = lista.filter(item =>
    item.properties?.nomgeo
      ?.toLowerCase()
      .includes(busqueda.toLowerCase())
  )

  // Seleccionar municipio
  const seleccionar = (nombre) => {
    setMunicipio(nombre)
    onSelectMunicipality?.(nombre)
  }

  // Estilo de los municipios
  const estiloMunicipio = (feature) => {

    const nombre = feature.properties?.nomgeo || ''

    const indice = [...nombre].reduce(
      (total, letra) => total + letra.charCodeAt(0),
      0
    )

    const paleta = colores[capa]
    const color = paleta[indice % paleta.length]

    return {
      fillColor: color,
      fillOpacity: 0.75,
      color: '#52634D',
      weight: 1.5
    }
  }

  return (
    <div className="dashboard">

      {/* ENCABEZADO */}
      <header className="dash-header">

        <div className="dash-brand">

          <button
            className="back-button"
            onClick={() => onBack?.()}
          >
            ←
          </button>

          <div>
            <h2>METEDGO</h2>
            <span>Explorador ambiental de Durango</span>
          </div>

        </div>

        <div className="dash-location">
          DURANGO, MÉXICO
        </div>

      </header>

      <main className="dash-content">

        {/* INTRODUCCIÓN */}
        
<section className="dash-intro">

  <div className="intro-text">
    <span className="dash-label">
      EXPLORADOR TERRITORIAL
    </span>

    <h1>Descubre Durango</h1>

    <p>
      Explora los 39 municipios del estado y conoce sus
      características ambientales. Consulta información
      sobre el clima, los tipos de suelo y la vegetación
      para comprender mejor el entorno natural de cada región.
    </p>
  </div>

  <div className="municipality-count">
    <strong>39</strong>
    <span>Municipios por explorar</span>
  </div>

</section>


        {/* TARJETAS GENERALES */}
        <section className="general-cards">

          <article className="general-card">
            <span>Territorio</span>
            <h3>Durango</h3>
            <p>Estado de México</p>
          </article>

          <article className="general-card">
            <span>División municipal</span>
            <h3>{lista.length || '--'}</h3>
            <p>Municipios cargados</p>
          </article>

          <article className="general-card">
            <span>Información ambiental</span>
            <h3>3 capas</h3>
            <p>Clima, suelo y vegetación</p>
          </article>

        </section>

        {/* MAPA */}
        <section className="map-section">

          <div className="map-heading">

            <div>
              <span className="dash-label">
                MAPA INTERACTIVO
              </span>

              <h2>Explora los municipios</h2>
            </div>

            <div className="layer-buttons">

              {['Clima', 'Suelo', 'Vegetación'].map(nombre => (
                <button
                  key={nombre}
                  className={capa === nombre ? 'layer-active' : ''}
                  onClick={() => setCapa(nombre)}
                >
                  {nombre}
                </button>
              ))}

            </div>

          </div>

          <div className="map-layout">

            {/* MAPA */}
            <div className="map-wrapper">

              {error ? (

                <div className="map-message">
                  <h3>No se pudo cargar el mapa</h3>
                  <p>{error}</p>
                  <button onClick={() => window.location.reload()}>
                    Reintentar
                  </button>
                </div>

              ) : !municipios ? (

                <div className="map-message">
                  Cargando límites municipales de Durango...
                </div>

              ) : (

                <MapContainer
                  center={[24.02, -104.65]}
                  zoom={7}
                  scrollWheelZoom={true}
                  className="durango-map"
                >

                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <AjustarMapa datos={municipios} />

                  <MunicipalityLayer
                    datos={municipios}
                    estilo={estiloMunicipio}
                    onSelect={seleccionar}
                  />

                </MapContainer>

              )}

            </div>

            {/* PANEL LATERAL */}
            <aside className="map-sidebar">

              <h3>Buscar municipio</h3>

              <input
                type="text"
                placeholder="Escribe un municipio..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />

              {busqueda && (

                <div className="search-results">

                  {filtrados.slice(0, 6).map(item => (
                    <button
                      key={item.properties.cvegeo}
                      onClick={() =>
                        seleccionar(item.properties.nomgeo)
                      }
                    >
                      {item.properties.nomgeo}
                      <span>→</span>
                    </button>
                  ))}

                  {filtrados.length === 0 && (
                    <p>No se encontraron municipios.</p>
                  )}

                </div>

              )}

              <div className="map-divider"></div>

              <h3>Información del mapa</h3>

              <p className="map-description">
                Selecciona un municipio en el mapa o utiliza
                el buscador para consultar sus características.
              </p>

              {municipio && (
                <div className="selected-municipality">
                  <span>Municipio seleccionado</span>
                  <strong>{municipio}</strong>
                </div>
              )}

              <div className="legend">

                <h4>Leyenda: {capa}</h4>

                {colores[capa].map((color, index) => (
                  <div className="legend-item" key={color}>
                    <span style={{ background: color }}></span>
                    {capa} · Nivel {index + 1}
                  </div>
                ))}

              </div>

              <div className="data-notice">
                Los colores son ilustrativos. Todavía no representan
                mediciones ambientales reales.
              </div>

            </aside>

          </div>

        </section>

      </main>

      <footer className="dash-footer">
        METEDGO · EXPLORACIÓN AMBIENTAL DE DURANGO
      </footer>

    </div>
  )
}

export default Dashboard
