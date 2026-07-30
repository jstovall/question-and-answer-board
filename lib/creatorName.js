export function getSavedName() {
  return localStorage.getItem('creator_name') || ''
}

export function saveName(name) {
  localStorage.setItem('creator_name', name)
}