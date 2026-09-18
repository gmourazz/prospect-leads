import { MotionConfig } from 'framer-motion'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { About } from './components/About'
import { Solutions } from './components/Solutions'
import { Companies } from './components/Companies'
import { Differentials } from './components/Differentials'
import { VisualBreak } from './components/VisualBreak'
import { FinalCta } from './components/FinalCta'
import { Contact } from './components/Contact'
import { Footer } from './components/Footer'
import { WhatsappFab } from './components/WhatsappFab'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <main>
        <Hero />
        <About />
        <Solutions />
        <Companies />
        <Differentials />
        <VisualBreak />
        <FinalCta />
        <Contact />
      </main>
      <Footer />
      <WhatsappFab />
    </MotionConfig>
  )
}
