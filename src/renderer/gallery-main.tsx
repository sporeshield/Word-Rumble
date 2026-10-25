import { createRoot } from 'react-dom/client'
import { Gallery } from './components/Gallery'
import './components/theme.css'
import './gallery.css'

createRoot(document.getElementById('root')!).render(<Gallery />)
