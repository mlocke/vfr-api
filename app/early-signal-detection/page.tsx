import Link from 'next/link'
import fs from 'fs'
import path from 'path'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default async function EarlySignalDetectionPage() {
  // Read the markdown file
  const markdownPath = path.join(process.cwd(), 'docs', 'user-guides', 'early-signal-detection.md')
  const markdownContent = fs.readFileSync(markdownPath, 'utf-8')
  return (
    <div className="min-h-screen" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#0f172a',
      overflowY: 'auto',
      overflowX: 'hidden'
    }}>
      {/* Header Navigation */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            <span className="text-xl">←</span>
            <span className="font-medium">Back to Home</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white hidden sm:block">Early Signal Detection</h1>
          <Link
            href="/stock-intelligence"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors shadow-lg"
          >
            Try It Now
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Markdown Content with Tailwind Typography */}
        <article className="prose prose-invert prose-lg max-w-none
          prose-headings:text-blue-400
          prose-h1:text-4xl prose-h1:font-bold prose-h1:mb-4
          prose-h2:text-3xl prose-h2:font-bold prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:border-emerald-500/30 prose-h2:pb-3
          prose-h3:text-2xl prose-h3:font-semibold prose-h3:text-cyan-400 prose-h3:mt-8 prose-h3:mb-4
          prose-h4:text-xl prose-h4:font-semibold prose-h4:text-emerald-400 prose-h4:mt-6 prose-h4:mb-3
          prose-p:text-slate-300 prose-p:leading-relaxed
          prose-a:text-blue-400 prose-a:no-underline hover:prose-a:text-blue-300
          prose-strong:text-white prose-strong:font-semibold
          prose-code:text-emerald-400 prose-code:bg-slate-800 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
          prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700
          prose-ul:text-slate-300 prose-ul:space-y-2
          prose-ol:text-slate-300 prose-ol:space-y-2
          prose-li:text-slate-300
          prose-table:border prose-table:border-slate-700 prose-table:rounded-lg
          prose-thead:bg-slate-800
          prose-th:text-emerald-400 prose-th:font-semibold prose-th:px-6 prose-th:py-3
          prose-td:text-slate-300 prose-td:px-6 prose-td:py-4
          prose-tr:border-slate-700 prose-tr:hover:bg-slate-800/50
          prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-900/20 prose-blockquote:text-blue-200
          ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdownContent}
          </ReactMarkdown>
        </article>
      </main>

      {/* Footer CTA */}
      <footer className="bg-slate-900 border-t border-slate-700/50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-4">Ready to Try Early Signal Detection?</h3>
          <p className="text-slate-100 text-lg mb-8 max-w-2xl mx-auto">
            Access AI-powered analyst rating predictions through VFR's Stock Intelligence platform. Position your portfolio before the market reacts.
          </p>
          <Link
            href="/stock-intelligence"
            className="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            Analyze Stocks Now →
          </Link>
        </div>
      </footer>
    </div>
  )
}
