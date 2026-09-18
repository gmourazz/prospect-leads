import { MotionConfig } from 'framer-motion'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { StatsBar } from './components/StatsBar'
import { About } from './components/About'
import { Services } from './components/Services'
import { Exams } from './components/Exams'
import { WorkHealth } from './components/WorkHealth'
import { Testimonials } from './components/Testimonials'
import { Partners } from './components/Partners'
import { Contact } from './components/Contact'
import { Footer } from './components/Footer'
import { WhatsappFab } from './components/WhatsappFab'

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <main>
        <Hero />
        <StatsBar />
        <About />
        <Services />
        <Exams />
        <WorkHealth />
        <Testimonials />
        <Partners />
        <Contact />
      </main>
      <Footer />
      <WhatsappFab />
    </MotionConfig>
  )
}
