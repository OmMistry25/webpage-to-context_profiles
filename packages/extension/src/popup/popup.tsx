import React from 'react'
import { createRoot } from 'react-dom/client'

function Popup() {
  return (
    <div style={{ width: 300, padding: 16 }}>
      <h2>Web to Context Profile</h2>
      <p>Extension popup placeholder</p>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}
