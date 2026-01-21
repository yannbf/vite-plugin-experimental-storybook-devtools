import React from 'react'
import { useState } from 'react'

interface MyButtonProps { variant?: 'primary' | 'secondary', size?: 'small' | 'medium' | 'large', children: React.ReactNode }

export const MyButton: React.FC<MyButtonProps> = ({ variant = 'primary', size = 'medium', children }: MyButtonProps) => {
  const [count, setCount] = useState(0)
  console.log('MyButton rendered')
  return (
    <button className="my-button" style={{ fontSize: size === 'small' ? '12px' : size === 'medium' ? '16px' : '20px', backgroundColor: variant === 'secondary' ? 'gray' : 'blue' }} onClick={() => setCount(count + 1)}>
      {children} {count > 0 && `(clicked ${count} times)`}
    </button>
  )
}
