'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function Home() {
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState([])
  const [boardCounts, setBoardCounts] = useState({}) // group_id -> board count
  const [answerCounts, setAnswerCounts] = useState({}) // group_id -> answer count
  const router = useRouter()

  useEffect(() => {
    loadGroups()
    loadStats()
  }, [])

  async function loadGroups() {
    const { data, error } = await supabase
      .from('groups')
      .select()
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }
    setGroups(data)
  }

  async function loadStats() {
    const { data: boardsData, error: boardsError } = await supabase
      .from('boards')
      .select('id, group_id')

    if (boardsError) {
      console.error(boardsError)
      return
    }

    const bCounts = {}
    const boardToGroup = {}
    boardsData.forEach((b) => {
      bCounts[b.group_id] = (bCounts[b.group_id] || 0) + 1
      boardToGroup[b.id] = b.group_id
    })
    setBoardCounts(bCounts)

    const { data: answersData, error: answersError } = await supabase
      .from('answers')
      .select('board_id')

    if (answersError) {
      console.error(answersError)
      return
    }

    const aCounts = {}
    answersData.forEach((a) => {
      const groupId = boardToGroup[a.board_id]
      if (groupId) {
        aCounts[groupId] = (aCounts[groupId] || 0) + 1
      }
    })
    setAnswerCounts(aCounts)
  }

  async function createGroup(e) {
    e.preventDefault()
    if (!groupName.trim()) return

    const slug = slugify(groupName)
    if (!slug) {
      alert('Please enter a valid name.')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('groups').insert({ id: slug, name: groupName.trim() })

    setLoading(false)

    if (error) {
      if (error.code === '23505') {
        alert(`A group called "${groupName.trim()}" already exists. Try a different name.`)
      } else {
        alert('Something went wrong: ' + error.message)
      }
      return
    }

    router.push(`/g/${slug}`)
  }

  return (
    <main className="w-full max-w-3xl min-w-[400px] mx-auto mt-16 px-4">
      <h1 className="text-xl font-semibold mb-4">Create a new group</h1>
      <form onSubmit={createGroup} className="flex flex-col gap-3 mb-12">
        <input
          className="rounded p-3 w-full bg-white text-sm"
          placeholder="Group name (e.g. Marketing Team)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-gray-800 text-white rounded py-2 px-4 disabled:opacity-50 self-start"
        >
          {loading ? 'Creating...' : 'Create Group'}
        </button>
      </form>

      <h2 className="text-lg font-semibold mb-3">All Groups</h2>
      <div className="flex flex-col gap-2">
        {groups.length === 0 && <p className="text-gray-500 text-sm">No groups yet.</p>}
        {groups.map((g) => (
          <a
            key={g.id}
            href={`/g/${g.id}`}
            className="block rounded p-3 bg-gray-100 hover:bg-gray-200 transition"
          >
            <div className="text-sm">{g.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              /g/{g.id} · {boardCounts[g.id] || 0} question(s) · {answerCounts[g.id] || 0} answer(s)
            </div>
          </a>
        ))}
      </div>
    </main>
  )
}