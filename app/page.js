'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { getSavedName, saveName } from '../lib/creatorName'

export default function Home() {
  const [question, setQuestion] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [loading, setLoading] = useState(false)
  const [boards, setBoards] = useState([])
  const [filterName, setFilterName] = useState('')
  const router = useRouter()

  useEffect(() => {
    setCreatorName(getSavedName())
    loadBoards()
  }, [])

  async function loadBoards() {
    const { data, error } = await supabase
      .from('boards')
      .select()
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }
    setBoards(data)
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
      })
      .select()
      .single()

    setLoading(false)

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    router.push(`/b/${data.id}`)
  }

  const filteredBoards = filterName.trim()
    ? boards.filter((b) =>
        (b.creator_name || '').toLowerCase().includes(filterName.trim().toLowerCase())
      )
    : boards

  return (
    <main className="max-w-3xl mx-auto mt-16 px-4">
      <h1 className="text-xl font-semibold mb-4">Create a new topic</h1>
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
          placeholder="What's the question?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-800 text-white rounded py-2 px-4 disabled:opacity-50 self-start"
        >
          {loading ? 'Creating...' : 'Create Board'}
        </button>
      </form>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">All boards</h2>
        <input
          className="rounded p-2 bg-white text-sm w-48"
          placeholder="Filter by creator..."
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        {filteredBoards.length === 0 && (
          <p className="text-gray-500 text-sm">No boards found.</p>
        )}
        {filteredBoards.map((b) => (
          <a
            key={b.id}
            href={`/b/${b.id}`}
            className="block rounded p-3 bg-gray-200 hover:bg-gray-300 transition"
          >
            <div className="text-sm">{b.question}</div>
            {b.creator_name && (
              <div className="text-xs text-gray-500 mt-1">by {b.creator_name}</div>
            )}
          </a>
        ))}
      </div>
    </main>
  )
}