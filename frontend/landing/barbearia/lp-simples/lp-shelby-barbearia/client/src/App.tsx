import { MotionConfig } from 'framer-motion'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { BeforeAfter } from './components/BeforeAfter'
import { Services } from './components/Services'
import { Pricing } from './components/Pricing'
import { Location } from './components/Location'
import { Footer } from './components/Footer'
import { WhatsappFab } from './components/WhatsappFab'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <main>
        <Hero />
        <BeforeAfter />
        <Services />
        <Pricing />
        <Location />
      </main>
      <Footer />
      <WhatsappFab />
    </MotionConfig>
  )
}
