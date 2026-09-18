import { MotionConfig } from 'framer-motion'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Marquee } from './components/Marquee'
import { About } from './components/About'
import { Treatments } from './components/Treatments'
import { Differentials } from './components/Differentials'
import { ImageBand } from './components/ImageBand'
import { Structure } from './components/Structure'
import { Faq } from './components/Faq'
import { Contact } from './components/Contact'
import { CtaBanner } from './components/CtaBanner'
import { Footer } from './components/Footer'
import { WhatsappFab } from './components/WhatsappFab'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <main>
        <Hero />
        <Marquee />
        <About />
        <Treatments />
        <Differentials />
        <ImageBand />
        <Structure />
        <Faq />
        <Contact />
        <CtaBanner />
      </main>
      <Footer />
      <WhatsappFab />
      <div className="grain" aria-hidden="true" />
    </MotionConfig>
  )
}
