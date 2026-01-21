import React from 'react'

export const Emoji = ({ onClick }: { onClick?: () => void }) => {
  return (
    <span onClick={onClick}>📸</span>
  )
}
