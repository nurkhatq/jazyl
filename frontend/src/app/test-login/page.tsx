'use client'

import { useState } from 'react'

export default function TestLogin() {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<any>(null)

  const testLogin = async () => {
    try {
      const params = new URLSearchParams()
      params.append('username', 'admin@jazyl.tech')
      params.append('password', 'Admin123!')

      const response = await fetch('https://api.jazyl.tech/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      const data = await response.json()
      setResult(data)
      setError(null)
    } catch (err) {
      setError(err)
      setResult(null)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Test Login</h1>
      <button
        onClick={testLogin}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Test Login API
      </button>
      
      {result && (
        <pre className="mt-4 p-4 bg-green-100">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
      
      {error && (
        <pre className="mt-4 p-4 bg-red-100">
          {JSON.stringify(error, null, 2)}
        </pre>
      )}
    </div>
  )
}