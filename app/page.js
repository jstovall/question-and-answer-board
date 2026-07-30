'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function createBoard(e) {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)

    const { data, error } = await supabase
      .from('boards')
      .insert({ question: question.trim() })
      .select()
      .single()

    setLoading(false)

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    router.push(`/b/${data.id}`)
  }

  return (
    <main className="max-w-3xl mx-auto mt-20 px-4">
      <h1 className="text-xl font-semibold mb-4">Create a new topic</h1>
      <form onSubmit={createBoard} className="flex flex-col gap-4">
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
    </main>
  )
}