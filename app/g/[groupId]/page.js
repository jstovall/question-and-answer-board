'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import { getSavedName, saveName } from '../../../lib/creatorName'

export default function GroupPage({ params }) {
  const { groupId } = use(params)
  const router = useRouter()

  const [group, setGroup] = useState(null)
  const [loadingGroup, setLoadingGroup] = useState(true)

  const [question, setQuestion] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [boards, setBoards] = useState([])
  const [answerCounts, setAnswerCounts] = useState({})
  const [filterName, setFilterName] = useState('')
  const [sortBy, setSortBy] = useState('date')

  useEffect(() => {
    setCreatorName(getSavedName())
    loadGroup()
    loadBoards()
    loadAnswerCounts()
  }, [])

  async function loadGroup() {
    const { data, error } = await supabase
      .from('groups')
      .select()
      .eq('id', groupId)
      .single()

    if (error) {
      console.error(error)
      setLoadingGroup(false)
      return
    }
    setGroup(data)
    setLoadingGroup(false)
  }

  async function loadBoards() {
    const { data, error } = await supabase
      .from('boards')
      .select()
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }
    setBoards(data)
  }

  async function loadAnswerCounts() {
    const { data, error } = await supabase.from('answers').select('board_id')

    if (error) {
      console.error(error)
      return
    }

    const counts = {}
    data.forEach((a) => {
      counts[a.board_id] = (counts[a.board_id] || 0) + 1
    })
    setAnswerCounts(counts)
  }

  async function createBoard(e) {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    saveName(creatorName.trim())

    const { data, error } = await supabase
      .from('boards')
      .insert({
        question: question.trim(),
        creator_name: creatorName.trim() || null,
        group_id: groupId,
      })
      .select()
      .single()

    setLoading(false)

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    router.push(`/g/${groupId}/b/${data.id}`)
  }

  async function deleteBoard(boardId) {
    const confirmed = confirm(
      'Delete this board and all its answers/comments? This cannot be undone.'
    )
    if (!confirmed) return

    const { error } = await supabase.from('boards').delete().eq('id', boardId)

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    loadBoards()
  }

  async function exportBoard(board) {
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select()
      .eq('board_id', board.id)
      .order('score', { ascending: false })

    if (answersError) {
      alert('Something went wrong: ' + answersError.message)
      return
    }

    const answerIds = answers.map((a) => a.id)
    let commentsByAnswer = {}

    if (answerIds.length > 0) {
      const { data: comments, error: commentsError } = await supabase
        .from('comments')
        .select()
        .in('answer_id', answerIds)
        .order('created_at', { ascending: true })

      if (commentsError) {
        alert('Something went wrong: ' + commentsError.message)
        return
      }

      comments.forEach((c) => {
        if (!commentsByAnswer[c.answer_id]) commentsByAnswer[c.answer_id] = []
        commentsByAnswer[c.answer_id].push(c.body)
      })
    }

    const escapeCSV = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`

    const rows = [['Question', 'Answer', 'Score', 'Comments', 'Answer Created At']]

    answers.forEach((a) => {
      const comments = (commentsByAnswer[a.id] || []).join(' | ')
      rows.push([board.question, a.body, a.score, comments, a.created_at])
    })

    const csvContent = rows.map((row) => row.map(escapeCSV).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `board-${board.id}-export.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const isDeleteMode = filterName.trim().toUpperCase() === 'DELETE'
  const isExportMode = filterName.trim().toUpperCase() === 'EXPORT'

  const filteredBoards = (
    filterName.trim() && !isDeleteMode && !isExportMode
      ? boards.filter((b) =>
          (b.creator_name || '').toLowerCase().includes(filterName.trim().toLowerCase())
        )
      : boards
  ).slice().sort((a, b) => {
    if (sortBy === 'answers') {
      return (answerCounts[b.id] || 0) - (answerCounts[a.id] || 0)
    }
    return new Date(b.created_at) - new Date(a.created_at)
  })

  if (loadingGroup) return <div className="p-8">Loading...</div>
  if (!group) return <div className="p-8">Group not found.</div>

  return (
    <main className="w-full max-w-3xl min-w-[400px] mx-auto mt-16 px-4">
      <a href="/" className="text-xs text-blue-600">
        ← All groups
      </a>
      <h1 className="text-xl font-semibold mt-2 mb-4">{group.name}</h1>

      <h2 className="text-lg font-semibold mb-2">Post a question</h2>
      <form onSubmit={createBoard} className="flex flex-col gap-3 mb-12">
        <input
          className="rounded p-3 w-full bg-white text-sm"
          placeholder="Your name (optional)"
          value={creatorName}
          onChange={(e) => setCreatorName(e.target.value)}
        />
        <textarea
          className="rounded p-3 w-full bg-white"
          rows={3}
          placeholder="What's the question?
          Tip: Avoid yes/no and respondant-specific questions. This is more of a discussion than a survey"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-800 text-white rounded py-2 px-4 disabled:opacity-50 self-start"
        >
          {loading ? 'Posting...' : 'Ask Question'}
        </button>
      </form>

      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-lg font-semibold">All Questions</h2>
        <div className="flex items-center gap-2">
          <select
            className="rounded p-2 bg-white text-sm text-gray-500"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date">Newest</option>
            <option value="answers">Most answers</option>
          </select>
          <input
            className="rounded p-2 bg-white text-sm w-40"
            placeholder="Filter by name..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filteredBoards.length === 0 && (
          <p className="text-gray-500 text-sm">No questions yet.</p>
        )}
        {filteredBoards.map((b) => (
          <div
            key={b.id}
            className="rounded p-3 bg-gray-100 hover:bg-gray-200 transition flex justify-between items-start gap-2"
          >
            <a href={`/g/${groupId}/b/${b.id}`} className="flex-1">
              <div className="text-sm">{b.question}</div>
              <div className="text-xs text-gray-500 mt-1">
                {b.creator_name && <span>by {b.creator_name} · </span>}
                {b.created_at.slice(0, 10)} · {answerCounts[b.id] || 0} answer(s)
              </div>
            </a>
            <div className="flex gap-2">
              {(isExportMode ||
                (b.creator_name &&
                  b.creator_name.toLowerCase() === filterName.trim().toLowerCase())) && (
                <button
                  onClick={() => exportBoard(b)}
                  className="text-xs text-blue-600 whitespace-nowrap"
                >
                  Export
                </button>
              )}
              {(isDeleteMode ||
                (b.creator_name &&
                  b.creator_name.toLowerCase() === filterName.trim().toLowerCase())) && (
                <button
                  onClick={() => deleteBoard(b.id)}
                  className="text-xs text-red-600 whitespace-nowrap"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}