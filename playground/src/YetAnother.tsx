import React from 'react'

export const YetAnother = ({ type }: { type?: string } = { type: 'neon' }) => {
  console.log('Other rendered')
  return (
    <span>Hello world</span>
  )
}
