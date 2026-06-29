import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ShieldCheck, Wrench, Settings2, Play, Star, Zap, Users, BarChart3 } from 'lucide-react'
import optismartLogo from '@/assets/optismart-logo.png'
import { optismartCatalogProducts } from '@/data/optismartProducts'
import { formatCurrency } from '@/lib/utils'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
}

const stats = [
  { value: '2,400+', label: 'Cameras sold', icon: Zap },
  { value: '98%', label: 'Delivery rate', icon: CheckCircle2 },
  { value: '340+', label: 'Field agents', icon: Users },
  { value: '₦1.2B+', label: 'GMV processed', icon: BarChart3 },
]

const features = [
  {
    title: 'Commission-gated',
    body: 'DSA earnings unlock only after physical delivery is confirmed. No fraud. No shortcuts.',
    icon: CheckCircle2,
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Field dispatch',
    body: 'Book certified installers instantly and track every job milestone from the portal.',
    icon: Wrench,
    color: 'bg-brand-50 text-brand-600',
  },
  {
    title: 'Full admin control',
    body: 'Payments, user roles, inventory, analytics — one pane of glass for your entire operation.',
    icon: Settings2,
    color: 'bg-violet-50 text-violet-600',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-50 text-surface-900 font-sans selection:bg-brand-500/20 overflow-x-hidden">

      {/* ── NAVBAR ── */}
      <header className="fixed left-0 right-0 top-0 z-50 px-4 py-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl bg-white/80 px-6 shadow-sm ring-1 ring-surface-200 backdrop-blur-xl"
        >
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <img src={optismartLogo} alt="OptiSmart" className="h-8 w-auto object-contain" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-surface-600">
            <a href="#products" className="hover:text-brand-600 transition-colors">Products</a>
            <a href="#features" className="hover:text-brand-600 transition-colors">Features</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/auth/login" className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-surface-700 hover:text-surface-900 hover:bg-surface-100 rounded-xl transition-all">
              Sign in
            </Link>
            <Link to="/auth/register" className="btn-primary rounded-xl px-5 py-2 text-sm">
              Apply now
            </Link>
          </div>
        </motion.div>
      </header>

      <main>
        {/* ── HERO ── */}
        <section className="relative pt-28 pb-0 overflow-hidden">

          {/* Subtle grid background */}
          <div className="absolute inset-0 z-0 opacity-50" style={{
            backgroundImage: 'linear-gradient(rgba(10,116,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(10,116,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }} />
          {/* Glow blobs */}
          <div className="absolute top-20 left-1/3 w-[500px] h-[400px] bg-brand-300/10 blur-[100px] rounded-full pointer-events-none z-0" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-300/10 blur-[80px] rounded-full pointer-events-none z-0" />

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[calc(100vh-7rem)] pb-16">

              {/* LEFT — Text */}
              <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col items-start">
                <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700 mb-8 shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                  Enterprise Operations Portal · Nigeria
                </motion.div>

                <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.03em] leading-[1.05] mb-6 text-surface-900">
                  Run your CCTV<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500">
                    operation<br />smarter.
                  </span>
                </motion.h1>

                <motion.p variants={fadeUp} className="text-lg text-surface-500 leading-relaxed font-medium mb-10 max-w-lg">
                  One portal for your DSAs, installers, and resellers. Orders, commissions, and dispatches — fully automated.
                </motion.p>

                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4 mb-12">
                  <Link to="/auth/login" className="group btn-primary h-14 px-8 text-base shadow-brand-lg hover:-translate-y-1 transition-all duration-300 flex items-center gap-2">
                    Open portal <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <a href="#products" className="inline-flex items-center gap-2 h-14 px-8 text-base font-bold rounded-xl bg-white ring-1 ring-surface-200 hover:bg-surface-50 hover:ring-brand-200 text-surface-700 transition-all">
                    <Play className="h-4 w-4 fill-current text-brand-500" /> View catalog
                  </a>
                </motion.div>

                {/* Stats row */}
                <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 w-full max-w-sm">
                  {stats.map((s) => (
                    <div key={s.label} className="rounded-2xl bg-white ring-1 ring-surface-200 px-5 py-4 shadow-sm">
                      <p className="text-2xl font-black text-surface-900 tracking-tight">{s.value}</p>
                      <p className="text-xs text-surface-400 font-semibold mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </motion.div>
              </motion.div>

              {/* RIGHT — Visual showcase */}
              <div className="relative hidden lg:flex items-center justify-center">
                {/* Decorative rings */}
                <div className="absolute w-[480px] h-[480px] rounded-full border border-surface-200/60 border-dashed" />
                <div className="absolute w-[360px] h-[360px] rounded-full border border-brand-100/60 border-dashed" />

                {/* Center large product */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="relative z-10 w-52 h-52 rounded-3xl bg-white ring-1 ring-surface-200 shadow-card-xl flex items-center justify-center p-6"
                >
                  <img src={optismartCatalogProducts[1].image_url} alt={optismartCatalogProducts[1].name} className="w-full h-full object-contain" />
                </motion.div>

                {/* Top-left floating card */}
                <motion.div
                  initial={{ opacity: 0, x: -30, y: -20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute top-4 left-4 w-40 rounded-2xl bg-white ring-1 ring-surface-200 shadow-card-lg p-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface-50 flex items-center justify-center mb-2">
                    <img src={optismartCatalogProducts[0].image_url} alt="" className="w-8 h-8 object-contain" />
                  </div>
                  <p className="text-xs font-black text-surface-800 leading-tight">{optismartCatalogProducts[0].name}</p>
                  <p className="text-xs font-bold text-brand-600 mt-1">{formatCurrency(optismartCatalogProducts[0].retail_price)}</p>
                </motion.div>

                {/* Top-right floating card */}
                <motion.div
                  initial={{ opacity: 0, x: 30, y: -20 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute top-8 right-0 w-40 rounded-2xl bg-white ring-1 ring-surface-200 shadow-card-lg p-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface-50 flex items-center justify-center mb-2">
                    <img src={optismartCatalogProducts[2].image_url} alt="" className="w-8 h-8 object-contain" />
                  </div>
                  <p className="text-xs font-black text-surface-800 leading-tight">{optismartCatalogProducts[2].name}</p>
                  <p className="text-xs font-bold text-brand-600 mt-1">{formatCurrency(optismartCatalogProducts[2].retail_price)}</p>
                </motion.div>

                {/* Bottom-left metric */}
                <motion.div
                  initial={{ opacity: 0, x: -30, y: 30 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-10 left-0 rounded-2xl bg-white ring-1 ring-emerald-200 shadow-card-lg px-5 py-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-surface-400 font-semibold">Delivery rate</p>
                    <p className="text-lg font-black text-surface-900">98%</p>
                  </div>
                </motion.div>

                {/* Bottom-right metric */}
                <motion.div
                  initial={{ opacity: 0, x: 30, y: 30 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bottom-6 right-2 rounded-2xl bg-white ring-1 ring-brand-200 shadow-card-lg px-5 py-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-brand-500" />
                  </div>
                  <div>
                    <p className="text-xs text-surface-400 font-semibold">Active agents</p>
                    <p className="text-lg font-black text-surface-900">340+</p>
                  </div>
                </motion.div>
              </div>

            </div>
          </div>
        </section>


        {/* ── FEATURES ── */}
        <section id="features" className="py-32 bg-white border-t border-surface-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
              className="text-center mb-20"
            >
              <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">Why OptiSmart Portal</motion.p>
              <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-black tracking-tight text-surface-900">Built for real operations</motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-lg text-surface-500 max-w-2xl mx-auto">Not another SaaS dashboard. A system designed around how Nigerian camera distribution actually works.</motion.p>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
              variants={stagger}
              className="grid gap-6 md:grid-cols-3"
            >
              {features.map((f) => (
                <motion.div key={f.title} variants={fadeUp} className="rounded-3xl border border-surface-200 bg-surface-50 p-8 hover:bg-white hover:shadow-card-lg hover:border-brand-100 transition-all duration-300">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${f.color} mb-6`}>
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-black text-surface-900 mb-3">{f.title}</h3>
                  <p className="text-base leading-relaxed text-surface-500">{f.body}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── PRODUCTS ── */}
        <section id="products" className="py-32 bg-surface-50 border-t border-surface-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
              className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16"
            >
              <div>
                <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-2">Hardware</motion.p>
                <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-black tracking-tight text-surface-900">Camera catalog</motion.h2>
              </div>
              <motion.a variants={fadeUp} href="https://optismart.com.ng/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:text-brand-700 transition-colors group">
                Visit official store <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </motion.a>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
              variants={stagger}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {optismartCatalogProducts.map((product) => (
                <motion.a
                  key={product.name}
                  variants={fadeUp}
                  href={product.source_url}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="group flex flex-col rounded-3xl border border-surface-200 bg-white p-6 shadow-sm hover:border-brand-200 hover:shadow-card-lg transition-all duration-300"
                >
                  <div className="aspect-[4/3] rounded-2xl bg-surface-50 flex items-center justify-center mb-6 overflow-hidden">
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-contain p-4 group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <h3 className="text-base font-black text-surface-900 group-hover:text-brand-600 transition-colors leading-tight">{product.name}</h3>
                  <div className="mt-2 text-xl font-black text-brand-700">{formatCurrency(product.retail_price)}</div>
                  <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-surface-100">
                    {product.specs.map((spec) => (
                      <span key={spec} className="rounded-lg bg-surface-100 px-2.5 py-1 text-xs font-bold text-surface-600">{spec}</span>
                    ))}
                  </div>
                </motion.a>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="py-32 bg-white border-t border-surface-100 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50/80 via-transparent to-cyan-50/40 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand-400/10 blur-[100px] rounded-full pointer-events-none" />
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger}
            className="mx-auto max-w-3xl px-4 sm:px-6 text-center relative z-10"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700 mb-8">
              <Star className="h-4 w-4 fill-current text-brand-500" /> Join the network
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-6xl font-black tracking-tight text-surface-900 mb-6">
              Ready to sell smarter?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-surface-500 mb-10">
              Apply for dealer, installer, or reseller access and start processing orders with OptiSmart Portal today.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth/register" className="group btn-primary h-14 px-8 text-base shadow-brand-lg w-full sm:w-auto hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2">
                Apply now <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/auth/login" className="inline-flex items-center justify-center h-14 px-8 text-base font-bold rounded-xl ring-1 ring-surface-200 hover:bg-surface-50 text-surface-700 transition-all w-full sm:w-auto">
                Sign in
              </Link>
            </motion.div>
          </motion.div>
        </section>
      </main>

      <footer className="bg-white border-t border-surface-200 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={optismartLogo} alt="OptiSmart" className="h-6 w-auto opacity-50 grayscale" />
          <p className="text-sm font-medium text-surface-400">
            &copy; {new Date().getFullYear()} OptiSmart Portal. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
