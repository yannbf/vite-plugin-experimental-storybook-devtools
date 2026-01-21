import React from 'react'
import { Emoji } from './Emoji'

export const WithChildren = ({ label, mode, deepObject, children }: { label: string, mode: string, deepObject: any, children?: React.ReactNode }) => {
  return (
    <div className="other">
      <h1>{label}</h1>
      <p>mode: {mode}</p>
      <p>deepObject: {JSON.stringify(deepObject)}</p>
      <Emoji />
      {children}
    </div>
  )
}
