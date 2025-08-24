import React, { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { supabase, TABLES } from '../supabase'
import toast from 'react-hot-toast'

const JudgePanel = () => {
  const { eventId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { judgeId, judgeName, event, existingScores, completedCriteria: initialCompletedCriteria } = location.state || {}


  const [expandedCriteria, setExpandedCriteria] = useState(new Set())
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [pendingCriteriaId, setPendingCriteriaId] = useState(null)
  const [pendingCriteria, setPendingCriteria] = useState(null)
  
  // Initialize scores from existing scores if available
  const [scores, setScores] = useState(() => {
    if (existingScores) {
      const scoreMap = {}
      existingScores.forEach(score => {
        scoreMap[`${score.candidate_id}-${score.criteria_id}`] = score.score
      })
      return scoreMap
    }
    return {}
  })
  
  const [submitting, setSubmitting] = useState(false)
  const [eventData, setEventData] = useState(event)
  const [loading, setLoading] = useState(!event)
  const [hasSubmittedScores, setHasSubmittedScores] = useState(false)
  
  // Initialize completedCriteria from passed data
  const [completedCriteria, setCompletedCriteria] = useState(() => {
    if (initialCompletedCriteria) {
      return new Set(initialCompletedCriteria)
    }
    return new Set()
  })

  // Special Awards state
      const [specialAwards, setSpecialAwards] = useState([])
    const [specialAwardVotes, setSpecialAwardVotes] = useState({})
    const [submittingVotes, setSubmittingVotes] = useState({})
    const [expandedSpecialAwards, setExpandedSpecialAwards] = useState(new Set())

  // Debug special awards
  useEffect(() => {
    console.log('Special Awards State:', specialAwards)
    console.log('Special Award Votes State:', specialAwardVotes)
  }, [specialAwards, specialAwardVotes])

  useEffect(() => {
    if (!event) {
      fetchEventData()
    } else {
      // If event data is passed from props, we still need to fetch special awards
      fetchSpecialAwards()
      
      if (existingScores) {
      // If we have existing scores, check if all criteria are completed
      const allCriteriaCompleted = eventData.criteria.every(criteria =>
        completedCriteria.has(criteria.id)
      )
      setHasSubmittedScores(allCriteriaCompleted)
      }
    }
  }, [event, existingScores])

  const fetchEventData = async () => {
    try {
      console.log('Fetching event data for eventId:', eventId)
      
      // First, fetch the event data
      const { data: eventData, error: eventError } = await supabase
        .from(TABLES.EVENTS)
        .select('*')
        .eq('id', eventId)
        .single()

      if (eventError) {
        console.error('Event fetch error:', eventError)
        throw eventError
      }
      
      console.log('Event data fetched successfully:', eventData)

      // Fetch criteria for this event
      console.log('Fetching criteria for eventId:', eventId)
      const { data: criteriaData, error: criteriaError } = await supabase
        .from(TABLES.CRITERIA)
        .select('*')
        .eq('event_id', eventId)

      if (criteriaError) {
        console.error('Criteria fetch error:', criteriaError)
        throw criteriaError
      }
      
      console.log('Criteria data fetched successfully:', criteriaData)

      // Fetch candidates for this event
      console.log('Fetching candidates for eventId:', eventId)
      const { data: candidatesData, error: candidatesError } = await supabase
        .from(TABLES.CANDIDATES)
        .select('*')
        .eq('event_id', eventId)

      if (candidatesError) {
        console.error('Candidates fetch error:', candidatesError)
        throw candidatesError
      }
      
      console.log('Candidates data fetched successfully:', candidatesData)

      // Fetch judges for this event
      console.log('Fetching judges for eventId:', eventId)
      const { data: judgesData, error: judgesError } = await supabase
        .from(TABLES.JUDGES)
        .select('*')
        .eq('event_id', eventId)

      if (judgesError) {
        console.error('Judges fetch error:', judgesError)
        throw judgesError
      }
      
      console.log('Judges data fetched successfully:', judgesData)

      // Fetch scores for this event
      console.log('Fetching scores for eventId:', eventId)
      const { data: scoresData, error: scoresError } = await supabase
        .from(TABLES.SCORES)
        .select('*')
        .eq('event_id', eventId)

      if (scoresError) {
        console.error('Scores fetch error:', scoresError)
        throw scoresError
      }
      
      console.log('Scores data fetched successfully:', scoresData)

      // Fetch special awards for this event
      console.log('Fetching special awards for eventId:', eventId)
      console.log('Using TABLES.SPECIAL_AWARDS:', TABLES.SPECIAL_AWARDS)
      
      const { data: specialAwardsData, error: specialAwardsError } = await supabase
        .from(TABLES.SPECIAL_AWARDS)
        .select('*')
        .eq('event_id', eventId)
        .eq('award_type', 'vote')

      console.log('Special awards query result:', { data: specialAwardsData, error: specialAwardsError })

      if (specialAwardsError) {
        console.error('Special awards fetch error:', specialAwardsError)
        // Don't throw error, just log it as special awards are optional
      } else {
        console.log('Special awards data fetched successfully:', specialAwardsData)
        console.log('Setting special awards state to:', specialAwardsData || [])
        setSpecialAwards(specialAwardsData || [])
      }

      // Fetch existing special award votes by this judge
      if (specialAwardsData && specialAwardsData.length > 0) {
        console.log('Fetching special award votes for judgeId:', judgeId)
        const { data: votesData, error: votesError } = await supabase
          .from(TABLES.SPECIAL_AWARD_VOTES)
          .select('*')
          .eq('judge_id', judgeId)
          .in('special_award_id', specialAwardsData.map(award => award.id))

        if (votesError) {
          console.error('Special award votes fetch error:', votesError)
        } else {
          console.log('Special award votes fetched successfully:', votesData)
          // Convert votes to a map for easy lookup
          const votesMap = {}
          votesData.forEach(vote => {
            votesMap[vote.special_award_id] = vote.candidate_id
          })
          setSpecialAwardVotes(votesMap)
        }
      }

      // Combine all data
      const data = {
        ...eventData,
        criteria: criteriaData || [],
        candidates: candidatesData || [],
        judges: judgesData || [],
        scores: scoresData || []
      }
      
      console.log('Combined data:', data)
      console.log('Looking for judgeId:', judgeId)

      // Get all scores by this judge
      const judgeScores = data.scores.filter(score => score.judge_id === judgeId)
      console.log('Judge scores found:', judgeScores)
      
      if (judgeScores.length > 0) {
        // Group scores by criteria
        const scoresByCriteria = {}
        judgeScores.forEach(score => {
          if (!scoresByCriteria[score.criteria_id]) {
            scoresByCriteria[score.criteria_id] = []
          }
          scoresByCriteria[score.criteria_id].push(score)
        })

        // Convert to our score format and track completed criteria
        const existingScores = {}
        const completedCriteria = new Set()

        // Check each criteria
        data.criteria.forEach(criteria => {
          const criteriaScores = scoresByCriteria[criteria.id] || []
          
          // Always load existing scores for this criteria, even if incomplete
          criteriaScores.forEach(score => {
            existingScores[`${score.candidate_id}-${score.criteria_id}`] = score.score
          })
          
          // A criteria is complete if we have scores for all candidates
          const hasAllCandidatesScored = data.candidates.every(candidate =>
            criteriaScores.some(score => score.candidate_id === candidate.id)
          )

          if (hasAllCandidatesScored) {
            completedCriteria.add(criteria.id)
          }
        })

        console.log('Final existing scores loaded:', existingScores)
        console.log('Completed criteria detected:', Array.from(completedCriteria))

        setScores(existingScores)
        setCompletedCriteria(completedCriteria)

        // If all criteria are completed, set hasSubmittedScores to true
        if (completedCriteria.size === data.criteria.length) {
          setHasSubmittedScores(true)
        }
      }

      setEventData(data)
    } catch (error) {
      console.error('Error fetching event:', error)
      toast.error('Failed to load event data')
      navigate('/access-event')
    } finally {
      setLoading(false)
    }
  }

  const handleScoreChange = (scoreKey, score) => {
    // Find the criteria for this score
    const criteriaId = scoreKey.split('-')[1]
    const criteria = eventData.criteria.find(c => c.id === criteriaId)
    const maxScore = criteria ? criteria.percentage : 100
    
    setScores(prev => ({
      ...prev,
      [scoreKey]: Math.min(Math.max(parseInt(score) || 0, 0), maxScore)
    }))
  }

  const toggleCriteriaExpansion = (criteriaId) => {
    setExpandedCriteria(prev => {
      const newSet = new Set(prev)
      if (newSet.has(criteriaId)) {
        newSet.delete(criteriaId)
      } else {
        newSet.add(criteriaId)
      }
      return newSet
    })
  }

  const toggleSpecialAwardExpansion = (awardId) => {
    setExpandedSpecialAwards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(awardId)) {
        newSet.delete(awardId)
      } else {
        newSet.add(awardId)
      }
      return newSet
    })
  }

  const handleSubmitCriteriaScores = async (criteriaId) => {
    // Check if all candidates have scores for this criteria
    const criteria = eventData.criteria.find(c => c.id === criteriaId)
    const missingScores = eventData.candidates.filter(candidate => {
      const scoreKey = `${candidate.id}-${criteriaId}`
      return !scores[scoreKey] && scores[scoreKey] !== 0
    })

    if (missingScores.length > 0) {
      toast.error('Please provide scores for all candidates')
      return
    }

    // Show confirmation modal
    setPendingCriteriaId(criteriaId)
    setPendingCriteria(criteria)
    setShowConfirmationModal(true)
  }

  const confirmSubmitScores = async () => {
    if (!pendingCriteriaId || !pendingCriteria) return

    setSubmitting(true)
    setShowConfirmationModal(false)
    try {
      // Insert scores for all candidates for this criteria
      const scoreData = eventData.candidates.map(candidate => ({
        event_id: eventId,
        judge_id: judgeId,
        candidate_id: candidate.id,
        criteria_id: pendingCriteriaId,
        score: scores[`${candidate.id}-${pendingCriteriaId}`] || 0
      }))

      const { error } = await supabase
        .from(TABLES.SCORES)
        .insert(scoreData)

      if (error) throw error

      // Mark this criteria as completed
      const newCompletedCriteria = new Set(completedCriteria)
      newCompletedCriteria.add(pendingCriteriaId)
      setCompletedCriteria(newCompletedCriteria)

      // Update local scores state to reflect the submitted scores
      const newScores = { ...scores }
      eventData.candidates.forEach(candidate => {
        const scoreKey = `${candidate.id}-${pendingCriteriaId}`
        newScores[scoreKey] = scores[scoreKey] || 0
      })
      setScores(newScores)

      toast.success(`Scores submitted for ${pendingCriteria.name}!`)

      // Refresh data from database to ensure everything is in sync
      await fetchEventData()

      // Check if all criteria are now completed
      if (newCompletedCriteria.size === eventData.criteria.length) {
        setHasSubmittedScores(true)
        toast.success('All scores submitted successfully!')
        navigate('/access-event')
      }
    } catch (error) {
      console.error('Error submitting scores:', error)
      toast.error('Failed to submit scores')
    } finally {
      setSubmitting(false)
    }
  }

  // Special Award Functions
  const fetchSpecialAwards = async () => {
    try {
      console.log('Fetching special awards independently for eventId:', eventId)
      console.log('Using TABLES.SPECIAL_AWARDS:', TABLES.SPECIAL_AWARDS)
      
      const { data: specialAwardsData, error: specialAwardsError } = await supabase
        .from(TABLES.SPECIAL_AWARDS)
        .select('*')
        .eq('event_id', eventId)
        .eq('award_type', 'vote')

      console.log('Independent special awards query result:', { data: specialAwardsData, error: specialAwardsError })

      if (specialAwardsError) {
        console.error('Independent special awards fetch error:', specialAwardsError)
      } else {
        console.log('Independent special awards data fetched successfully:', specialAwardsData)
        console.log('Setting special awards state to:', specialAwardsData || [])
        setSpecialAwards(specialAwardsData || [])
      }

      // Fetch existing votes if we have awards
      if (specialAwardsData && specialAwardsData.length > 0) {
        console.log('Fetching existing votes for judgeId:', judgeId)
        const { data: votesData, error: votesError } = await supabase
          .from(TABLES.SPECIAL_AWARD_VOTES)
          .select('*')
          .eq('judge_id', judgeId)
          .in('special_award_id', specialAwardsData.map(award => award.id))

        if (votesError) {
          console.error('Independent votes fetch error:', votesError)
        } else {
          console.log('Independent votes fetched successfully:', votesData)
          const votesMap = {}
          votesData.forEach(vote => {
            votesMap[vote.special_award_id] = {
              candidate_id: vote.candidate_id,
              submitted: true // If vote exists in DB, it was submitted
            }
          })
          setSpecialAwardVotes(votesMap)
        }
      }
    } catch (error) {
      console.error('Error in fetchSpecialAwards:', error)
    }
  }

  // Special Award Voting Functions
  const handleSpecialAwardVote = (awardId, candidateId) => {
    setSpecialAwardVotes(prev => ({
      ...prev,
      [awardId]: {
        candidate_id: candidateId,
        submitted: false // New vote, not submitted yet
      }
    }))
  }

  const handleSubmitSpecialAwardVote = async (awardId) => {
    const voteData = specialAwardVotes[awardId]
    if (!voteData || !voteData.candidate_id) {
      toast.error('Please select a candidate first')
      return
    }

    setSubmittingVotes(prev => ({ ...prev, [awardId]: true }))
    try {
      // Delete existing vote for this award if it exists
      const { error: deleteError } = await supabase
        .from(TABLES.SPECIAL_AWARD_VOTES)
        .delete()
        .eq('judge_id', judgeId)
        .eq('special_award_id', awardId)

      if (deleteError) throw deleteError

      // Insert new vote
      const { error: insertError } = await supabase
        .from(TABLES.SPECIAL_AWARD_VOTES)
        .insert({
          special_award_id: awardId,
          judge_id: judgeId,
          candidate_id: voteData.candidate_id
        })

      if (insertError) throw insertError

      // Update local state to mark this award as submitted
      setSpecialAwardVotes(prev => ({
        ...prev,
        [awardId]: {
          ...prev[awardId],
          submitted: true
        }
      }))

      toast.success(`Vote for ${specialAwards.find(a => a.id === awardId)?.name} submitted successfully!`)
    } catch (error) {
      console.error('Error submitting special award vote:', error)
      toast.error('Failed to submit vote')
    } finally {
      setSubmittingVotes(prev => ({ ...prev, [awardId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event data...</p>
        </div>
      </div>
    )
  }

  if (!eventData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Event not found</p>
          <button 
            onClick={() => navigate('/access-event')}
            className="btn-primary"
          >
            Back to Access Event
          </button>
        </div>
      </div>
    )
  }

  if (!judgeId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Judge ID not found. Please access this page through the proper event access flow.</p>
          <button 
            onClick={() => navigate('/access-event')}
            className="btn-primary"
          >
            Back to Access Event
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Judge Panel</h1>
          <p className="text-gray-600">Welcome, {judgeName}</p>
          
          {eventData.logo_url && (
            <img 
              src={eventData.logo_url} 
              alt="Event Logo" 
              className="w-16 h-16 mx-auto mt-4 rounded-lg object-cover"
            />
          )}
          <h2 className="text-xl font-semibold text-black mt-2">{eventData.name}</h2>
        </div>

        {/* Submitted Scores Notice */}
        {hasSubmittedScores && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-green-800">Scores Already Submitted</h3>
                <p className="text-sm text-green-700">You can view your submitted scores but cannot modify them.</p>
              </div>
            </div>
          </div>
        )}

        {/* Criteria List */}
        <div className="space-y-4">
          {eventData.criteria.map((criteria) => {
            const isExpanded = expandedCriteria.has(criteria.id)
            const isCompleted = completedCriteria.has(criteria.id)
            const criteriaScores = eventData.candidates.map(candidate => {
              const scoreKey = `${candidate.id}-${criteria.id}`
              return scores[scoreKey] || 0
            })
            const hasAllScores = criteriaScores.every(score => score > 0 || score === 0)
            
            return (
              <div key={criteria.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {/* Criteria Header */}
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleCriteriaExpansion(criteria.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <svg 
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                        <h3 className="text-xl font-semibold text-black">{criteria.name}</h3>
                </div>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        {criteria.percentage}% weight
                      </span>
                      {isCompleted && (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          ✓ Completed
                        </span>
              )}
            </div>
            <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">
                        {criteriaScores.filter(score => score > 0 || score === 0).length}/{eventData.candidates.length} scored
              </span>
                      <svg 
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
            </div>
          </div>
        </div>

                {/* Expanded Candidates Section */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    <div className="p-6">
                      <p className="text-gray-600 mb-4">
                        Score each candidate for this criteria. Be fair and consistent in your evaluation.
                      </p>
                      
                      {/* Candidates List */}
                      <div className="space-y-4 mb-6">
                        {eventData.candidates.map((candidate) => {
                          const scoreKey = `${candidate.id}-${criteria.id}`
                          const currentScore = scores[scoreKey] || 0
                          
                          return (
            <div key={candidate.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    #{candidate.candidate_number}
                  </span>
                  <div>
                    <h4 className="font-semibold text-black">{candidate.name}</h4>
                    <p className="text-sm text-gray-600">{candidate.representation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                                  {isCompleted ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-green-600">
                                        {currentScore}
                      </span>
                      <span className="text-sm text-gray-600">
                                        /{criteria.percentage}
                      </span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="number"
                        min="0"
                                        max={criteria.percentage}
                                        value={currentScore}
                                        onChange={(e) => handleScoreChange(scoreKey, e.target.value)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                      />
                                      <span className="text-sm text-gray-600">/{criteria.percentage}</span>
                    </>
                  )}
                </div>
              </div>
                              
                              {!isCompleted && (
                <div className="pl-12">
                  <input
                    type="range"
                    min="0"
                                    max={criteria.percentage}
                                    value={currentScore}
                                    onChange={(e) => handleScoreChange(scoreKey, e.target.value)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}
            </div>
                          )
                        })}
                      </div>

                      {/* Submit Button for this Criteria */}
                      {!isCompleted && (
                        <div className="space-y-3">
                          {/* Warning Message */}
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div className="text-sm text-yellow-800">
                                <p className="font-medium">⚠️  Scores will be locked after submission!</p>
                                <p className="text-yellow-700">Make sure all scores are correct before submitting.</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Submit Button */}
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleSubmitCriteriaScores(criteria.id)}
                              disabled={submitting || !hasAllScores}
                              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {submitting ? 'Submitting...' : 'Submit Scores for ' + criteria.name}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>



        {/* Overall Progress */}
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-black">Overall Progress</h3>
            <span className="text-sm text-gray-600">
              {completedCriteria.size} of {eventData.criteria.length} criteria completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCriteria.size / eventData.criteria.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Special Awards Section */}
        {specialAwards.length > 0 ? (
          <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-black">Special Awards Voting</h3>
                <p className="text-sm text-gray-600">Vote for your preferred candidates in these special categories</p>
              </div>
            </div>

            <div className="space-y-4">
              {specialAwards.map((award) => (
                <div key={award.id} className="border border-gray-200 rounded-lg">
                  {/* Award Header - Clickable to expand */}
                  <div 
                    className={`p-4 cursor-pointer transition-colors ${
                      expandedSpecialAwards.has(award.id) 
                        ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleSpecialAwardExpansion(award.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-black mb-1">{award.name}</h4>
                        {award.description && (
                          <p className="text-sm text-gray-600">{award.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Vote Required
                          </span>
                          {specialAwardVotes[award.id]?.submitted && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Voted
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Expand/Collapse Icon */}
                      <div className="ml-4">
                        <svg 
                          className={`w-5 h-5 text-gray-500 transition-transform ${
                            expandedSpecialAwards.has(award.id) ? 'rotate-180' : ''
                          }`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Voting Content */}
                  {expandedSpecialAwards.has(award.id) && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      {/* Candidates for Voting */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select your preferred candidate:
                        </label>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                                  {eventData.candidates.map((candidate) => {
                          const isSelected = specialAwardVotes[award.id]?.candidate_id === candidate.id
                          return (
                              <div
                                key={candidate.id}
                                                            onClick={!specialAwardVotes[award.id]?.submitted ? () => handleSpecialAwardVote(award.id, candidate.id) : undefined}
                            className={`border-2 rounded-lg p-3 transition-all ${
                              specialAwardVotes[award.id]?.submitted
                                ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60'
                                : isSelected
                                  ? 'border-purple-500 bg-purple-50 cursor-pointer'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                            }`}
                              >
                                <div className="flex items-center gap-3">
                                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                specialAwardVotes[award.id]?.submitted
                                  ? 'border-gray-400 bg-gray-200'
                                  : isSelected
                                    ? 'border-purple-500 bg-purple-500'
                                    : 'border-gray-300'
                              }`}>
                                    {isSelected && (
                                      <div className="w-2 h-2 bg-white rounded-full"></div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                                        #{candidate.candidate_number}
                                      </span>
                                      <span className="font-medium text-black">{candidate.name}</span>
                                    </div>
                                    <p className="text-sm text-gray-600">{candidate.representation}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Current Vote Display */}
                      {specialAwardVotes[award.id] && (
                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-sm text-purple-800">
                            <span className="font-medium">Your vote:</span> {
                              eventData.candidates.find(c => c.id === specialAwardVotes[award.id]?.candidate_id)?.name
                            } (#{
                              eventData.candidates.find(c => c.id === specialAwardVotes[award.id]?.candidate_id)?.candidate_number
                            })
                          </p>
                        </div>
                      )}

                      {/* Individual Submit Button for this Award */}
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => handleSubmitSpecialAwardVote(award.id)}
                          disabled={!specialAwardVotes[award.id]?.candidate_id || submittingVotes[award.id] || specialAwardVotes[award.id]?.submitted}
                          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingVotes[award.id] ? 'Submitting...' : 
                           specialAwardVotes[award.id]?.submitted ? 'Vote Submitted' : 
                           'Submit Vote'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Special Awards Available</h4>
            <p className="text-gray-500">There are no special awards set up for voting in this event.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => navigate('/access-event')}
            className="btn-secondary"
          >
            Exit Event
          </button>

          {hasSubmittedScores && (
            <div className="flex items-center gap-2 text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">All scores submitted successfully!</span>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Score Submission</h3>
                  <p className="text-sm text-gray-600">Please review before proceeding</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">Submitting scores for:</h4>
                      <p className="text-blue-800 font-semibold">{pendingCriteria?.name}</p>
                      <p className="text-blue-700 text-sm">Maximum score: {pendingCriteria?.percentage} points</p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L13.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <h4 className="font-medium text-yellow-900 mb-1">Important Notice</h4>
                      <p className="text-yellow-800 text-sm">
                        Scores will be permanently locked after submission and cannot be edited. 
                        This affects {eventData?.candidates?.length || 0} candidates.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-gray-700 text-sm">
                        Please ensure all scores are accurate before confirming.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmationModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmitScores}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm Submission
                  </>
                  )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default JudgePanel 