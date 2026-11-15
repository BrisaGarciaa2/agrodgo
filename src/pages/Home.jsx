
import { useState, useRef } from 'react'
import './Home.css'

function Home({ onExplore }) {
  const homeRef = useRef(null)

  const [position, setPosition] = useState({
    x: 0,
    y: 0
  })

  const handleMouseMove = (e) => {
    const rect = homeRef.current.getBoundingClientRect()

    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5

    setPosition({ x, y })
  }

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }

  return (
    <main
      className="home-screen"
      ref={homeRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        '--move-x': `${position.x * -25}px`,
        '--move-y': `${position.y * -25}px`
      }}
    >

      <div className="home-overlay"></div>

      <header className="home-top">
        <div className="home-brand">
          <span className="brand-symbol">A</span>
          <span>agroDGO</span>
        </div>

        <span className="home-location">
          DURANGO, MÉXICO
        </span>
      </header>

      <section className="home-content">

        <span className="home-eyebrow">
          EXPLORACIÓN TERRITORIAL Y AMBIENTAL
        </span>

        <h1>agroDGO</h1>

        <div className="home-line"></div>

        <h2>
          Conoce el territorio.
          <br />
          Comprende su entorno.
        </h2>

        <p>
          Explora las condiciones climáticas, características
          del suelo y vegetación de los municipios de Durango
          mediante información geográfica.
        </p>

        <button
          className="explore-button"
          onClick={onExplore}
        >
          Explorar Durango
          <span>→</span>
        </button>

      </section>

    </main>
  )
}

export default Home
