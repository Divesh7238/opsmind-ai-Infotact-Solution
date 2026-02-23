import { Link } from 'react-router-dom';
import { Brain, Shield, Zap, FileText, MessageSquare, ChevronRight, Star } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-dark-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-lg border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">OpsMind AI</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-dark-300 hover:text-white transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600/10 border border-primary-600/20 rounded-full text-primary-400 text-sm mb-8">
              <Zap className="w-4 h-4" />
              <span>Enterprise Knowledge Assistant</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Chat with your
              <span className="text-primary-500"> company knowledge</span>
            </h1>
            <p className="text-xl text-dark-400 max-w-2xl mx-auto mb-10">
              Upload your documents and let AI answer questions instantly with citations. 
              Replace hours of searching with instant, verified answers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-lg font-medium text-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                Start Free Trial
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto bg-dark-800 hover:bg-dark-700 text-white px-8 py-4 rounded-lg font-medium text-lg transition-colors border border-dark-700"
              >
                View Demo
              </Link>
            </div>
          </div>

          {/* Demo Preview */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm flex-shrink-0">
                    AI
                  </div>
                  <div className="bg-dark-700 rounded-lg p-4 text-dark-200">
                    How many sick leaves are employees entitled to per year?
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center text-white text-sm flex-shrink-0">
                    U
                  </div>
                  <div className="bg-primary-600/20 rounded-lg p-4 text-dark-200">
                    Employees are entitled to <span className="text-primary-400 font-medium">12 paid sick leaves</span> per year, which can be used for personal illness or caring for family members.
                    <div className="mt-3 pt-3 border-t border-dark-600 text-sm text-dark-400">
                      Source: HR_Policy.pdf – Page 14
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-dark-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything you need
            </h2>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto">
              Powerful features to transform how your team accesses company information
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: MessageSquare,
                title: 'Chat with Documents',
                description: 'Ask questions in natural language and get instant answers from your documents.'
              },
              {
                icon: FileText,
                title: 'Smart Citations',
                description: 'Every answer includes source document and page number for verification.'
              },
              {
                icon: Shield,
                title: 'Secure & Private',
                description: 'Your documents are processed locally. Enterprise-grade security included.'
              }
            ].map((feature, idx) => (
              <div 
                key={idx}
                className="bg-dark-800 border border-dark-700 rounded-xl p-8 hover:border-primary-500/50 transition-colors"
              >
                <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-dark-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-dark-400 text-lg">
              Start free and scale as you grow
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-white mb-2">Starter</h3>
              <p className="text-dark-400 mb-6">For small teams getting started</p>
              <div className="text-4xl font-bold text-white mb-6">
                Free
              </div>
              <ul className="space-y-4 mb-8">
                {['Up to 5 documents', '100 questions/month', 'Basic support', 'Chat history'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-dark-300">
                    <Star className="w-5 h-5 text-primary-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className="block w-full bg-dark-700 hover:bg-dark-600 text-white text-center py-3 rounded-lg font-medium transition-colors"
              >
                Get Started
              </Link>
            </div>

            <div className="bg-dark-800 border-2 border-primary-500 rounded-xl p-8 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                Popular
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
              <p className="text-dark-400 mb-6">For growing organizations</p>
              <div className="text-4xl font-bold text-white mb-6">
                Custom
              </div>
              <ul className="space-y-4 mb-8">
                {['Unlimited documents', 'Unlimited questions', 'Priority support', 'Custom integrations', 'SSO & advanced security'].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-dark-300">
                    <Star className="w-5 h-5 text-primary-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className="block w-full bg-primary-600 hover:bg-primary-700 text-white text-center py-3 rounded-lg font-medium transition-colors"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-dark-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">OpsMind AI</span>
            </div>
            <p className="text-dark-400 text-sm">
              © 2024 OpsMind AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
