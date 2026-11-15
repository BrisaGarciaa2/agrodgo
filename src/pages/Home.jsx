
import './Home.css'

function Home({ onExplore }) {
  return (
    <main className="home-screen">

      <div className="home-overlay"></div>

      <header className="home-top">
        <div className="home-brand">
          <span className="brand-symbol">M</span>
          <span>METEDGO</span>
        </div>

        <span className="home-location">
          DURANGO, MÉXICO
        </span>
      </header>

      <section className="home-content">

        <span className="home-eyebrow">
          EXPLORACIÓN TERRITORIAL Y AMBIENTAL
        </span>

        <h1>METEDGO</h1>

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

      <footer className="home-footer">
        <span>METEDGO · INFORMACIÓN TERRITORIAL</span>
        <span>ESTADO DE DURANGO</span>
      </footer>

    </main>
  )
}

export default Home
