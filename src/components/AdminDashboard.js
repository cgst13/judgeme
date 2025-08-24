import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, TABLES } from '../supabase'
import toast from 'react-hot-toast'

const AdminDashboard = () => {
  const { user, signOut } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLES.EVENTS)
        .select(`
          *,
          candidates (count),
          judges (count),
          scores (count)
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
      toast.error('Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
    } catch (error) {
      toast.error('Failed to sign out')
    }
  }

  const getEventStatus = (event) => {
    if (event.status === 'completed') return 'Completed'
    if (event.judges_count >= event.num_judges) return 'Full'
    return 'Active'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800'
      case 'Full': return 'bg-yellow-100 text-yellow-800'
      case 'Active': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-green-500 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-green-100 mt-1">Manage your judging events</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-green-100">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="bg-white text-green-600 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Create New Event Button */}
        <div className="mb-8">
          <Link
            to="/create-event"
            className="btn-primary inline-flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create New Event
          </Link>
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-black mb-2">No Events Yet</h3>
            <p className="text-gray-600 mb-6">Create your first judging event to get started</p>
            <Link to="/create-event" className="btn-primary">
              Create Your First Event
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const status = getEventStatus(event)
              return (
                <div key={event.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  {/* Event Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-black mb-1">{event.name}</h3>
                      <p className="text-sm text-gray-600">
                        Created {new Date(event.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                      {status}
                    </span>
                  </div>

                  {/* Event Logo */}
                  {event.logo_url && (
                    <img 
                      src={event.logo_url} 
                      alt="Event Logo" 
                      className="w-16 h-16 rounded-lg object-cover mb-4"
                    />
                  )}

                  {/* Event Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-green-600">{event.candidates_count}</div>
                      <div className="text-xs text-gray-600">Candidates</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-blue-600">{event.judges_count}/{event.num_judges}</div>
                      <div className="text-xs text-gray-600">Judges</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-purple-600">{event.scores_count}</div>
                      <div className="text-xs text-gray-600">Scores</div>
                    </div>
                  </div>

                  {/* Access Code */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="text-xs text-gray-600 mb-1">Access Code</div>
                    <div className="font-mono text-lg font-semibold text-black tracking-wider">
                      {event.access_code}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Link
                      to={`/admin/events/${event.id}`}
                      className="btn-primary flex-1 text-center py-2"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(event.access_code)
                        toast.success('Access code copied to clipboard!')
                      }}
                      className="btn-secondary px-3 py-2"
                      title="Copy access code"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminDashboard 