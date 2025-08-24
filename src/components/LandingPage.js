import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const LandingPage = () => {
  const { user, signOut } = useAuth()
  const [showAuthDropdown, setShowAuthDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAuthDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      setShowAuthDropdown(false)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Professional Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-black">JudgeMe</h1>
                <p className="text-sm text-gray-600">Event Judging Platform</p>
              </div>
            </div>

            {/* Navigation and Auth */}
            <nav className="flex items-center space-x-6">
              {/* Main Navigation */}
              <div className="hidden md:flex items-center space-x-6">
                <Link to="/" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                  Home
                </Link>
                <Link to="/access-event" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                  Join Event
                </Link>
                {user && (
                  <Link to="/admin" className="text-gray-700 hover:text-green-600 font-medium transition-colors">
                    Dashboard
                  </Link>
                )}
              </div>

              {/* Auth Section */}
              <div className="relative" ref={dropdownRef}>
                {user ? (
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600 hidden md:block">
                      Welcome, {user.email}
                    </span>
                    <button
                      onClick={() => setShowAuthDropdown(!showAuthDropdown)}
                      className="flex items-center space-x-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Account</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showAuthDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                        <Link
                          to="/admin"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAuthDropdown(false)}
                        >
                          Dashboard
                        </Link>
                        <Link
                          to="/create-event"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowAuthDropdown(false)}
                        >
                          Create Event
                        </Link>
                        <hr className="my-1" />
                        <button
                          onClick={handleSignOut}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Link
                      to="/auth"
                      className="text-gray-700 hover:text-green-600 font-medium transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/auth"
                      className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors font-medium"
                    >
                      Create Account
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-black mb-6">
              Professional Event Judging
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Create and manage professional judging events with ease. 
              Streamline your evaluation process with our intuitive platform designed for competitions, contests, and assessments.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-20">
            {/* Create Event Option */}
            <div className="text-center">
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-10 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-black mb-4">Create Event</h3>
                <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                  Set up a new judging event with custom criteria, candidates, and judges. 
                  Perfect for competitions, contests, and assessments.
                </p>
                {user ? (
                  <Link 
                    to="/create-event"
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 inline-block w-full text-lg"
                  >
                    Create New Event
                  </Link>
                ) : (
                  <Link 
                    to="/auth"
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 inline-block w-full text-lg"
                  >
                    Sign Up to Create
                  </Link>
                )}
              </div>
            </div>

            {/* Access Event Option */}
            <div className="text-center">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-10 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-black mb-4">Join Event</h3>
                <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                  Join an existing event as a judge using your individual access code. 
                  No account required - just enter the code and start judging.
                </p>
                <Link 
                  to="/access-event"
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 inline-block w-full text-lg"
                >
                  Join Event Now
                </Link>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="bg-gray-50 rounded-2xl p-12">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-black mb-4">Why Choose JudgeMe?</h3>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Our platform provides everything you need to run professional judging events efficiently and securely.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-black mb-3">Real-time Scoring</h4>
                <p className="text-gray-600 leading-relaxed">
                  Live updates as judges submit their scores. Watch results come in instantly and track progress in real-time.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-black mb-3">Secure Access</h4>
                <p className="text-gray-600 leading-relaxed">
                  Protected events with individual judge access codes. Each judge gets their own unique code for secure access.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-black mb-3">Export Results</h4>
                <p className="text-gray-600 leading-relaxed">
                  Download scores and results in Excel format. Generate comprehensive reports for your events.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">JudgeMe</h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Professional event judging platform designed to streamline competitions, contests, and assessments.
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/access-event" className="text-gray-400 hover:text-white transition-colors">
                    Join Event
                  </Link>
                </li>
                <li>
                  <Link to="/auth" className="text-gray-400 hover:text-white transition-colors">
                    Create Account
                  </Link>
                </li>
                <li>
                  <Link to="/auth" className="text-gray-400 hover:text-white transition-colors">
                    Sign In
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Real-time Scoring</li>
                <li>Secure Access</li>
                <li>Export Results</li>
                <li>Mobile Friendly</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400">
              © 2024 JudgeMe. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage 