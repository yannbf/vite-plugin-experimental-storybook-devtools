import React from 'react'
import { YetAnother } from './YetAnother'

export const Other = ({ label, mode, deepObject }) => {
  console.log('Other rendered')
  return (
    <div className="other">
      <h1>{label}</h1>
      <p>mode: {mode}</p>
      <p>deepObject: {JSON.stringify(deepObject)}</p>
      <YetAnother type="opaque" />
    </div>
  )
}
