import { useEffect, useState } from 'react'
import L from 'leaflet'

import {
  MapContainer,
  TileLayer,
  useMap,
  GeoJSON
} from 'react-leaflet'

import { supabase } from '../supabaseClient'

import 'leaflet/dist/leaflet.css'
import './Dashboard.css'

// Configuración de cada capa, en lenguaje sencillo.
// Los cortes son FIJOS: el color significa lo mismo siempre,
// sin importar qué municipios tengan datos.
// AJUSTA los cortes de temperatura con tus datos reales.
const capaConfig = {
  Clima: {
    indicador: 'temp_media_anual',
    emoji: '🌡️',
    pregunta: '¿Qué temperatura hace?',
    explicacion:
      'Muestra la temperatura promedio del año. Los tonos azules son zonas más frescas, generalmente en la sierra; los naranjas, zonas más cálidas.',
    categorias: ['Fresco', 'Templado', 'Cálido', 'Muy cálido'],
    cortes: [14, 18, 22],
    rangos: ['menos de 14 °C', '14 – 18 °C', '18 – 22 °C', 'más de 22 °C'],
    colores: ['#B9D9E8', '#77B8D1', '#E8C77B', '#D98564'],
    comparativo: 'más cálido',
    frase: (cat, v) => `Clima ${cat.toLowerCase()}: ${Math.round(v)} °C en promedio al año`
  },
  Suelo: {
    indicador: 'humedad_suelo',
    emoji: '💧',
    pregunta: '¿Qué tan húmeda está la tierra?',
    explicacion:
      'Muestra cuánta agua hay en la capa superior de la tierra. Es importante para los cultivos y para saber si ha llovido lo suficiente.',
    categorias: ['Muy seca', 'Seca', 'Húmeda', 'Muy húmeda'],
    cortes: [0.15, 0.25, 0.33],
    rangos: ['menos de 15 % (0.15)', '15 – 25 % (0.15 – 0.25)', '25 – 33 % (0.25 – 0.33)', 'más de 33 % (0.33)'],
    colores: ['#E4D6B8', '#D8C09A', '#B99469', '#98734F'],
    comparativo: 'más húmedo',
    frase: (cat, v) => `Tierra ${cat.toLowerCase()}: ${Math.round(v * 100)} % de humedad`
  },
  Vegetación: {
    indicador: 'ndvi',
    emoji: '🌿',
    pregunta: '¿Qué tan verde está?',
    explicacion:
      'Muestra qué tan verde y sana se ve la vegetación desde el espacio. Los tonos más oscuros indican más plantas y bosque; los claros, zonas más secas o con menos vegetación.',
    categorias: ['Poca vegetación', 'Algo de vegetación', 'Bastante vegetación', 'Vegetación abundante'],
    cortes: [0.3, 0.5, 0.65],
    rangos: ['menos de 0.30', '0.30 – 0.50', '0.50 – 0.65', 'más de 0.65'],
    colores: ['#D5E2C0', '#A6C18A', '#6D956B', '#3F704C'],
    comparativo: 'más verde',
    frase: (cat) => cat
  }
}

// Devuelve el índice de categoría (0 a 3) según los cortes fijos
const categoriaDe = (cfg, v) => cfg.cortes.filter(c => v >= c).length

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
function MunicipalityLayer({ datos, estilo, onSelect, textoDato, claveCapa }) {

  const eventosMunicipio = (feature, layer) => {
    const nombre = feature.properties?.nomgeo || 'Municipio'

    layer.bindTooltip(`${nombre} · ${textoDato(nombre)}`)

    layer.on({
      click: () => onSelect(nombre)
    })
  }

  if (!datos?.features?.length) return null

  return (
    <GeoJSON
      key={`municipios-${claveCapa}`}
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
  const [datosCapas, setDatosCapas] = useState({})

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

  // Registrar municipios en Supabase y leer los datos de las capas
  useEffect(() => {
    if (!municipios?.features?.length) return

    const cargarCapas = async () => {
      try {
        const items = municipios.features.map(f => {
          const c = L.geoJSON(f).getBounds().getCenter()
          return { nombre: f.properties.nomgeo, lat: c.lat, lon: c.lng }
        })

        const { error: errReg } = await supabase.rpc(
          'registrar_municipios',
          { p_items: items }
        )
        if (errReg) console.error('Error registrando municipios:', errReg)

        const { data, error: errCapas } = await supabase.rpc('capas_dashboard')

        if (errCapas) throw errCapas

        setDatosCapas(data || {})

      } catch (err) {
        console.error('Error cargando capas:', err)
      }
    }

    cargarCapas()
  }, [municipios])

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

  // ----- Datos de la capa activa -----
  const config = capaConfig[capa]

  // Valor numérico de un municipio para una capa (o null si no hay)
  const valorEn = (nombre, cfg) => {
    const v = datosCapas[nombre]?.[cfg.indicador]?.valor
    return v != null && !isNaN(Number(v)) ? Number(v) : null
  }

  const valorDe = (nombre) => valorEn(nombre, config)

  const valores = Object.keys(datosCapas)
    .map(n => valorDe(n))
    .filter(v => v != null)

  const hayDatos = valores.length > 0

  // Estilo de los municipios (colores por categoría fija)
  const estiloMunicipio = (feature) => {
    const nombre = feature.properties?.nomgeo || ''
    const v = valorDe(nombre)

    return {
      fillColor: v == null ? '#DDDDDD' : config.colores[categoriaDe(config, v)],
      fillOpacity: 0.75,
      color: '#52634D',
      weight: 1.5
    }
  }

  // Texto del tooltip: solo la categoría, sin números técnicos
  const textoDato = (nombre) => {
    const v = valorDe(nombre)
    return v == null ? 'sin datos' : config.categorias[categoriaDe(config, v)]
  }

  // Cambia cuando cambia la capa o llegan datos, para repintar los polígonos
  const claveCapa = `${capa}-${valores.length}`

  // ----- Panel del municipio seleccionado, en frases -----
  const filasMunicipio = municipio
    ? Object.values(capaConfig)
      .map(cfg => {
        const v = valorEn(municipio, cfg)
        if (v == null) return null
        const i = categoriaDe(cfg, v)
        const d = datosCapas[municipio]?.[cfg.indicador]
        return {
          emoji: cfg.emoji,
          texto: cfg.frase(cfg.categorias[i], v, i),
          dato: `${d.valor} ${d.unidad || ''}`.trim()
        }
      })
      .filter(Boolean)
    : []

  const valorActivo = municipio ? valorDe(municipio) : null
  const menores = valorActivo != null
    ? valores.filter(v => v < valorActivo).length
    : 0

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
            <h2>agroDGO</h2>
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
              Explora los 39 municipios del estado y conoce cómo es
              su clima, su tierra y su vegetación. Toca un municipio
              en el mapa para ver su información.
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
            <p>Estado de la República Mexicana</p>
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
                    textoDato={textoDato}
                    claveCapa={claveCapa}
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

              {/* ¿QUÉ ESTOY VIENDO? */}
              <h3>{config.pregunta}</h3>

              <p className="map-description">
                {config.explicacion}
              </p>

              {/* LEYENDA */}
              <div className="legend">

                {config.colores.map((color, index) => (
                  <div className="legend-item" key={color}>
                    <span style={{ background: color }}></span>
                    <div className="legend-text">
                      <strong>{config.categorias[index]}</strong>
                      <small className="legend-range">
                        {config.rangos[index]}
                      </small>
                    </div>
                  </div>
                ))}

                <div className="legend-item">
                  <span style={{ background: '#DDDDDD' }}></span>
                  Sin datos
                </div>

              </div>

              <div className="map-divider"></div>

              {/* MUNICIPIO SELECCIONADO */}
              {municipio ? (
                <div className="selected-municipality">
                  <strong>{municipio}</strong>

                  {filasMunicipio.length > 0 ? (
                    <>
                      <ul className="muni-rows">
                        {filasMunicipio.map(f => (
                          <li key={f.texto}>
                            <span className="muni-emoji">{f.emoji}</span>
                            <div>
                              {f.texto}
                              <small className="muni-raw">Dato: {f.dato}</small>
                            </div>
                          </li>
                        ))}
                      </ul>

                      {valorActivo != null && (
                        <p className="muni-rank">
                          Es {config.comparativo} que {menores} de
                          los {valores.length} municipios con datos.
                        </p>
                      )}
                    </>
                  ) : (
                    <p>Todavía no hay datos de este municipio.</p>
                  )}
                </div>
              ) : (
                <p className="map-description">
                  Toca un municipio en el mapa o búscalo por su
                  nombre para ver su información.
                </p>
              )}

              <div className="data-notice">
                {hayDatos
                  ? 'Datos satelitales de la NASA y Open-Meteo. Son aproximados y no sustituyen mediciones locales. Gris = sin datos.'
                  : 'Aún no hay datos cargados para esta capa.'}
              </div>

            </aside>

          </div>

        </section>

      </main>

    </div>
  )
}

export default Dashboard