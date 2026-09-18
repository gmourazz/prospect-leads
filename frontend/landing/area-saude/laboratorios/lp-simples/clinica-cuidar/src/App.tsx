import { MotionConfig } from 'framer-motion'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { About } from './components/About'
import { Services } from './components/Services'
import { Differentials } from './components/Differentials'
import { Testimonial } from './components/Testimonial'
import { Contact } from './components/Contact'
import { CtaBanner } from './components/CtaBanner'
import { Footer } from './components/Footer'
import { WhatsappFab } from './components/WhatsappFab'
import { Marquee } from './components/Marquee'
import { ImageBand } from './components/ImageBand'
import { Faq } from './components/Faq'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <main>
        <Hero />
        <Marquee />
        <About />
        <Services />
        <Differentials />
        <ImageBand />
        <Testimonial />
        <Faq />
        <Contact />
        <CtaBanner />
      </main>
      <Footer />
      <WhatsappFab />
    </MotionConfig>
  )
}
