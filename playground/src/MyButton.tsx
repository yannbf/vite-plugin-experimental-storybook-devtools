import { useState } from 'react'
import { YetAnother } from './YetAnother'

interface MyButtonProps {
  type?: 'primary' | 'secondary'
  size?: 'small' | 'medium' | 'large'
}

export const MyButton: React.FC<MyButtonProps> = ({ type, size }) => {
  const [count, setCount] = useState(0)
  console.log('MyButton rendered')
  return (
    <button className="my-button" style={{ fontSize: size === 'small' ? '12px' : size === 'medium' ? '16px' : '20px', backgroundColor: type === 'secondary' ? 'gray' : 'blue' }} onClick={() => setCount(count + 1)}>
      my button
      <br /> type: {type}
      <br /> count: {count}
      <YetAnother />
    </button>
  )
}
