
import { useState } from 'react'

import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Municipality from './pages/Municipality'
import Recommendations from './pages/Recommendations'

function App() {

  const [pagina, setPagina] = useState('home')

  const [municipioSeleccionado, setMunicipioSeleccionado] = useState('')

  return (
    <>

      {/* PANTALLA 1: INICIO */}
      {pagina === 'home' && (
        <Home
          onExplore={() => setPagina('dashboard')}
        />
      )}

      {/* PANTALLA 2: DASHBOARD */}
      {pagina === 'dashboard' && (
        <Dashboard
          onBack={() => setPagina('home')}
          onSelectMunicipality={(nombre) => {
            setMunicipioSeleccionado(nombre)
            setPagina('municipality')
          }}
        />
      )}

      {/* PANTALLA 3: MUNICIPIO */}
      {pagina === 'municipality' && (
        <Municipality
          nombre={municipioSeleccionado}
          onBack={() => setPagina('dashboard')}
          onRecommendations={() => setPagina('recommendations')}
        />
      )}

      {/* PANTALLA 4: RECOMENDACIONES */}
     
{pagina === 'recommendations' && (
  <Recommendations
    nombre={municipioSeleccionado}
    onBack={() => setPagina('municipality')}
  />
)}


    </>
  )
}

export default App
