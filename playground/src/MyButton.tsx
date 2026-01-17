import { useState } from 'react'
import { YetAnother } from './YetAnother'

interface MyButtonProps {
  type?: 'primary'
}

export const MyButton: React.FC<MyButtonProps> = ({ type }) => {
  const [count, setCount] = useState(0)
  console.log('MyButton rendered')
  return (
    <button className="my-button" onClick={() => setCount(count + 1)}>
      my button
      <br /> type: {type}
      <br /> count: {count}
      <YetAnother />
    </button>
  )
}
