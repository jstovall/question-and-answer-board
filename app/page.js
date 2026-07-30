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
    <main className="max-w-xl mx-auto mt-20 px-4">
      <h1 className="text-2xl font-bold mb-4">Create a new topic</h1>
      <form onSubmit={createBoard} className="flex flex-col gap-4">
        <textarea
          className="border rounded p-3 w-full"
          rows={3}
          placeholder="What's the question?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded py-2 px-4 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Board'}
        </button>
      </form>
    </main>
  )
}