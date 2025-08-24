import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, TABLES } from '../supabase'
import toast from 'react-hot-toast'

const CreateEvent = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  
  // Form data
  const [eventData, setEventData] = useState({
    name: '',
    logo: null,
    criteria: [{ name: '', percentage: 0 }],
    numJudges: 3,
    candidates: [{ name: '', representation: '', candidate_number: 1 }]
  })

  const generateJudgeAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setEventData(prev => ({ ...prev, logo: file }))
    }
  }

  const addCriteria = () => {
    setEventData(prev => ({
      ...prev,
      criteria: [...prev.criteria, { name: '', percentage: 0 }]
    }))
  }

  const removeCriteria = (index) => {
    setEventData(prev => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index)
    }))
  }

  const updateCriteria = (index, field, value) => {
    setEventData(prev => ({
      ...prev,
      criteria: prev.criteria.map((c, i) => 
        i === index ? { ...c, [field]: value } : c
      )
    }))
  }

  const addCandidate = () => {
    setEventData(prev => ({
      ...prev,
      candidates: [...prev.candidates, { 
        name: '', 
        representation: '', 
        candidate_number: prev.candidates.length + 1 
      }]
    }))
  }

  const removeCandidate = (index) => {
    setEventData(prev => {
      const newCandidates = prev.candidates.filter((_, i) => i !== index)
      // Renumber candidates after removal
      return {
        ...prev,
        candidates: newCandidates.map((candidate, i) => ({
          ...candidate,
          candidate_number: i + 1
        }))
      }
    })
  }

  const updateCandidate = (index, field, value) => {
    setEventData(prev => ({
      ...prev,
      candidates: prev.candidates.map((c, i) => 
        i === index ? { ...c, [field]: value } : c
      )
    }))
  }

  const validateStep = () => {
    switch (step) {
      case 1:
        return eventData.name.trim() !== ''
      case 2:
        return eventData.criteria.length > 0 && 
               eventData.criteria.every(c => c.name.trim() !== '' && c.percentage > 0) &&
               eventData.criteria.reduce((sum, c) => sum + c.percentage, 0) === 100
      case 3:
        const candidateNumbers = eventData.candidates.map(c => c.candidate_number)
        const uniqueNumbers = new Set(candidateNumbers)
        return eventData.candidates.length > 0 && 
               eventData.candidates.every(c => c.name.trim() !== '' && c.representation.trim() !== '' && c.candidate_number > 0) &&
               uniqueNumbers.size === candidateNumbers.length
      default:
        return true
    }
  }

  const handleSubmit = async () => {
    if (!validateStep()) {
      toast.error('Please fill in all required fields correctly')
      return
    }

    setLoading(true)
    try {
      // Upload logo if provided
      let logoUrl = null
      if (eventData.logo) {
        const fileExt = eventData.logo.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('event-logos')
          .upload(fileName, eventData.logo)
        
        if (uploadError) throw uploadError
        
        const { data: { publicUrl } } = supabase.storage
          .from('event-logos')
          .getPublicUrl(fileName)
        logoUrl = publicUrl
      }

      // Create event
      const { data: event, error: eventError } = await supabase
        .from(TABLES.EVENTS)
        .insert({
          name: eventData.name,
          logo_url: logoUrl,
          num_judges: eventData.numJudges,
          created_by: user.id,
          status: 'active'
        })
        .select()
        .single()

      if (eventError) throw eventError

      // Insert criteria
      const criteriaData = eventData.criteria.map(c => ({
        event_id: event.id,
        name: c.name,
        percentage: c.percentage
      }))
      
      const { error: criteriaError } = await supabase
        .from(TABLES.CRITERIA)
        .insert(criteriaData)

      if (criteriaError) throw criteriaError

      // Insert candidates
      const candidatesData = eventData.candidates.map(c => ({
        event_id: event.id,
        name: c.name,
        representation: c.representation,
        candidate_number: c.candidate_number
      }))

      const { error: candidatesError } = await supabase
        .from(TABLES.CANDIDATES)
        .insert(candidatesData)

      if (candidatesError) throw candidatesError

      // Create empty judge slots with access codes and fixed judge numbers
      const judgesData = []
      for (let i = 0; i < eventData.numJudges; i++) {
        judgesData.push({
          event_id: event.id,
          name: '', // Leave name empty until a judge claims this slot
          judge_access_code: generateJudgeAccessCode(),
          judge_number: i + 1, // Assign fixed judge number
          status: 'active'
        })
      }

      const { data: judges, error: judgesError } = await supabase
        .from(TABLES.JUDGES)
        .insert(judgesData)
        .select()

      if (judgesError) throw judgesError

      toast.success('Event created successfully!')
      navigate(`/admin/events/${event.id}`, { 
        state: { 
          judgeAccessCodes: judges.map(judge => ({ 
            judgeName: `Judge ${judge.judge_number}`, 
            accessCode: judge.judge_access_code 
          })),
          eventName: eventData.name 
        } 
      })

    } catch (error) {
      console.error('Error creating event:', error)
      toast.error('Failed to create event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const nextStep = () => {
    if (validateStep()) {
      setStep(step + 1)
    } else {
      if (step === 3) {
        const candidateNumbers = eventData.candidates.map(c => c.candidate_number)
        const uniqueNumbers = new Set(candidateNumbers)
        if (uniqueNumbers.size !== candidateNumbers.length) {
          toast.error('Candidate numbers must be unique')
        } else {
          toast.error('Please fill in all required fields correctly')
        }
      } else {
        toast.error('Please fill in all required fields correctly')
      }
    }
  }

  const prevStep = () => {
    setStep(step - 1)
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">Create New Event</h1>
          <p className="text-gray-600">Step {step} of 3</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= stepNum ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {stepNum}
                </div>
                {stepNum < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step > stepNum ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Basic Event Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Event Name *
              </label>
              <input
                type="text"
                value={eventData.name}
                onChange={(e) => setEventData(prev => ({ ...prev, name: e.target.value }))}
                className="input-field"
                placeholder="Enter event name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Event Logo (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="input-field"
              />
            </div>

                         <div>
               <label className="block text-sm font-medium text-black mb-2">
                 Number of Judges *
               </label>
               <input
                 type="number"
                 min="1"
                 max="50"
                 value={eventData.numJudges}
                 onChange={(e) => setEventData(prev => ({ ...prev, numJudges: parseInt(e.target.value) || 1 }))}
                 className="input-field"
                 placeholder="Enter number of judges"
               />
               <p className="text-sm text-gray-500 mt-1">
                 Enter any number between 1 and 50
               </p>
             </div>
          </div>
        )}

        {/* Step 2: Judging Criteria */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-black">Judging Criteria</h3>
              <button
                type="button"
                onClick={addCriteria}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                + Add Criteria
              </button>
            </div>

            {eventData.criteria.map((criterion, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-black mb-2">
                    Criteria Name *
                  </label>
                  <input
                    type="text"
                    value={criterion.name}
                    onChange={(e) => updateCriteria(index, 'name', e.target.value)}
                    className="input-field"
                    placeholder="e.g., Presentation Skills"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-black mb-2">
                    % *
                  </label>
                  <input
                    type="number"
                    value={criterion.percentage}
                    onChange={(e) => updateCriteria(index, 'percentage', parseInt(e.target.value) || 0)}
                    className="input-field"
                    min="0"
                    max="100"
                  />
                </div>
                {eventData.criteria.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCriteria(index)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            <div className="text-sm text-gray-600">
              Total: {eventData.criteria.reduce((sum, c) => sum + c.percentage, 0)}%
              {eventData.criteria.reduce((sum, c) => sum + c.percentage, 0) !== 100 && (
                <span className="text-red-600 ml-2">(Must equal 100%)</span>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Candidates */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-black">Candidates</h3>
              <button
                type="button"
                onClick={addCandidate}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                + Add Candidate
              </button>
            </div>

            {eventData.candidates.map((candidate, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="w-24">
                  <label className="block text-sm font-medium text-black mb-2">
                    Number *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={candidate.candidate_number}
                    onChange={(e) => updateCandidate(index, 'candidate_number', parseInt(e.target.value) || 1)}
                    className="input-field"
                    placeholder="#"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-black mb-2">
                    Candidate Name *
                  </label>
                  <input
                    type="text"
                    value={candidate.name}
                    onChange={(e) => updateCandidate(index, 'name', e.target.value)}
                    className="input-field"
                    placeholder="Enter candidate name"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-black mb-2">
                    Representation *
                  </label>
                  <input
                    type="text"
                    value={candidate.representation}
                    onChange={(e) => updateCandidate(index, 'representation', e.target.value)}
                    className="input-field"
                    placeholder="e.g., School, Company, etc."
                  />
                </div>
                {eventData.candidates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCandidate(index)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={prevStep}
            disabled={step === 1}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {step < 3 ? (
            <button
              onClick={nextStep}
              className="btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Creating Event...' : 'Create Event'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateEvent 