import { useEffect, useState } from 'react'
import L from 'leaflet'

import {
  MapContainer,
  TileLayer,
  useMap,
  GeoJSON
} from 'react-leaflet'

import { supabase } from '../supabaseClient'// AJUSTA esta ruta a tu proyecto

import 'leaflet/dist/leaflet.css'
import './Dashboard.css'

// Configuración de cada capa: indicador que se muestra y paleta (de menor a mayor)
const capaConfig = {
  Clima: {
    indicador: 'temp_media_anual',
    etiqueta: 'Temperatura media anual',
    colores: ['#B9D9E8', '#77B8D1', '#E8C77B', '#D98564']
  },
  Suelo: {
    indicador: 'humedad_suelo',
    etiqueta: 'Humedad del suelo (0–7 cm)',
    colores: ['#E4D6B8', '#D8C09A', '#B99469', '#98734F']
  },
  // VEGETACIÓN: ahora usa la tabla "cultivos" (éxito de cosecha máximo por municipio)
  Vegetación: {
    indicador: 'exito_cosecha_pct',
    etiqueta: 'Éxito de cosecha (%) del mejor cultivo',
    colores: ['#D5E2C0', '#A6C18A', '#6D956B', '#3F704C']
  }
}

// VEGETACIÓN: orden en que se muestran las estaciones
const ordenEstaciones = ['Primavera-Verano', 'Otoño-Invierno', 'Perennes']

// VEGETACIÓN: normaliza nombres (sin acentos, minúsculas) para empatar INEGI con la tabla
const normalizar = (texto) =>
  (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

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

    layer.bindTooltip(`${nombre}${textoDato(nombre)}`)

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
  // VEGETACIÓN: filas de la tabla "cultivos"
  const [cultivos, setCultivos] = useState([])

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

        const { data: total, error: errReg } = await supabase.rpc(
          'registrar_municipios',
          { p_items: items }
        )
        console.log('Municipios registrados:', total, errReg)

        const { data, error: errCapas } = await supabase.rpc('capas_dashboard')
        console.log('Capas recibidas:', Object.keys(data || {}).length, errCapas)

        if (errCapas) throw errCapas
        setDatosCapas(data || {})

      } catch (err) {
        console.error('Error cargando capas:', err)
      }
    }

    cargarCapas()
  }, [municipios])

  // VEGETACIÓN: leer la tabla "cultivos"
  useEffect(() => {
    const cargarCultivos = async () => {
      try {
        const { data, error: errCultivos } = await supabase
          .from('cultivos')
          .select(
            'id, municipio, estacion, cultivo_recomendado, anios_evaluados, volumen_promedio_ton, rendimiento_prom, valor_promedio_mxn, exito_cosecha_pct'
          )

        console.log('Cultivos recibidos:', (data || []).length, errCultivos)

        if (errCultivos) throw errCultivos
        setCultivos(data || [])

      } catch (err) {
        console.error('Error cargando cultivos:', err)
      }
    }

    cargarCultivos()
  }, [])

  // VEGETACIÓN: agrupa los cultivos por municipio (clave normalizada)
  const cultivosPorMunicipio = cultivos.reduce((acc, fila) => {
    const clave = normalizar(fila.municipio)
    if (!acc[clave]) acc[clave] = []
    acc[clave].push(fila)
    return acc
  }, {})

  // VEGETACIÓN: cultivo con mayor éxito de cosecha de una lista de filas
  const mejorCultivo = (filas) =>
    filas.reduce(
      (mejor, f) =>
        !mejor || Number(f.exito_cosecha_pct) > Number(mejor.exito_cosecha_pct)
          ? f
          : mejor,
      null
    )

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

  const valorDe = (nombre) => {
    // VEGETACIÓN: mayor éxito de cosecha entre los cultivos del municipio
    if (capa === 'Vegetación') {
      const filas = cultivosPorMunicipio[normalizar(nombre)]
      return filas?.length ? mejorCultivo(filas).exito_cosecha_pct : undefined
    }
    return datosCapas[nombre]?.[config.indicador]?.valor
  }

  const nombresConDatos =
    capa === 'Vegetación'
      ? Object.keys(cultivosPorMunicipio)
      : Object.keys(datosCapas)

  const valores = nombresConDatos
    .map(n => Number(valorDe(n)))
    .filter(v => !isNaN(v) && valorDe !== undefined)

  const hayDatos = valores.length > 0
  const min = hayDatos ? Math.min(...valores) : 0
  const max = hayDatos ? Math.max(...valores) : 1

  const nivelDe = (v) =>
    Math.min(3, Math.max(0, Math.floor(((v - min) / (max - min || 1)) * 4)))

  // Estilo de los municipios
  const estiloMunicipio = (feature) => {
    const nombre = feature.properties?.nomgeo || ''
    const v = valorDe(nombre)

    return {
      fillColor: v == null ? '#DDDDDD' : config.colores[nivelDe(Number(v))],
      fillOpacity: 0.75,
      color: '#52634D',
      weight: 1.5
    }
  }

  const textoDato = (nombre) => {
    // VEGETACIÓN: muestra el mejor cultivo y su éxito de cosecha
    if (capa === 'Vegetación') {
      const filas = cultivosPorMunicipio[normalizar(nombre)]
      if (!filas?.length) return ' · sin datos'
      const mejor = mejorCultivo(filas)
      return ` · ${mejor.cultivo_recomendado} (${mejor.exito_cosecha_pct}% éxito)`
    }

    const d = datosCapas[nombre]?.[config.indicador]
    return d ? ` · ${d.valor} ${d.unidad}` : ' · sin datos'
  }

  // Cambia cuando cambia la capa o llegan datos, para repintar los polígonos
  const claveCapa = `${capa}-${valores.length}`

  // Datos del municipio seleccionado
  const datosMunicipio = municipio ? datosCapas[municipio] : null

  // VEGETACIÓN: cultivos del municipio seleccionado, ordenados por estación
  const cultivosMunicipio = municipio
    ? [...(cultivosPorMunicipio[normalizar(municipio)] || [])].sort(
        (a, b) =>
          ordenEstaciones.indexOf(a.estacion) -
          ordenEstaciones.indexOf(b.estacion)
      )
    : []
  const mejorMunicipio = cultivosMunicipio.length
    ? mejorCultivo(cultivosMunicipio)
    : null

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
            <h2>meteDGO</h2>
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

              <h3>Información del mapa</h3>

              <p className="map-description">
                Selecciona un municipio en el mapa o utiliza
                el buscador para consultar sus características.
              </p>

              {municipio && (
                <div className="selected-municipality">
                  <span>Municipio seleccionado</span>
                  <strong>{municipio}</strong>

                  {capa === 'Vegetación' ? (
                    // VEGETACIÓN: cultivo recomendado por estación
                    cultivosMunicipio.length ? (
                      <ul>
                        {cultivosMunicipio.map(c => {
                          const esMejor = c.id === mejorMunicipio?.id
                          return (
                            <li
                              key={c.id}
                              style={esMejor ? { fontWeight: 600 } : undefined}
                            >
                              {c.estacion}: {c.cultivo_recomendado}
                              {esMejor && ' ★ mayor éxito de cosecha'}
                              <br />
                              Éxito de cosecha: {c.exito_cosecha_pct}% · Rendimiento: {c.rendimiento_prom}
                              <br />
                              Volumen: {Number(c.volumen_promedio_ton).toLocaleString('es-MX')} ton · Valor: ${Number(c.valor_promedio_mxn).toLocaleString('es-MX')} MXN
                              <br />
                              Años evaluados: {c.anios_evaluados}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p>Sin datos de cultivos para este municipio.</p>
                    )
                  ) : datosMunicipio ? (
                    <ul>
                      {Object.entries(datosMunicipio).map(([clave, d]) => (
                        <li key={clave}>
                          {clave.replace(/_/g, ' ')}: {d.valor} {d.unidad}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Sin datos cargados todavía.</p>
                  )}
                </div>
              )}

              <div className="legend">

                <h4>{config.etiqueta}</h4>

                {config.colores.map((color, index) => {
                  const desde = min + ((max - min) / 4) * index
                  const hasta = min + ((max - min) / 4) * (index + 1)

                  return (
                    <div className="legend-item" key={color}>
                      <span style={{ background: color }}></span>
                      {hayDatos
                        ? `${desde.toFixed(1)} – ${hasta.toFixed(1)}`
                        : `Nivel ${index + 1}`}
                    </div>
                  )
                })}

              </div>

              <div className="data-notice">
                {hayDatos
                  ? capa === 'Vegetación'
                    ? 'Datos de la tabla de cultivos (cultivo recomendado por estación). Gris = sin datos.'
                    : 'Datos de NASA POWER, Open-Meteo y NASA MODIS. Gris = sin datos.'
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