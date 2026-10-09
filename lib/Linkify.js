// Matches anything starting with http://, https://, or www.
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi

// Punctuation that usually belongs to the sentence, not the link
const TRAILING_PUNCTUATION = /[.,!?;:)\]'"]+$/

function shorten(url, max = 40) {
  const display = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  return display.length > max ? display.slice(0, max) + '…' : display
}

export default function Linkify({ text }) {
  // Splitting on a capturing group puts the links at the odd positions
  const parts = text.split(URL_PATTERN)

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part

        let url = part
        let trailing = ''
        const match = url.match(TRAILING_PUNCTUATION)
        if (match) {
          trailing = match[0]
          url = url.slice(0, -trailing.length)
        }

        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`

        return (
          <span key={i}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-blue-600 underline break-all"
            >
              {shorten(url)}
            </a>
            {trailing}
          </span>
        )
      })}
    </>
  )
}