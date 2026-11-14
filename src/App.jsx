
import { useState } from 'react'
import './App.css'

function App() {
  const [pagina, setPagina] = useState('Inicio')

  const opciones = [
    'Inicio',
    'Mapa interactivo',
    'Clima',
    'Análisis del suelo',
    'Cultivos',
    'Recomendaciones',
    'Reportes'
  ]

  const iconos = ['⌂', '◎', '☀', '▤', '♧', '✧', '▥']

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="logo">
          <div className="logo-icon">A</div>
          <div>
            <h2>AGRODURANGO</h2>
            <span>Agricultura inteligente</span>
          </div>
        </div>

        <p className="menu-title">MENÚ PRINCIPAL</p>

        <nav>
          {opciones.map((opcion, index) => (
            <button
              key={opcion}
              className={`menu-item ${pagina === opcion ? 'active' : ''}`}
              onClick={() => setPagina(opcion)}
            >
              <span className="menu-icon">{iconos[index]}</span>
              {opcion}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span>AGRODURANGO v1.0</span>
        </div>

      </aside>

      {/* CONTENIDO */}
      <div className="main-container">

        <header className="header">
          <div>
            <h3>{pagina}</h3>
            <p>Plataforma de monitoreo agrícola</p>
          </div>
        </header>

        <main className="content">

          {pagina === 'Inicio' ? (
            <>
              <section className="welcome">
                <div>
                  <span className="welcome-label">
                    PLATAFORMA AGRÍCOLA
                  </span>
                  <h1>Bienvenido a AGRODURANGO</h1>
                  <p>
                    Consulta y monitorea las condiciones agrícolas
                    del estado de Durango.
                  </p>
                </div>
                <div className="welcome-decoration">♧</div>
              </section>

              <h2 className="section-title">
                Resumen general
              </h2>

              <section className="stats">

                <div className="stat-card">
                  <span>Municipios</span>
                  <h2>39</h2>
                  <p>Municipios de Durango</p>
                </div>

                <div className="stat-card">
                  <span>Zonas agrícolas</span>
                  <h2>--</h2>
                  <p>Pendiente de registrar</p>
                </div>

                <div className="stat-card">
                  <span>Datos climáticos</span>
                  <h2>--</h2>
                  <p>Pendiente de conectar</p>
                </div>

                <div className="stat-card">
                  <span>Alertas</span>
                  <h2>--</h2>
                  <p>Pendiente de configurar</p>
                </div>

              </section>

              <h2 className="section-title">
                Módulos de la plataforma
              </h2>

              <section className="modules">

                {opciones.slice(1).map((opcion, index) => (
                  <button
                    key={opcion}
                    className="module-card"
                    onClick={() => setPagina(opcion)}
                  >
                    <div className="module-icon">
                      {iconos[index + 1]}
                    </div>
                    <h3>{opcion}</h3>
                    <p>Consultar información del módulo</p>
                    <span>Explorar →</span>
                  </button>
                ))}

              </section>
            </>
          ) : (
            <section className="empty-page">
              <div className="empty-icon">
                {iconos[opciones.indexOf(pagina)]}
              </div>

              <h1>{pagina}</h1>

              <p>
                Este módulo formará parte de AGRODURANGO.
                Actualmente se encuentra en desarrollo.
              </p>

              <button onClick={() => setPagina('Inicio')}>
                Volver al inicio
              </button>
            </section>
          )}

        </main>

      </div>

    </div>
  )
}

export default App
