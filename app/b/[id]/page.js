'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { getVoterId } from '../../../lib/voterId'

export default function BoardPage({ params }) {
  const { id } = use(params)
  const [board, setBoard] = useState(null)
  const [answers, setAnswers] = useState([])
  const [newAnswer, setNewAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [myVotes, setMyVotes] = useState({})
  const [comments, setComments] = useState({})
  const [openCommentBox, setOpenCommentBox] = useState(null)
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    loadBoard()
    loadAnswers()
    loadMyVotes()
    loadComments()
  }, [])

  async function loadBoard() {
    const { data, error } = await supabase
      .from('boards')
      .select()
      .eq('id', id)
      .single()

    if (error) {
      console.error(error)
      return
    }
    setBoard(data)
  }

  async function loadAnswers() {
    const { data, error } = await supabase
      .from('answers')
      .select()
      .eq('board_id', id)
      .order('score', { ascending: false })

    if (error) {
      console.error(error)
      return
    }
    setAnswers(data)
    setLoading(false)
  }

  async function loadMyVotes() {
    const voterId = getVoterId()
    const { data, error } = await supabase
      .from('votes')
      .select()
      .eq('voter_id', voterId)

    if (error) {
      console.error(error)
      return
    }

    const voteMap = {}
    data.forEach((v) => {
      voteMap[v.answer_id] = v.value
    })
    setMyVotes(voteMap)
  }
async function loadComments() {
    const { data, error } = await supabase
      .from('comments')
      .select()
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    const grouped = {}
    data.forEach((c) => {
      if (!grouped[c.answer_id]) grouped[c.answer_id] = []
      grouped[c.answer_id].push(c)
    })
    setComments(grouped)
  }

  async function submitComment(answerId) {
    if (!newComment.trim()) return

    const { error } = await supabase
      .from('comments')
      .insert({ answer_id: answerId, body: newComment.trim() })

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    setNewComment('')
    loadComments()
  }

  async function submitAnswer(e) {
    e.preventDefault()
    if (!newAnswer.trim()) return

    const { error } = await supabase
      .from('answers')
      .insert({ board_id: id, body: newAnswer.trim() })

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    setNewAnswer('')
    loadAnswers()
  }

  async function vote(answerId, value) {
    const voterId = getVoterId()
    const currentVote = myVotes[answerId]

    // Clicking the same button again removes the vote
    const newValue = currentVote === value ? null : value

    if (newValue === null) {
      await supabase
        .from('votes')
        .delete()
        .eq('voter_id', voterId)
        .eq('answer_id', answerId)
    } else {
      await supabase
        .from('votes')
        .upsert({ voter_id: voterId, answer_id: answerId, value: newValue })
    }

    // Recalculate score from scratch to keep things simple and accurate
    const { data: votesForAnswer } = await supabase
      .from('votes')
      .select('value')
      .eq('answer_id', answerId)

    const newScore = votesForAnswer.reduce((sum, v) => sum + v.value, 0)

    await supabase
      .from('answers')
      .update({ score: newScore })
      .eq('id', answerId)

    loadAnswers()
    loadMyVotes()
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!board) return <div className="p-8">Board not found.</div>

  return (
    <main className="max-w-xl mx-auto mt-16 px-4">
      <h1 className="text-2xl font-bold mb-6">{board.question}</h1>

      <form onSubmit={submitAnswer} className="flex flex-col gap-3 mb-8">
        <textarea
          className="border rounded p-3 w-full"
          rows={2}
          placeholder="Add your answer..."
          value={newAnswer}
          onChange={(e) => setNewAnswer(e.target.value)}
        />
        <button
          type="submit"
          className="bg-black text-white rounded py-2 px-4 self-start"
        >
          Submit Answer
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {answers.length === 0 && (
          <p className="text-gray-500">No answers yet. Be the first!</p>
        )}
        {answers.map((answer) => (
          <div key={answer.id} className="border rounded p-3">
            <div className="flex gap-3 items-start">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => vote(answer.id, 1)}
                  className={`px-2 rounded ${myVotes[answer.id] === 1 ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
                >
                  ▲
                </button>
                <span className="text-sm font-semibold my-1">{answer.score}</span>
                <button
                  onClick={() => vote(answer.id, -1)}
                  className={`px-2 rounded ${myVotes[answer.id] === -1 ? 'bg-red-500 text-white' : 'bg-gray-100'}`}
                >
                  ▼
                </button>
              </div>
              <div className="pt-1 flex-1">
                {answer.body}
                <div>
                  <button
                    onClick={() =>
                      setOpenCommentBox(openCommentBox === answer.id ? null : answer.id)
                    }
                    className="text-sm text-blue-600 mt-2"
                  >
                    {comments[answer.id]?.length
                      ? `${comments[answer.id].length} comment(s)`
                      : 'Add comment'}
                  </button>
                </div>
              </div>
            </div>

            {openCommentBox === answer.id && (
              <div className="mt-3 ml-8 flex flex-col gap-2">
                {(comments[answer.id] || []).map((c) => (
                  <div key={c.id} className="text-sm bg-gray-50 rounded p-2">
                    {c.body}
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    className="border rounded p-2 flex-1 text-sm"
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    onClick={() => submitComment(answer.id)}
                    className="bg-gray-800 text-white rounded px-3 text-sm"
                  >
                    Post
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}