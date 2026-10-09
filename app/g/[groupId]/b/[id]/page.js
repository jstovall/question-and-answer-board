'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '../../../../../lib/supabaseClient'
import { getVoterId } from '../../../../../lib/voterId'
import { getSavedName } from '../../../../../lib/creatorName'
import { getAuthorName, saveAuthorName } from '../../../../../lib/authorName'
import Linkify from '../../../../../lib/Linkify'

export default function BoardPage({ params }) {
  const { groupId, id } = use(params)
  const [board, setBoard] = useState(null)
  const [answers, setAnswers] = useState([])
  const [newAnswer, setNewAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [myVotes, setMyVotes] = useState({})
  const [comments, setComments] = useState({})
  const [openCommentBox, setOpenCommentBox] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [copied, setCopied] = useState(false)

  // This browser's anonymous ID (used to decide who can edit/delete)
  const [myId, setMyId] = useState(null)

  // Editing: { type: 'answer' | 'comment', id } or null
  const [editing, setEditing] = useState(null)
  const [editText, setEditText] = useState('')

  // Name handling: null = not asked yet, '' = chose anonymous
  const [authorName, setAuthorName] = useState(null)
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [pendingAction, setPendingAction] = useState(null)

  useEffect(() => {
    setMyId(getVoterId())
    setAuthorName(getAuthorName(groupId))
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
      .order('is_accepted', { ascending: false })
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

  // True if this answer/comment was posted from this browser
  function isMine(item) {
    return !!myId && item.author_id === myId
  }

  // Runs the action right away if the poster's name choice is known,
  // otherwise shows the name prompt first and runs it afterward.
  function withAuthorName(action) {
    if (authorName === null) {
      setNameInput(getSavedName())
      setPendingAction(() => action)
      setShowNamePrompt(true)
      return
    }
    action(authorName)
  }

  function confirmName(name) {
    const clean = name.trim()
    saveAuthorName(groupId, clean)
    setAuthorName(clean)
    setShowNamePrompt(false)
    if (pendingAction) {
      pendingAction(clean)
      setPendingAction(null)
    }
  }

  function cancelNamePrompt() {
    setShowNamePrompt(false)
    setPendingAction(null)
  }

  function openNameEditor() {
    setNameInput(authorName || '')
    setPendingAction(null)
    setShowNamePrompt(true)
  }

  function submitAnswer(e) {
    e.preventDefault()
    if (!newAnswer.trim()) return
    withAuthorName(postAnswer)
  }

  async function postAnswer(name) {
    const { error } = await supabase.from('answers').insert({
      board_id: id,
      body: newAnswer.trim(),
      author_name: name || null,
      author_id: getVoterId(),
    })

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    setNewAnswer('')
    loadAnswers()
  }

  function submitComment(answerId) {
    if (!newComment.trim()) return
    withAuthorName((name) => postComment(answerId, name))
  }

  async function postComment(answerId, name) {
    const { error } = await supabase.from('comments').insert({
      answer_id: answerId,
      body: newComment.trim(),
      author_name: name || null,
      author_id: getVoterId(),
    })

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    setNewComment('')
    loadComments()
  }

  function startEdit(type, item) {
    setEditing({ type, id: item.id })
    setEditText(item.body)
  }

  function cancelEdit() {
    setEditing(null)
    setEditText('')
  }

  async function saveEdit() {
    if (!editing || !editText.trim()) return

    const table = editing.type === 'answer' ? 'answers' : 'comments'

    const { error } = await supabase
      .from(table)
      .update({ body: editText.trim(), edited_at: new Date().toISOString() })
      .eq('id', editing.id)
      .eq('author_id', getVoterId())

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    const type = editing.type
    cancelEdit()
    if (type === 'answer') loadAnswers()
    else loadComments()
  }

  async function deletePost(type, item) {
    const message =
      type === 'answer'
        ? 'Delete your answer? Its votes and comments will be deleted too.'
        : 'Delete your comment?'
    if (!confirm(message)) return

    const table = type === 'answer' ? 'answers' : 'comments'

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', item.id)
      .eq('author_id', getVoterId())

    if (error) {
      alert('Something went wrong: ' + error.message)
      return
    }

    if (type === 'answer') {
      loadAnswers()
      loadComments()
    } else {
      loadComments()
    }
  }

  async function vote(answerId, value) {
    const voterId = getVoterId()
    const currentVote = myVotes[answerId]

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

  async function markBestAnswer(answerId, currentlyAccepted) {
    await supabase.from('answers').update({ is_accepted: false }).eq('board_id', id)

    if (!currentlyAccepted) {
      await supabase.from('answers').update({ is_accepted: true }).eq('id', answerId)
    }

    loadAnswers()
  }

  function copyLink() {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!board) return <div className="p-8">Board not found.</div>

  return (
    <main className="w-full max-w-3xl min-w-[400px] mx-auto mt-16 px-4">
      <a href={`/g/${groupId}`} className="text-xs text-blue-600">
        ← Back to group
      </a>

      <div className="flex items-center justify-between gap-3 mb-6 mt-2">
        <h1 className="text-xl font-semibold">{board.question}</h1>
        <button
          onClick={copyLink}
          title="Copy link"
          className="text-xs text-blue-600 whitespace-nowrap"
        >
          {copied ? 'Copied!' : '🔗︎'}
        </button>
      </div>

      <form onSubmit={submitAnswer} className="flex flex-col gap-3 mb-8">
        <textarea
          className="rounded p-3 w-full bg-white"
          rows={2}
          placeholder="Add your answer..."
          maxLength={1000}
          value={newAnswer}
          onChange={(e) => setNewAnswer(e.target.value)}
        />
        <div className="text-xs text-gray-400 -mt-2 self-end">
          {newAnswer.length}/1000
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bg-gray-800 text-white rounded py-2 px-4"
          >
            Submit Answer
          </button>
          {authorName !== null && (
            <span className="text-xs text-gray-500">
              {authorName ? `Posting as ${authorName}` : 'Posting anonymously'}
              <button
                type="button"
                onClick={openNameEditor}
                className="text-blue-600 ml-1"
              >
                · change
              </button>
            </span>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {answers.length === 0 && (
          <p className="text-gray-500">No answers yet. Be the first!</p>
        )}
        {answers.map((answer) => (
          <div
            key={answer.id}
            className={`rounded p-2 ${answer.is_accepted ? 'bg-green-100' : 'bg-gray-200'}`}
          >
            {answer.is_accepted && (
              <div className="text-xs text-green-700 font-medium mb-1">✓ Best Answer</div>
            )}
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1 text-gray-400">
                <button
                  onClick={() => vote(answer.id, 1)}
                  className={`hover:text-green-600 ${myVotes[answer.id] === 1 ? 'text-green-600' : ''}`}
                >
                  ▲
                </button>
                <span className="text-xs font-normal text-gray-600 w-4 text-center">
                  {answer.score}
                </span>
                <button
                  onClick={() => vote(answer.id, -1)}
                  className={`hover:text-red-600 ${myVotes[answer.id] === -1 ? 'text-red-600' : ''}`}
                >
                  ▼
                </button>
              </div>

              {editing?.type === 'answer' && editing.id === answer.id ? (
                <div className="flex-1 flex flex-col gap-1">
                  <textarea
                    className="rounded p-2 w-full bg-white text-sm"
                    rows={2}
                    maxLength={1000}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="flex gap-3 justify-end text-xs">
                    <span className="text-gray-400 mr-auto">{editText.length}/1000</span>
                    <button onClick={cancelEdit} className="text-gray-500">
                      Cancel
                    </button>
                    <button onClick={saveEdit} className="text-blue-600">
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 text-sm">
                  <Linkify text={answer.body} />
                  {answer.author_name && (
                    <span className="text-xs text-gray-500"> · {answer.author_name}</span>
                  )}
                  {answer.edited_at && (
                    <span className="text-xs text-gray-400"> (edited)</span>
                  )}
                  {isMine(answer) && (
                    <span className="text-xs">
                      <button
                        onClick={() => startEdit('answer', answer)}
                        className="text-gray-500 ml-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deletePost('answer', answer)}
                        className="text-red-600 ml-2"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={() =>
                  setOpenCommentBox(openCommentBox === answer.id ? null : answer.id)
                }
                className="text-xs text-blue-600 whitespace-nowrap"
              >
                {comments[answer.id]?.length
                  ? `${comments[answer.id].length} comment(s)`
                  : 'Comment'}
              </button>
              <button
                onClick={() => markBestAnswer(answer.id, answer.is_accepted)}
                className="text-xs text-gray-500 whitespace-nowrap"
              >
                {answer.is_accepted ? 'Unmark' : 'Mark as best'}
              </button>
            </div>

            {openCommentBox === answer.id && (
              <div className="mt-2 ml-6 flex flex-col gap-1.5">
                {(comments[answer.id] || []).map((c) => (
                  <div key={c.id} className="text-xs bg-gray-300 rounded p-1.5">
                    {editing?.type === 'comment' && editing.id === c.id ? (
                      <div className="flex flex-col gap-1">
                        <textarea
                          className="rounded p-1.5 w-full bg-white text-xs"
                          rows={2}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                        <div className="flex gap-3 justify-end">
                          <button onClick={cancelEdit} className="text-gray-500">
                            Cancel
                          </button>
                          <button onClick={saveEdit} className="text-blue-600">
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Linkify text={c.body} />
                        {c.author_name && (
                          <span className="text-gray-500"> · {c.author_name}</span>
                        )}
                        {c.edited_at && (
                          <span className="text-gray-500"> (edited)</span>
                        )}
                        {isMine(c) && (
                          <span>
                            <button
                              onClick={() => startEdit('comment', c)}
                              className="text-gray-600 ml-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deletePost('comment', c)}
                              className="text-red-600 ml-2"
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    className="rounded p-1.5 flex-1 text-xs bg-white"
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    onClick={() => submitComment(answer.id)}
                    className="bg-gray-800 text-white rounded px-2 text-xs"
                  >
                    Post
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showNamePrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded p-4 w-full max-w-sm">
            <h2 className="text-sm font-semibold mb-1">Add your name?</h2>
            <p className="text-xs text-gray-500 mb-3">
              Optional. It will show next to your answers and comments in this group.
            </p>
            <input
              autoFocus
              className="rounded p-2 w-full bg-gray-100 text-sm mb-3"
              placeholder="Your name"
              maxLength={50}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmName(nameInput)
              }}
            />
            <div className="flex gap-2 justify-end items-center">
              <button
                onClick={cancelNamePrompt}
                className="text-xs text-gray-500 px-2"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmName('')}
                className="text-xs text-gray-700 px-2"
              >
                {pendingAction ? 'Post anonymously' : 'Anonymous'}
              </button>
              <button
                onClick={() => confirmName(nameInput)}
                className="bg-gray-800 text-white rounded px-3 py-1 text-xs"
              >
                {pendingAction ? 'Post' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}