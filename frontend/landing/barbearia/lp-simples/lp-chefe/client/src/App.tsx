import { MotionConfig } from 'framer-motion'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Differentials } from './components/Differentials'
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
        <Differentials />
        <Services />
        <Location />
        <Pricing />
      </main>
      <Footer />
      <WhatsappFab />
    </MotionConfig>
  )
}
