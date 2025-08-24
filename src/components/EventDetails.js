import React, { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { supabase, TABLES } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const EventDetails = () => {
  const { eventId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { judgeAccessCodes, eventName } = location.state || {}

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [editingJudge, setEditingJudge] = useState(null)
  const [editJudgeName, setEditJudgeName] = useState('')
  // Removed reset judge states
  
  // Special Awards states
  const [specialAwards, setSpecialAwards] = useState([])
  const [showAddAwardModal, setShowAddAwardModal] = useState(false)
  const [newAward, setNewAward] = useState({
    name: '',
    description: '',
    award_type: 'assigned',
    assigned_candidate_id: ''
  })
  const [editingAward, setEditingAward] = useState(null)
  const [showEditAwardModal, setShowEditAwardModal] = useState(false)

  useEffect(() => {
    fetchEventData()
    // Set up real-time subscription
    const subscription = supabase
      .channel('event-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: TABLES.SCORES },
        () => fetchEventData()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: TABLES.JUDGES },
        () => fetchEventData()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: TABLES.SPECIAL_AWARD_VOTES },
        () => fetchEventData()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: TABLES.SPECIAL_AWARDS },
        () => fetchEventData()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [eventId])

  // Show success message with judge access codes if event was just created
  useEffect(() => {
    if (judgeAccessCodes && judgeAccessCodes.length > 0) {
      toast.success(
        <div>
          <div className="font-semibold mb-2">Event created successfully!</div>
          <div className="text-sm">
            {judgeAccessCodes.length} judge access codes generated. 
            Check the "Judges" tab to view all codes.
          </div>
        </div>,
        { duration: 6000 }
      )
    }
  }, [judgeAccessCodes])

  // Focus password input when delete modal opens
  useEffect(() => {
    if (showDeleteModal) {
      const passwordInput = document.querySelector('input[type="password"]')
      if (passwordInput) {
        setTimeout(() => passwordInput.focus(), 100)
      }
    }
  }, [showDeleteModal])

  const fetchEventData = async () => {
    try {
      // First, fetch the event and its basic relationships
      const { data: eventData, error: eventError } = await supabase
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
          )
        `)
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError

      // Then fetch all judges for this event
      const { data: judgesData, error: judgesError } = await supabase
        .from(TABLES.JUDGES)
        .select('*')
        .eq('event_id', eventId)
        .order('judge_number', { ascending: true })

      if (judgesError) throw judgesError

      // Finally fetch scores with their relationships
      const { data: scoresData, error: scoresError } = await supabase
        .from(TABLES.SCORES)
        .select(`
          id,
          score,
          judge_id,
          criteria_id,
          candidate_id,
          criteria (
            id,
            name,
            percentage
          ),
          judges (
            id,
            name,
            judge_number
          ),
          candidates (
            id,
            name,
            representation,
            candidate_number
          )
        `)
        .eq('event_id', eventId)

      if (scoresError) throw scoresError

      // Combine all data
      const completeEventData = {
        ...eventData,
        judges: judgesData || [],
        scores: scoresData || []
      }

      setEvent(completeEventData)
      
      // Fetch special awards for this event
      await fetchSpecialAwards()
    } catch (error) {
      console.error('Error fetching event:', error)
      toast.error('Failed to load event data')
      navigate('/admin')
    } finally {
      setLoading(false)
    }
  }

  const calculateCandidateScores = () => {
    if (!event) return []

    const candidateScores = {}

    event.scores.forEach(score => {
      const candidateId = score.candidate_id
      const criteriaId = score.criteria_id
      const judgeId = score.judge_id

      if (!candidateScores[candidateId]) {
        candidateScores[candidateId] = {
          candidate: event.candidates.find(c => c.id === candidateId),
          scores: {},
          totalScore: 0,
          averageScore: 0,
          judgeCount: 0
        }
      }

      if (!candidateScores[candidateId].scores[criteriaId]) {
        candidateScores[candidateId].scores[criteriaId] = []
      }

      candidateScores[candidateId].scores[criteriaId].push({
        score: score.score,
        judge: score.judges.name,
        criteria: score.criteria
      })
    })

    // Calculate totals and averages
    Object.values(candidateScores).forEach(candidate => {
      let totalWeightedScore = 0
      let totalWeight = 0
      const judgeIds = new Set()

      event.criteria.forEach(criteria => {
        const criteriaScores = candidate.scores[criteria.id] || []
        if (criteriaScores.length > 0) {
          const averageScore = criteriaScores.reduce((sum, s) => sum + s.score, 0) / criteriaScores.length
          totalWeightedScore += averageScore * criteria.percentage / 100
          totalWeight += criteria.percentage
          criteriaScores.forEach(s => judgeIds.add(s.judge))
        }
      })

      candidate.totalScore = totalWeightedScore
      candidate.averageScore = totalWeight > 0 ? totalWeightedScore : 0
      candidate.judgeCount = judgeIds.size
    })

    return Object.values(candidateScores).sort((a, b) => b.averageScore - a.averageScore)
  }

  const exportToExcel = () => {
    const candidateScores = calculateCandidateScores()
    
    // Prepare data for export
    const exportData = candidateScores.map((candidate, index) => {
      const row = {
        'Rank': index + 1,
        'Candidate Number': candidate.candidate.candidate_number,
        'Candidate Name': candidate.candidate.name,
        'Representation': candidate.candidate.representation,
        'Average Score': candidate.averageScore.toFixed(2),
        'Total Score': candidate.totalScore.toFixed(2),
        'Judges Count': candidate.judgeCount
      }

      // Add individual criteria scores
      event.criteria.forEach(criteria => {
        const criteriaScores = candidate.scores[criteria.id] || []
        if (criteriaScores.length > 0) {
          const averageScore = criteriaScores.reduce((sum, s) => sum + s.score, 0) / criteriaScores.length
          row[criteria.name] = averageScore.toFixed(2)
        } else {
          row[criteria.name] = 'N/A'
        }
      })

      return row
    })

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Results')

    // Save file
    XLSX.writeFile(wb, `${event.name}_Results.xlsx`)
    toast.success('Results exported successfully!')
  }

  // Special Awards Functions
  const fetchSpecialAwards = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLES.SPECIAL_AWARDS)
        .select(`
          *,
          assigned_candidate:candidates(name, candidate_number, representation)
        `)
        .eq('event_id', eventId)

      if (error) throw error
      setSpecialAwards(data || [])

      // Also fetch special award votes for this event
      // We need to get votes through the special_awards table since votes don't have event_id directly
      const { data: votesData, error: votesError } = await supabase
        .from(TABLES.SPECIAL_AWARD_VOTES)
        .select(`
          *,
          special_awards!inner(event_id),
          judges(name, judge_number),
          candidates(name, candidate_number, representation)
        `)
        .eq('special_awards.event_id', eventId)

      if (votesError) {
        console.error('Error fetching special award votes:', votesError)
      } else {
        // Update the event state to include special award votes
        setEvent(prev => prev ? { ...prev, special_award_votes: votesData || [] } : null)
      }
    } catch (error) {
      console.error('Error fetching special awards:', error)
      toast.error('Failed to load special awards')
    }
  }

  const handleAddAward = async () => {
    try {
      const { error } = await supabase
        .from(TABLES.SPECIAL_AWARDS)
        .insert({
          event_id: eventId,
          name: newAward.name,
          description: newAward.description,
          award_type: newAward.award_type,
          assigned_candidate_id: newAward.award_type === 'assigned' ? newAward.assigned_candidate_id : null
        })

      if (error) throw error

      toast.success('Special award created successfully!')
      setShowAddAwardModal(false)
      setNewAward({
        name: '',
        description: '',
        award_type: 'admin_assigned',
        assigned_candidate_id: ''
      })
      await fetchSpecialAwards()
    } catch (error) {
      console.error('Error creating special award:', error)
      toast.error('Failed to create special award')
    }
  }

  const handleEditAward = async () => {
    try {
      const { error } = await supabase
        .from(TABLES.SPECIAL_AWARDS)
        .update({
          name: editingAward.name,
          description: editingAward.description,
          award_type: editingAward.award_type,
          assigned_candidate_id: editingAward.award_type === 'assigned' ? editingAward.assigned_candidate_id : null
        })
        .eq('id', editingAward.id)

      if (error) throw error

      toast.success('Special award updated successfully!')
      setShowEditAwardModal(false)
      setEditingAward(null)
      await fetchSpecialAwards()
    } catch (error) {
      console.error('Error updating special award:', error)
      toast.error('Failed to update special award')
    }
  }

  const handleDeleteAward = async (awardId) => {
    if (!window.confirm('Are you sure you want to delete this special award?')) return

    try {
      const { error } = await supabase
        .from(TABLES.SPECIAL_AWARDS)
        .delete()
        .eq('id', awardId)

      if (error) throw error

      toast.success('Special award deleted successfully!')
      await fetchSpecialAwards()
    } catch (error) {
      console.error('Error deleting special award:', error)
      toast.error('Failed to delete special award')
    }
  }

  const handleAssignAward = async (awardId, candidateId) => {
    try {
      const { error } = await supabase
        .from(TABLES.SPECIAL_AWARDS)
        .update({ assigned_candidate_id: candidateId })
        .eq('id', awardId)

      if (error) throw error

      toast.success('Award assigned successfully!')
      await fetchSpecialAwards()
    } catch (error) {
      console.error('Error assigning award:', error)
      toast.error('Failed to assign award')
    }
  }

  const handlePrintRankings = () => {
    const candidateScores = calculateCandidateScores()
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    
    // Generate the print content with styling
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Overall Rankings - ${event.name}</title>
          <style>
            @page {
              size: letter landscape;
              margin: 0;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0.5in;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              margin-bottom: 15px;
              text-align: center;
            }
            .logo img {
              max-width: 80px;
              max-height: 80px;
              object-fit: contain;
              border-radius: 6px;
            }
            .event-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .title {
              font-size: 18px;
              color: #666;
              margin-bottom: 30px;
            }
            .rankings-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
            }
            .rankings-table th,
            .rankings-table td {
              padding: 8px;
              border: 1px solid #ddd;
              text-align: left;
            }
            .rankings-table th {
              background-color: #f8f8f8;
              font-weight: bold;
            }
            .average-score {
              font-weight: bold;
              color: #2563eb;
            }
            .rank {
              font-weight: bold;
            }
            @media print {
              .rankings-table th {
                background-color: #f8f8f8 !important;
                -webkit-print-color-adjust: exact;
              }
              .average-score {
                color: #2563eb !important;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${event.logo_url ? `
            <div class="logo">
              <img src="${event.logo_url}" alt="${event.name} Logo" />
            </div>` : ''}
            <div class="event-name">${event.name}</div>
            <div class="title">Overall Candidate Rankings</div>
          </div>

          <table class="rankings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Representation</th>
                ${event.criteria.map(criteria => `
                  <th>${criteria.name}<br/>(${criteria.percentage}%)</th>
                `).join('')}
                <th>Average</th>
                <th>Judges</th>
              </tr>
            </thead>
            <tbody>
              ${candidateScores.map((candidate, index) => `
                <tr>
                  <td class="rank">#${index + 1}</td>
                  <td>#${candidate.candidate.candidate_number} - ${candidate.candidate.name}</td>
                  <td>${candidate.candidate.representation}</td>
                  ${event.criteria.map(criteria => {
                    const criteriaScores = candidate.scores[criteria.id] || []
                    const averageScore = criteriaScores.length > 0 
                      ? (criteriaScores.reduce((sum, s) => sum + s.score, 0) / criteriaScores.length).toFixed(1)
                      : 'N/A'
                    return `<td>${averageScore}</td>`
                  }).join('')}
                  <td class="average-score">${candidate.averageScore.toFixed(1)}</td>
                  <td>${candidate.judgeCount}/${event.num_judges}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `

    // Write the content to the new window and print
    printWindow.document.write(printContent)
    printWindow.document.close()
    
    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.print()
      // Close the window after printing (optional)
      printWindow.onafterprint = function() {
        printWindow.close()
      }
    }
  }

  const handlePrintCriteria = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    
    // Generate the print content with styling
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Judging Criteria - ${event.name}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 0;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0.5in;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              margin-bottom: 15px;
              text-align: center;
            }
            .logo img {
              max-width: 80px;
              max-height: 80px;
              object-fit: contain;
              border-radius: 6px;
            }
            .event-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .title {
              font-size: 18px;
              color: #666;
              margin-bottom: 30px;
            }
            .criteria-list {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .criteria-list th,
            .criteria-list td {
              padding: 12px;
              border: 1px solid #ddd;
              text-align: left;
            }
            .criteria-list th {
              background-color: #f8f8f8;
              font-weight: bold;
            }
            .percentage {
              text-align: right;
              font-weight: bold;
              color: #2563eb;
            }
            @media print {
              .criteria-list th {
                background-color: #f8f8f8 !important;
                -webkit-print-color-adjust: exact;
              }
              .percentage {
                color: #2563eb !important;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${event.logo_url ? `
            <div class="logo">
              <img src="${event.logo_url}" alt="${event.name} Logo" />
            </div>` : ''}
            <div class="event-name">${event.name}</div>
            <div class="title">Judging Criteria</div>
          </div>

          <table class="criteria-list">
            <thead>
              <tr>
                <th style="width: 10%;">No.</th>
                <th style="width: 65%;">Criteria</th>
                <th style="width: 25%;">Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${event.criteria.map((criteria, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${criteria.name}</td>
                  <td class="percentage">${criteria.percentage}%</td>
                </tr>
              `).join('')}
              <tr>
                <td colspan="2" style="text-align: right; font-weight: bold;">Total:</td>
                <td class="percentage">${event.criteria.reduce((sum, c) => sum + c.percentage, 0)}%</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `

    // Write the content to the new window and print
    printWindow.document.write(printContent)
    printWindow.document.close()
    
    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.print()
      // Close the window after printing (optional)
      printWindow.onafterprint = function() {
        printWindow.close()
      }
    }
  }

  const handlePrintJudge = (judge) => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    
    // Generate the print content with styling
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Judge Access Code - ${event.name}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 0;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              width: 8.5in;
              height: 11in;
              position: relative;
            }
            .page {
              width: 8.5in;
              height: 11in;
              position: relative;
              page-break-after: always;
            }
            .content {
              padding: 0.5in;
            }
            .card {
              border: 2px solid #000;
              padding: 20px;
              text-align: center;
              margin-bottom: 0.25in;
            }
            .logo {
              margin-bottom: 15px;
              text-align: center;
            }
            .logo img {
              max-width: 80px;
              max-height: 80px;
              object-fit: contain;
              border-radius: 6px;
            }
            .event-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .judge-number {
              font-size: 18px;
              margin-bottom: 5px;
            }
            .judge-name {
              font-size: 16px;
              color: #2563eb;
              margin-bottom: 15px;
            }
            .access-code {
              font-family: monospace;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 4px;
              margin: 20px 0;
              padding: 10px;
              background: #f0f0f0;
              border-radius: 5px;
            }
            .instructions {
              font-size: 14px;
              color: #666;
              margin-top: 20px;
              text-align: left;
            }
            .website {
              margin-top: 15px;
              font-size: 16px;
              color: #333;
            }
            .divider {
              width: 100%;
              position: relative;
              margin: 0.25in 0;
              text-align: center;
            }
            .divider::before {
              content: "";
              position: absolute;
              left: 0;
              top: 50%;
              width: 100%;
              border-top: 1px dashed #000;
            }
            .divider::after {
              content: "✂️ Cut here";
              position: absolute;
              left: 50%;
              top: 50%;
              transform: translate(-50%, -50%);
              background: white;
              padding: 0 10px;
              font-size: 12px;
              color: #666;
            }
            .duplicate-label {
              text-align: center;
              font-size: 12px;
              color: #666;
              margin-bottom: 10px;
              font-style: italic;
            }
            @media print {
              .card {
                border: 2px solid #000 !important;
                -webkit-print-color-adjust: exact;
              }
              .access-code {
                background: #f0f0f0 !important;
                -webkit-print-color-adjust: exact;
              }
              .divider::before {
                border-top: 1px dashed #000 !important;
                -webkit-print-color-adjust: exact;
              }
              .divider::after {
                background: white !important;
                -webkit-print-color-adjust: exact;
              }
              .logo img {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .judge-name {
                color: #2563eb !important;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="content">
              <!-- Top half is blank -->
              <div style="height: 4.75in;"></div>

              <!-- Divider -->
              <div class="divider"></div>

              <!-- Bottom Card -->
              <div class="card" style="margin-top: 0.25in;">
                ${event.logo_url ? `
                <div class="logo">
                  <img src="${event.logo_url}" alt="${event.name} Logo" />
                </div>` : ''}
                <div class="event-name">${event.name}</div>
                <div class="judge-number">Judge ${judge.judge_number}</div>
                ${judge.name ? `<div class="judge-name">Assigned to: <strong>${judge.name}</strong></div>` : ''}
                <div class="access-code">${judge.judge_access_code}</div>
                <div class="instructions">
                  <p><strong>Instructions:</strong></p>
                  <ol>
                    <li>Visit the website below</li>
                    <li>Click on "Join Event"</li>
                    <li>Enter your access code exactly as shown above</li>
                    <li>Enter your name when prompted</li>
                  </ol>
                </div>
                <div class="website">
                  <strong>Website:</strong> judgeme.example.com
                </div>
                
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    // Write the content to the new window and print
    printWindow.document.write(printContent)
    printWindow.document.close()
    
    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.print()
      // Close the window after printing (optional)
      printWindow.onafterprint = function() {
        printWindow.close()
      }
    }
  }

  const handlePrintDetailedScoring = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    
    // Generate the print content with styling
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Detailed Scoring Progress - ${event.name}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 0.5in;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .event-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .event-date {
              font-size: 14px;
              color: #666;
            }
            .criteria-section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            .criteria-header {
              background: #f3f4f6;
              padding: 10px;
              border: 1px solid #d1d5db;
              border-radius: 5px;
              margin-bottom: 15px;
            }
            .criteria-name {
              font-size: 18px;
              font-weight: bold;
              color: #000;
            }
            .max-score {
              font-size: 14px;
              color: #666;
              margin-top: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 8px;
              text-align: center;
            }
            th {
              background: #f9fafb;
              font-weight: bold;
              color: #000;
            }
            .judge-name {
              text-align: left;
              font-weight: 500;
            }
            .score {
              font-weight: 500;
            }
            .score-complete {
              color: #059669;
            }
            .score-pending {
              color: #dc2626;
            }
            .average-score {
              font-weight: bold;
              color: #2563eb;
            }
            .status-complete {
              background: #dcfce7;
              color: #166534;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 11px;
            }
            .status-pending {
              background: #fef3c7;
              color: #92400e;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 11px;
            }
            .summary {
              margin-top: 20px;
              padding: 15px;
              background: #f9fafb;
              border: 1px solid #d1d5db;
              border-radius: 5px;
            }
            .summary-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .summary-stats {
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
            }
            .summary-stat {
              margin: 5px 0;
            }
            @media print {
              .criteria-section {
                page-break-inside: avoid;
              }
              th, td {
                border: 1px solid #000 !important;
                -webkit-print-color-adjust: exact;
              }
              .status-complete, .status-pending {
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="event-name">${event.name}</div>
            <div class="event-date">Detailed Scoring Progress Report</div>
            <div class="event-date">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
          </div>

          ${event.criteria.map(criteria => {
            const criteriaScores = event.scores.filter(s => s.criteria_id === criteria.id)
            
            return `
              <div class="criteria-section">
                <div class="criteria-header">
                  <div class="criteria-name">${criteria.name}</div>
                  <div class="max-score">Maximum Score: ${criteria.percentage} points</div>
                </div>
                
                <table>
                  <thead>
                    <tr>
                      <th class="judge-name">Judge</th>
                      ${event.candidates.map(candidate => 
                        `<th>#${candidate.candidate_number}<br>${candidate.name}</th>`
                      ).join('')}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${event.judges.filter(j => j.name).map(judge => {
                      const judgeScores = criteriaScores.filter(s => s.judge_id === judge.id)
                      const allCandidatesScored = event.candidates.every(candidate => 
                        judgeScores.some(s => s.candidate_id === candidate.id)
                      )
                      
                      return `
                        <tr>
                          <td class="judge-name">Judge ${judge.judge_number} - ${judge.name}</td>
                          ${event.candidates.map(candidate => {
                            const score = judgeScores.find(s => s.candidate_id === candidate.id)
                            return score ? 
                              '<td class="score score-complete">' + score.score + '</td>' : 
                              '<td class="score score-pending">—</td>'
                          }).join('')}
                          <td>
                            <span class="${allCandidatesScored ? 'status-complete' : 'status-pending'}">
                              ${allCandidatesScored ? 'Complete' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      `
                    }).join('')}
                  </tbody>
                </table>
                
              </div>
            `
          }).join('')}
        </body>
      </html>
    `

    // Write the content to the new window and print
    printWindow.document.write(printContent)
    printWindow.document.close()
    
    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.print()
      // Close the window after printing (optional)
      printWindow.onafterprint = function() {
        printWindow.close()
      }
    }
  }

  const handlePrintSpecialAwardsResults = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank')
    
    // Generate the print content with styling
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Special Awards Voting Results - ${event.name}</title>
          <style>
            @page {
              size: letter portrait;
              margin: 0.5in;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .event-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .event-date {
              font-size: 14px;
              color: #666;
            }
            .award-section {
              margin-bottom: 40px;
              page-break-inside: avoid;
            }
            .award-header {
              background: #f3f4f6;
              padding: 15px;
              border: 1px solid #d1d5db;
              border-radius: 5px;
              margin-bottom: 20px;
            }
            .award-name {
              font-size: 20px;
              font-weight: bold;
              color: #000;
              margin-bottom: 5px;
            }
            .award-description {
              font-size: 14px;
              color: #666;
              margin-bottom: 10px;
            }
            .award-stats {
              font-size: 14px;
              color: #666;
            }
            .winner-section {
              background: #dcfce7;
              border: 1px solid #16a34a;
              border-radius: 5px;
              padding: 15px;
              margin-bottom: 20px;
            }
            .winner-title {
              font-size: 16px;
              font-weight: bold;
              color: #166534;
              margin-bottom: 10px;
            }
            .winner-candidate {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 5px;
            }
            .candidate-number {
              background: #16a34a;
              color: white;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: bold;
            }
            .candidate-name {
              font-weight: 500;
              color: #166534;
            }
            .candidate-representation {
              font-size: 12px;
              color: #16a34a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #d1d5db;
              padding: 10px;
              text-align: center;
            }
            th {
              background: #f9fafb;
              font-weight: bold;
              color: #000;
            }
            .rank {
              text-align: center;
              font-weight: 500;
            }
            .candidate-info {
              text-align: left;
            }
            .votes {
              font-weight: 500;
              color: #2563eb;
            }
            .percentage {
              font-weight: 500;
              color: #059669;
            }
            .winner-row {
              background: #dcfce7;
            }
            .trophy {
              font-size: 16px;
              margin-left: 5px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="event-name">${event.name}</div>
            <div class="event-date">Special Awards Voting Results</div>
          </div>

          ${specialAwards
            .filter(award => award.award_type === 'vote')
            .map(award => {
              const awardVotes = event.special_award_votes?.filter(vote => 
                vote.special_award_id === award.id
              ) || []
              
              const voteCounts = {}
              awardVotes.forEach(vote => {
                voteCounts[vote.candidate_id] = (voteCounts[vote.candidate_id] || 0) + 1
              })
              
              const sortedCandidates = event.candidates
                .map(candidate => ({
                  ...candidate,
                  voteCount: voteCounts[candidate.id] || 0
                }))
                .sort((a, b) => b.voteCount - a.voteCount)
              
              const maxVotes = sortedCandidates[0]?.voteCount || 0
              const winners = sortedCandidates.filter(c => c.voteCount === maxVotes && maxVotes > 0)
              
              return `
                <div class="award-section">
                  <div class="award-header">
                    <div class="award-name">${award.name}</div>
                    ${award.description ? `<div class="award-description">${award.description}</div>` : ''}
                    <div class="award-stats">${awardVotes.length} judge(s) voted</div>
                  </div>
                  
                  ${winners.length > 0 ? `
                    <div class="winner-section">
                      <div class="winner-title">
                        ${winners.length === 1 ? 'Winner' : 'Winners'} (${maxVotes} vote${maxVotes !== 1 ? 's' : ''})
                      </div>
                      ${winners.map(winner => `
                        <div class="winner-candidate">
                          <span class="candidate-number">#${winner.candidate_number}</span>
                          <span class="candidate-name">${winner.name}</span>
                          <span class="candidate-representation">${winner.representation}</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                  
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Candidate</th>
                        <th>Votes</th>
                        <th>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sortedCandidates.map((candidate, index) => {
                        const percentage = awardVotes.length > 0 
                          ? ((candidate.voteCount / awardVotes.length) * 100).toFixed(1)
                          : '0.0'
                        const isWinner = winners.some(w => w.id === candidate.id)
                        
                        return `
                          <tr class="${isWinner ? 'winner-row' : ''}">
                            <td class="rank">
                              #${index + 1}
                              ${isWinner ? '<span class="trophy">🏆</span>' : ''}
                            </td>
                            <td class="candidate-info">
                              #${candidate.candidate_number} - ${candidate.name}<br>
                              <span style="color: #666; font-size: 11px;">${candidate.representation}</span>
                            </td>
                            <td class="votes">${candidate.voteCount}</td>
                            <td class="percentage">${percentage}%</td>
                          </tr>
                        `
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `
            }).join('')}
        </body>
      </html>
    `

    // Write the content to the new window and print
    printWindow.document.write(printContent)
    printWindow.document.close()
    
    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.print()
      // Close the window after printing (optional)
      printWindow.onafterprint = function() {
        printWindow.close()
      }
    }
  }

  const handleEditJudge = async () => {
    if (!editingJudge || !editJudgeName.trim()) {
      toast.error('Please enter a name for the judge')
      return
    }

    try {
      const { error } = await supabase
        .from(TABLES.JUDGES)
        .update({ name: editJudgeName.trim() })
        .eq('id', editingJudge.id)

      if (error) throw error

      toast.success('Judge name updated successfully')
      setEditingJudge(null)
      setEditJudgeName('')
      await fetchEventData()
    } catch (error) {
      console.error('Error updating judge:', error)
      toast.error('Failed to update judge name')
    }
  }

  // Removed handleResetJudge function

  const handleDeleteEvent = async () => {
    if (!deletePassword.trim()) {
      toast.error('Please enter your password')
      return
    }

    if (!user) {
      toast.error('User not authenticated')
      return
    }

    setDeleting(true)
    try {
      // First, verify the user's password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword
      })

      if (signInError) {
        toast.error('Incorrect password')
        return
      }

      // Delete the event (this will cascade delete all related data due to ON DELETE CASCADE)
      const { error: deleteError } = await supabase
        .from(TABLES.EVENTS)
        .delete()
        .eq('id', eventId)

      if (deleteError) throw deleteError

      toast.success('Event deleted successfully')
      navigate('/admin')
    } catch (error) {
      console.error('Error deleting event:', error)
      toast.error('Failed to delete event. Please try again.')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
      setDeletePassword('')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event details...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Event not found</p>
          <button onClick={() => navigate('/admin')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const candidateScores = calculateCandidateScores()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-green-500 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={() => navigate('/admin')}
                className="text-green-100 hover:text-white mb-2 flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold">{event.name}</h1>
              <p className="text-green-100 mt-1">Event Details & Results</p>
            </div>
            <div className="text-right">
              <div className="text-green-100 mb-2">Judge Access Codes</div>
              <div className="text-sm text-green-100">
                {event.judges.length} codes available
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Event Info */}
        <div className="flex items-center mb-8">
          {event.logo_url && (
            <img 
              src={event.logo_url} 
              alt="Event Logo" 
              className="w-20 h-20 rounded-lg object-cover mr-6"
            />
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-black mb-2">{event.name}</h2>
            <div className="flex space-x-6 text-sm text-gray-600">
              <span>{event.candidates.length} Candidates</span>
              <span>{event.judges.length}/{event.num_judges} Judges</span>
              <span>{event.scores.length} Scores Submitted</span>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={exportToExcel}
              className="btn-primary"
            >
              Export Results
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="bg-white hover:bg-red-50 text-red-600 border border-red-300 hover:border-red-400 px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Delete Event
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex space-x-8">
            {['overview', 'candidates', 'judges', 'criteria', 'special-awards'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'special-awards' ? 'Special Awards' : tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Results Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-black mb-4">Results Summary</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{candidateScores.length}</div>
                  <div className="text-sm text-gray-600">Candidates Ranked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{event.judges.length}</div>
                  <div className="text-sm text-gray-600">Active Judges</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{event.scores.length}</div>
                  <div className="text-sm text-gray-600">Scores Submitted</div>
                </div>
              </div>
            </div>

            {/* Top 3 Candidates */}
            <div>
              <h3 className="text-lg font-semibold text-black mb-4">Top 3 Candidates</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {candidateScores.slice(0, 3).map((candidate, index) => (
                  <div key={candidate.candidate.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                      <span className="text-lg font-bold text-green-600">
                        {candidate.averageScore.toFixed(1)}
                      </span>
                    </div>
                    <h4 className="font-semibold text-black mb-1">
                      #{candidate.candidate.candidate_number} - {candidate.candidate.name}
                    </h4>
                    <p className="text-sm text-gray-600">{candidate.candidate.representation}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Special Awards Results */}
            {specialAwards.filter(award => award.award_type === 'vote').length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-black">Special Awards Voting Results</h3>
                  <button
                    onClick={() => handlePrintSpecialAwardsResults()}
                    className="btn-secondary inline-flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Results
                  </button>
                </div>
                <div className="space-y-4">
                  {specialAwards
                    .filter(award => award.award_type === 'vote')
                    .map(award => {
                      // Get all votes for this award
                      const awardVotes = event.special_award_votes?.filter(vote => 
                        vote.special_award_id === award.id
                      ) || []
                      
                      // Count votes per candidate
                      const voteCounts = {}
                      awardVotes.forEach(vote => {
                        voteCounts[vote.candidate_id] = (voteCounts[vote.candidate_id] || 0) + 1
                      })
                      
                      // Sort candidates by vote count
                      const sortedCandidates = event.candidates
                        .map(candidate => ({
                          ...candidate,
                          voteCount: voteCounts[candidate.id] || 0
                        }))
                        .sort((a, b) => b.voteCount - a.voteCount)
                      
                      // Find winner(s) - candidates with highest vote count
                      const maxVotes = sortedCandidates[0]?.voteCount || 0
                      const winners = sortedCandidates.filter(c => c.voteCount === maxVotes && maxVotes > 0)
                      
                      return (
                        <div key={award.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="mb-4">
                            <h4 className="font-semibold text-black mb-1">{award.name}</h4>
                            {award.description && (
                              <p className="text-sm text-gray-600 mb-2">{award.description}</p>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Vote-based Award
                              </span>
                              <span className="text-sm text-gray-600">
                                {awardVotes.length} judge(s) voted
                              </span>
                            </div>
                          </div>

                          {/* Winner Display */}
                          {winners.length > 0 && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium text-green-800">
                                  {winners.length === 1 ? 'Winner' : 'Winners'} ({maxVotes} vote{maxVotes !== 1 ? 's' : ''})
                                </span>
                              </div>
                              <div className="space-y-2">
                                {winners.map(winner => (
                                  <div key={winner.id} className="flex items-center gap-3">
                                    <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                                      #{winner.candidate_number}
                                    </span>
                                    <span className="font-medium text-green-900">{winner.name}</span>
                                    <span className="text-sm text-green-700">{winner.representation}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* All Candidates with Vote Counts */}
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr>
                                  <th className="px-4 py-2 text-left text-sm font-medium text-black">Rank</th>
                                  <th className="px-4 py-2 text-left text-sm font-medium text-black">Candidate</th>
                                  <th className="px-4 py-2 text-center text-sm font-medium text-black">Votes</th>
                                  <th className="px-4 py-2 text-center text-sm font-medium text-black">Percentage</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedCandidates.map((candidate, index) => {
                                  const percentage = awardVotes.length > 0 
                                    ? ((candidate.voteCount / awardVotes.length) * 100).toFixed(1)
                                    : '0.0'
                                  const isWinner = winners.some(w => w.id === candidate.id)
                                  
                                  return (
                                    <tr key={candidate.id} className={`border-t border-gray-200 ${
                                      isWinner ? 'bg-green-50' : ''
                                    }`}>
                                      <td className="px-4 py-2 text-sm font-medium text-black">
                                        #{index + 1}
                                        {isWinner && (
                                          <span className="ml-2 text-green-600">🏆</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-sm font-medium text-black">
                                        #{candidate.candidate_number} - {candidate.name}
                                      </td>
                                      <td className="px-4 py-2 text-center text-sm text-gray-600">
                                        {candidate.voteCount}
                                      </td>
                                      <td className="px-4 py-2 text-center text-sm text-gray-600">
                                        {percentage}%
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'candidates' && (
          <div className="space-y-8">
            {/* Overall Scores Table */}
            <div>
                          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-black">Overall Candidate Rankings</h3>
              <button
                onClick={handlePrintRankings}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-700 font-medium border border-gray-300 rounded-lg px-4 py-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print Rankings</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-black">Rank</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-black">Candidate</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-black">Representation</th>
                      {event.criteria.map(criteria => (
                        <th key={criteria.id} className="px-4 py-3 text-center text-sm font-medium text-black">
                          {criteria.name}<br/>
                          <span className="text-xs text-gray-500">({criteria.percentage}%)</span>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-sm font-medium text-black">Average</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-black">Judges</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidateScores.map((candidate, index) => (
                      <tr key={candidate.candidate.id} className="border-t border-gray-200">
                        <td className="px-4 py-3 text-sm font-medium text-black">#{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-black">
                          #{candidate.candidate.candidate_number} - {candidate.candidate.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{candidate.candidate.representation}</td>
                        {event.criteria.map(criteria => {
                          const criteriaScores = candidate.scores[criteria.id] || []
                          const averageScore = criteriaScores.length > 0 
                            ? (criteriaScores.reduce((sum, s) => sum + s.score, 0) / criteriaScores.length).toFixed(1)
                            : 'N/A'
                          return (
                            <td key={criteria.id} className="px-4 py-3 text-center text-sm text-gray-600">
                              {averageScore}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-center text-sm font-bold text-green-600">
                          {candidate.averageScore.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                          {candidate.judgeCount}/{event.num_judges}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Scoring Progress */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-black">Detailed Scoring Progress</h3>
                <button
                  onClick={() => handlePrintDetailedScoring()}
                  className="btn-secondary inline-flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Scoring
                </button>
              </div>
              <div className="space-y-6">
                {event.criteria.map(criteria => {
                  // Get all scores for this criteria
                  const criteriaScores = event.scores.filter(s => s.criteria_id === criteria.id)
                  
                  return (
                    <div key={criteria.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-black">
                          {criteria.name}
                        </h4>
                        <span className="text-sm text-gray-600">Max Score: {criteria.percentage}</span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium text-black">Judge</th>
                              {event.candidates.map(candidate => (
                                <th key={candidate.id} className="px-4 py-2 text-center text-sm font-medium text-black">
                                  #{candidate.candidate_number} - {candidate.name}
                                </th>
                              ))}
                              <th className="px-4 py-2 text-center text-sm font-medium text-black">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {event.judges.filter(j => j.name).map(judge => {
                              const judgeScores = criteriaScores.filter(s => s.judge_id === judge.id)
                              const allCandidatesScored = event.candidates.every(candidate => 
                                judgeScores.some(s => s.candidate_id === candidate.id)
                              )
                              
                              return (
                                <tr key={judge.id} className="border-t border-gray-100">
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    Judge {judge.judge_number} - {judge.name}
                                  </td>
                                  {event.candidates.map(candidate => {
                                    const score = judgeScores.find(s => s.candidate_id === candidate.id)
                                    return (
                                      <td key={candidate.id} className="px-4 py-2 text-center text-sm">
                                        {score ? (
                                          <span className="font-medium text-green-600">{score.score}</span>
                                        ) : (
                                          <span className="text-red-500">—</span>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td className="px-4 py-2 text-center text-sm">
                                    {allCandidatesScored ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Complete
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        Pending
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'judges' && (
          <div>
            <h3 className="text-lg font-semibold text-black mb-4">Judges & Access Codes</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* First ensure judges array is properly initialized */}
              {Array.from({ length: event.num_judges }, (_, i) => {
                const judgeNumber = i + 1
                // Find existing judge or create a new slot
                const judge = event.judges.find(j => j.judge_number === judgeNumber)
                
                // If no judge record exists for this number, we'll show an empty slot
                const judgeData = judge || {
                  id: `slot-${judgeNumber}`,
                  judge_number: judgeNumber,
                  name: '',
                  judge_access_code: 'Not Available',
                  status: 'pending',
                  event_id: event.id
                }
                
                return (
                <div key={judgeData.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Judge #{judgeData.judge_number}</span>
                    <span className={`text-sm font-medium ${
                      judgeData.status === 'pending' ? 'text-gray-500' :
                      judgeData.name ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {judgeData.status === 'pending' ? 'Pending Setup' :
                       judgeData.name ? 'Active' : 'Available'}
                    </span>
                  </div>
                  
                  {judgeData.status === 'pending' ? (
                    <>
                      <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-3">
                        <p className="text-sm text-gray-600">
                          This judge slot needs to be set up. Please refresh the page or contact support if this persists.
                        </p>
                      </div>
                      <button
                        onClick={() => fetchEventData()}
                        className="w-full text-sm text-gray-600 hover:text-gray-700 font-medium border border-gray-300 rounded-lg py-2"
                      >
                        Refresh Data
                      </button>
                    </>
                  ) : (
                    <>
                      {editingJudge?.id === judgeData.id ? (
                        <div className="mb-2">
                          <input
                            type="text"
                            value={editJudgeName}
                            onChange={(e) => setEditJudgeName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                            placeholder="Enter judge name"
                          />
                          <div className="flex space-x-2 mt-2">
                            <button
                              onClick={handleEditJudge}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingJudge(null)
                                setEditJudgeName('')
                              }}
                              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <h4 className="font-semibold text-black mb-2">
                          {judgeData.name || 'Not assigned'}
                        </h4>
                      )}

                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-1">Access Code:</div>
                        <div className={`font-mono text-sm font-bold tracking-wider px-2 py-1 rounded ${
                          judgeData.status === 'error' 
                            ? 'text-red-600 bg-red-50' 
                            : 'text-green-600 bg-green-50'
                        }`}>
                          {judgeData.judge_access_code}
                        </div>
                      </div>

                      <div className="flex flex-col space-y-2">
                        <p className="text-sm text-gray-600">
                          {judgeData.name ? `Joined ${new Date(judgeData.created_at).toLocaleDateString()}` : 'Not joined yet'}
                        </p>
                        
                        <div className="flex flex-col space-y-2">
                          <div className="flex space-x-2">
                            {judgeData.name ? (
                              <button
                                onClick={() => {
                                  setEditingJudge(judgeData)
                                  setEditJudgeName(judgeData.name)
                                }}
                                className="flex-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                              >
                                Edit Name
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingJudge(judgeData)
                                  setEditJudgeName('')
                                }}
                                className="flex-1 text-sm text-green-600 hover:text-green-700 font-medium"
                              >
                                Assign Name
                              </button>
                            )}
                          </div>
                          
                          <button
                            onClick={() => handlePrintJudge(judgeData)}
                            className="w-full text-sm text-gray-600 hover:text-gray-700 font-medium border border-gray-300 rounded-lg py-2 flex items-center justify-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span>Print Access Code</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'criteria' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-black">Judging Criteria</h3>
              <button
                onClick={handlePrintCriteria}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-700 font-medium border border-gray-300 rounded-lg px-4 py-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print Criteria</span>
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {event.criteria.map((criteria, index) => (
                <div key={criteria.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Criteria #{index + 1}</span>
                    <span className="text-sm font-bold text-green-600">{criteria.percentage}%</span>
                  </div>
                  <h4 className="font-semibold text-black">{criteria.name}</h4>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'special-awards' && (
          <div className="space-y-6">
            {/* Header with Add Award Button */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-black">Special Awards</h3>
              <button
                onClick={() => setShowAddAwardModal(true)}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Special Award</span>
              </button>
            </div>

            {/* Special Awards List */}
            {specialAwards.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No Special Awards Yet</h4>
                <p className="text-gray-500 mb-4">Create your first special award to recognize outstanding candidates.</p>
                <button
                  onClick={() => setShowAddAwardModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  Create First Award
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {specialAwards.map((award) => (
                  <div key={award.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-black mb-1">{award.name}</h4>
                        {award.description && (
                          <p className="text-sm text-gray-600 mb-2">{award.description}</p>
                        )}
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            award.award_type === 'assigned' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {award.award_type === 'assigned' ? 'Assigned' : 'Vote'}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingAward(award)
                            setShowEditAwardModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-700 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteAward(award.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Award Assignment Section */}
                    {award.award_type === 'assigned' ? (
                      <div className="border-t border-gray-100 pt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Assign to Candidate:
                        </label>
                        <select
                          value={award.assigned_candidate_id || ''}
                          onChange={(e) => handleAssignAward(award.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="">Select a candidate</option>
                          {event.candidates.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              #{candidate.candidate_number} - {candidate.name} ({candidate.representation})
                            </option>
                          ))}
                        </select>
                        {award.assigned_candidate && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-800">
                              <strong>Currently assigned to:</strong><br />
                              #{award.assigned_candidate.candidate_number} - {award.assigned_candidate.name}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Judges will vote for this award</strong>
                        </p>
                        <p className="text-xs text-gray-500">
                          Judges can vote for their preferred candidate when scoring
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Removed Reset Judge Confirmation Modal */}

        {/* Add Special Award Modal */}
        {showAddAwardModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowAddAwardModal(false)}
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-black mb-2">Add Special Award</h3>
                <p className="text-gray-600">Create a new special award for your event</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Award Name *
                  </label>
                  <input
                    type="text"
                    value={newAward.name}
                    onChange={(e) => setNewAward({...newAward, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., Best in Talent, Most Promising"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newAward.description}
                    onChange={(e) => setNewAward({...newAward, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Optional description of the award"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Award Type *
                  </label>
                  <select
                    value={newAward.award_type}
                    onChange={(e) => setNewAward({...newAward, award_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="assigned">Assigned</option>
                    <option value="vote">Vote</option>
                  </select>
                </div>

                {newAward.award_type === 'assigned' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign to Candidate
                    </label>
                    <select
                      value={newAward.assigned_candidate_id}
                      onChange={(e) => setNewAward({...newAward, assigned_candidate_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select a candidate (optional)</option>
                      {event?.candidates?.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          #{candidate.candidate_number} - {candidate.name} ({candidate.representation})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowAddAwardModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAward}
                  disabled={!newAward.name.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Award
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Special Award Modal */}
        {showEditAwardModal && editingAward && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => {
              setShowEditAwardModal(false)
              setEditingAward(null)
            }}
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-black mb-2">Edit Special Award</h3>
                <p className="text-gray-600">Update the special award details</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Award Name *
                  </label>
                  <input
                    type="text"
                    value={editingAward.name}
                    onChange={(e) => setEditingAward({...editingAward, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., Best in Talent, Most Promising"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editingAward.description || ''}
                    onChange={(e) => setEditingAward({...editingAward, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Optional description of the award"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Award Type *
                  </label>
                  <select
                    value={editingAward.award_type}
                    onChange={(e) => setEditingAward({...editingAward, award_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="assigned">Assigned</option>
                    <option value="vote">Vote</option>
                  </select>
                </div>

                {editingAward.award_type === 'assigned' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign to Candidate
                    </label>
                    <select
                      value={editingAward.assigned_candidate_id || ''}
                      onChange={(e) => setEditingAward({...editingAward, assigned_candidate_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select a candidate (optional)</option>
                      {event?.candidates?.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          #{candidate.candidate_number} - {candidate.name} ({candidate.representation})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditAwardModal(false)
                    setEditingAward(null)
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditAward}
                  disabled={!editingAward.name.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Award
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Event Modal */}
        {showDeleteModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => {
              setShowDeleteModal(false)
              setDeletePassword('')
            }}
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-black mb-2">Delete Event</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete "<strong>{event.name}</strong>"? 
                  This action cannot be undone and will permanently remove all event data including:
                </p>
                <ul className="text-sm text-gray-600 mt-3 text-left">
                  <li>• All candidates and their scores</li>
                  <li>• All judges and access codes</li>
                  <li>• All judging criteria</li>
                  <li>• Event logo and settings</li>
                </ul>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-black mb-2">
                  Enter your password to confirm *
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && deletePassword.trim() && !deleting) {
                      handleDeleteEvent()
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeletePassword('')
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition-colors font-medium"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteEvent}
                  disabled={deleting || !deletePassword.trim()}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete Event'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default EventDetails 