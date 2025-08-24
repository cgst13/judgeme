import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, TABLES } from '../supabase'
import toast from 'react-hot-toast'

const AccessEvent = () => {
  const navigate = useNavigate()
  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [event, setEvent] = useState(null)
  const [judgeName, setJudgeName] = useState('')
  const [selectedJudgeNumber, setSelectedJudgeNumber] = useState('')
  const [joining, setJoining] = useState(false)
  const [showAuthDropdown, setShowAuthDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const { user, signOut } = useAuth()

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

  const handleAccessCodeSubmit = async (e) => {
    e.preventDefault()
    if (!accessCode.trim()) {
      toast.error('Please enter an access code')
      return
    }

    setLoading(true)
    try {
      // First, find the judge and their scores by access code
      const { data: judgeData, error: judgeError } = await supabase
        .from(TABLES.JUDGES)
        .select(`
          *,
          events!inner (
            *,
            criteria (*),
            candidates (*),
            judges (*),
            scores!left (*)
          )
        `)
        .eq('judge_access_code', accessCode.toUpperCase())
        .eq('status', 'active')
        .single()

      if (judgeError || !judgeData) {
        toast.error('Invalid access code or judge not found')
        return
      }

      // Check if the event is active
      if (judgeData.events.status !== 'active') {
        toast.error('This event is not active')
        return
      }

      // Check if judge has submitted any scores
      const judgeScores = judgeData.events.scores.filter(score => score.judge_id === judgeData.id)
      
      // Group scores by criteria to check completion
      const scoresByCriteria = {}
      judgeScores.forEach(score => {
        if (!scoresByCriteria[score.criteria_id]) {
          scoresByCriteria[score.criteria_id] = []
        }
        scoresByCriteria[score.criteria_id].push(score)
      })

      // Check which criteria are complete
      const completedCriteria = new Set()
      judgeData.events.criteria.forEach(criteria => {
        const criteriaScores = scoresByCriteria[criteria.id] || []
        const hasAllCandidatesScored = judgeData.events.candidates.every(candidate =>
          criteriaScores.some(score => score.candidate_id === candidate.id)
        )
        if (hasAllCandidatesScored) {
          completedCriteria.add(criteria.id)
        }
      })

      // If judge already has a name assigned, redirect them directly to scoring
      if (judgeData.name && judgeData.name.trim() !== '') {
        toast.success('Welcome back! Redirecting to scoring...')
        navigate(`/judge/${judgeData.events.id}`, { 
          state: { 
            judgeId: judgeData.id,
            judgeName: judgeData.name,
            event: judgeData.events,
            existingScores: judgeScores,
            completedCriteria: Array.from(completedCriteria)
          } 
        })
        return
      }

      // If judge has no name yet, show the join form
      setEvent(judgeData.events)
    } catch (error) {
      console.error('Error fetching event:', error)
      toast.error('Failed to access event')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinEvent = async () => {
    if (!judgeName.trim()) {
      toast.error('Please enter your name')
      return
    }

    setJoining(true)
    try {
      // Check if name is already used by another judge
      const nameExists = event.judges.some(judge => 
        judge.name && judge.name.trim() === judgeName.trim()
      )

      if (nameExists) {
        toast.error('A judge with this name already exists')
        return
      }

      // Find the judge record that matches the access code
      const { data: judgeData, error: judgeError } = await supabase
        .from(TABLES.JUDGES)
        .select('*')
        .eq('judge_access_code', accessCode.toUpperCase())
        .eq('event_id', event.id)
        .single()

      if (judgeError || !judgeData) {
        toast.error('Invalid access code')
        return
      }

      // First update the judge's basic information
      const { data: updatedJudge, error: updateError } = await supabase
        .from(TABLES.JUDGES)
        .update({ 
          name: judgeName.trim()
        })
        .eq('id', judgeData.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating judge:', updateError)
        toast.error('Failed to join event')
        return
      }

      // Then get the complete event data with all relationships
      const { data: updatedEvent, error: eventError } = await supabase
        .from(TABLES.EVENTS)
        .select(`
          *,
          criteria (
            id,
            name,
            percentage,
            event_id
          ),
          candidates (
            id,
            name,
            representation,
            candidate_number,
            event_id
          ),
          judges (
            id,
            name,
            judge_number,
            judge_access_code,
            event_id,
            status
          )
        `)
        .eq('id', event.id)
        .single()

      if (eventError) {
        console.error('Error fetching updated event:', eventError)
        toast.error('Failed to load updated event data')
        return
      }

      toast.success('Successfully joined the event!')
      navigate(`/judge/${event.id}`, { 
        state: { 
          judgeId: updatedJudge.id,
          judgeName: updatedJudge.name,
          event: updatedEvent // Pass the freshly fetched event data
        } 
      })
    } catch (error) {
      console.error('Error joining event:', error)
      toast.error('Failed to join event')
    } finally {
      setJoining(false)
    }
  }

  const resetForm = () => {
    setAccessCode('')
    setEvent(null)
    setJudgeName('')
    setSelectedJudgeNumber('')
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
      <main className="flex-1 py-8 px-4">
        <div className="max-w-md mx-auto">
                     {/* Page Header */}
           <div className="text-center mb-8">
             <h1 className="text-3xl font-bold text-black mb-2">Access Event</h1>
             <p className="text-gray-600">Enter your judge access code to join the event</p>
           </div>

        {!event ? (
          /* Access Code Form */
          <form onSubmit={handleAccessCodeSubmit} className="space-y-6">
                         <div>
               <label htmlFor="accessCode" className="block text-sm font-medium text-black mb-2">
                 Judge Access Code *
               </label>
               <input
                 id="accessCode"
                 type="text"
                 value={accessCode}
                 onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                 className="input-field text-center text-lg font-mono tracking-wider"
                 placeholder="ABC12345"
                 maxLength="8"
                 required
               />
             </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
                             {loading ? 'Checking Code...' : 'Join Event'}
            </button>

            <div className="text-center">
              <Link
                to="/"
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                ← Back to Home
              </Link>
            </div>
          </form>
        ) : (
          /* Event Details and Join Form */
          <div className="space-y-6">
            {/* Event Info */}
            <div className="text-center">
              {event.logo_url && (
                <img 
                  src={event.logo_url} 
                  alt="Event Logo" 
                  className="w-24 h-24 mx-auto mb-4 rounded-lg object-cover"
                />
              )}
              <h2 className="text-2xl font-bold text-black mb-2">{event.name}</h2>
              
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="font-semibold text-green-700">{event.candidates.length}</div>
                  <div className="text-green-600">Candidates</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="font-semibold text-blue-700">{event.judges.filter(j => j.name && j.name.trim() !== '').length}/{event.num_judges}</div>
                  <div className="text-blue-600">Judges</div>
                </div>
              </div>
            </div>

            {/* Join Form */}
            {event.judges.filter(j => j.name && j.name.trim() !== '').length < event.num_judges ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-black">Join as Judge</h3>
                
                <div>
                  <label htmlFor="judgeName" className="block text-sm font-medium text-black mb-2">
                    Your Name *
                  </label>
                  <input
                    id="judgeName"
                    type="text"
                    value={judgeName}
                    onChange={(e) => setJudgeName(e.target.value)}
                    className="input-field"
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <button
                  onClick={handleJoinEvent}
                  disabled={joining || !judgeName.trim()}
                  className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joining ? 'Joining...' : 'Join Event'}
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-red-600 font-semibold mb-2">Event is Full</div>
                <p className="text-gray-600 text-sm">This event has reached the maximum number of judges.</p>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={resetForm}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                ← Try Different Code
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  </div>
  )
}

export default AccessEvent 