// null = never asked, '' = chose to post anonymously
export function getAuthorName(groupId) {
  return localStorage.getItem(`author_name:${groupId}`)
}

export function saveAuthorName(groupId, name) {
  localStorage.setItem(`author_name:${groupId}`, name)
}